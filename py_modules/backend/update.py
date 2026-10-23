from __future__ import annotations

import hashlib
import json
import re
import ssl
import tempfile
from threading import Lock
import urllib.request
from urllib.error import HTTPError
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Mapping
from urllib.parse import urlparse

MAX_UPDATE_BYTES = 100 * 1024 * 1024
MAX_MANIFEST_BYTES = 64 * 1024
PRODUCTION_UPDATE_MANIFEST_URL = (
  "https://github.com/parvagans/achievement-companion/releases/latest/download/update-manifest.json"
)
SEMVER_PATTERN = re.compile(
  r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
  r"(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\."
  r"(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?"
  r"(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$"
)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
ARCHIVE_ROOT = "achievement-companion"
REQUIRED_PACKAGE_FILES = (
  f"{ARCHIVE_ROOT}/main.py",
  f"{ARCHIVE_ROOT}/package.json",
  f"{ARCHIVE_ROOT}/plugin.json",
  f"{ARCHIVE_ROOT}/py_modules/backend/__init__.py",
)

_prepared_artifacts: list[tempfile.TemporaryDirectory[str]] = []
_prepared_artifacts_lock = Lock()


class UpdateVerificationError(RuntimeError):
  pass


def fetch_update_manifest(
  *,
  ssl_context: ssl.SSLContext,
  urlopen: Callable[..., Any] = urllib.request.urlopen,
) -> dict[str, Any]:
  request = urllib.request.Request(
    PRODUCTION_UPDATE_MANIFEST_URL,
    headers={"Accept": "application/json", "User-Agent": "Achievement-Companion-Updater"},
  )
  try:
    with urlopen(request, timeout=10, context=ssl_context) as response:
      body = response.read(MAX_MANIFEST_BYTES + 1)
  except HTTPError as cause:
    raise UpdateVerificationError(f"Update manifest request failed with HTTP {cause.code}.") from cause
  except Exception as cause:
    raise UpdateVerificationError("Update manifest request failed.") from cause
  if len(body) > MAX_MANIFEST_BYTES:
    raise UpdateVerificationError("Update manifest exceeds the maximum allowed size.")
  try:
    manifest = json.loads(body.decode("utf-8"))
  except (UnicodeDecodeError, ValueError) as cause:
    raise UpdateVerificationError("Update manifest response is not valid JSON.") from cause
  if not isinstance(manifest, dict):
    raise UpdateVerificationError("Update manifest must be a JSON object.")
  return manifest


def _required_string(payload: Mapping[str, Any], key: str) -> str:
  value = payload.get(key)
  if not isinstance(value, str) or not value.strip():
    raise UpdateVerificationError(f"Update manifest {key} is required.")
  return value.strip()


def validate_update_request(payload: Mapping[str, Any]) -> tuple[str, str, str]:
  version = _required_string(payload, "version")
  if SEMVER_PATTERN.fullmatch(version) is None:
    raise UpdateVerificationError("Update version is not valid SemVer.")
  download_url = _required_string(payload, "downloadUrl")
  parsed_url = urlparse(download_url)
  if parsed_url.scheme not in ("http", "https") or not parsed_url.netloc:
    raise UpdateVerificationError("Update download URL must use HTTP or HTTPS.")
  sha256 = _required_string(payload, "sha256").lower()
  if SHA256_PATTERN.fullmatch(sha256) is None:
    raise UpdateVerificationError("Update checksum must be a SHA-256 hexadecimal value.")
  return version, download_url, sha256


def _validate_archive_member(name: str) -> None:
  path = PurePosixPath(name)
  if path.is_absolute() or ".." in path.parts or "\\" in name:
    raise UpdateVerificationError("Update package contains an unsafe archive path.")


def _read_json_member(archive: zipfile.ZipFile, name: str) -> Mapping[str, Any]:
  try:
    value = json.loads(archive.read(name).decode("utf-8"))
  except (KeyError, UnicodeDecodeError, ValueError) as cause:
    raise UpdateVerificationError(f"Update package contains invalid {PurePosixPath(name).name}.") from cause
  if not isinstance(value, Mapping):
    raise UpdateVerificationError(f"Update package {PurePosixPath(name).name} must be a JSON object.")
  return value


def verify_update_package(zip_path: Path, manifest_version: str, expected_sha256: str) -> dict[str, str]:
  digest = hashlib.sha256()
  with zip_path.open("rb") as artifact:
    for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
      digest.update(chunk)
  actual_sha256 = digest.hexdigest()
  if actual_sha256 != expected_sha256:
    raise UpdateVerificationError("Update verification failed: SHA-256 checksum mismatch. The package was not installed.")

  if not zipfile.is_zipfile(zip_path):
    raise UpdateVerificationError("Update package is not a valid ZIP archive.")

  try:
    with zipfile.ZipFile(zip_path) as archive:
      names = set(archive.namelist())
      for name in names:
        _validate_archive_member(name)
      missing = [name for name in REQUIRED_PACKAGE_FILES if name not in names]
      if missing:
        raise UpdateVerificationError(f"Update package is missing required Decky files: {', '.join(missing)}.")
      if not any(name.startswith(f"{ARCHIVE_ROOT}/dist/") and name.endswith(".js") for name in names):
        raise UpdateVerificationError("Update package is missing its Decky frontend bundle.")
      corrupt_member = archive.testzip()
      if corrupt_member is not None:
        raise UpdateVerificationError(f"Update package contains a corrupt ZIP member: {corrupt_member}.")
      package_data = _read_json_member(archive, f"{ARCHIVE_ROOT}/package.json")
      plugin_data = _read_json_member(archive, f"{ARCHIVE_ROOT}/plugin.json")
  except zipfile.BadZipFile as cause:
    raise UpdateVerificationError("Update package is not a valid ZIP archive.") from cause

  package_version = package_data.get("version")
  plugin_version = plugin_data.get("version")
  if package_version != manifest_version or plugin_version != manifest_version:
    raise UpdateVerificationError("Update package version does not match the manifest version. The package was not installed.")
  return {
    "version": manifest_version,
    "sha256": actual_sha256,
    "packageVersion": str(package_version),
    "pluginVersion": str(plugin_version),
  }


def download_and_verify_update(
  payload: Mapping[str, Any],
  *,
  ssl_context: ssl.SSLContext,
  urlopen: Callable[..., Any] = urllib.request.urlopen,
  temp_parent: Path | None = None,
) -> dict[str, str]:
  version, download_url, expected_sha256 = validate_update_request(payload)
  request = urllib.request.Request(
    download_url,
    headers={"Accept": "application/zip", "User-Agent": "Achievement-Companion-Updater"},
  )
  with tempfile.TemporaryDirectory(
    prefix="achievement-companion-update-",
    dir=str(temp_parent) if temp_parent is not None else None,
  ) as temp_dir:
    zip_path = Path(temp_dir) / "update.zip"
    _download_update(request, zip_path, ssl_context=ssl_context, urlopen=urlopen)
    return verify_update_package(zip_path, version, expected_sha256)


def _download_update(
  request: urllib.request.Request,
  zip_path: Path,
  *,
  ssl_context: ssl.SSLContext,
  urlopen: Callable[..., Any],
) -> None:
  try:
    with urlopen(request, timeout=30, context=ssl_context) as response, zip_path.open("wb") as destination:
      content_length = response.headers.get("Content-Length")
      if content_length is not None and int(content_length) > MAX_UPDATE_BYTES:
        raise UpdateVerificationError("Update package exceeds the maximum allowed size.")
      total = 0
      while True:
        chunk = response.read(1024 * 1024)
        if not chunk:
          break
        total += len(chunk)
        if total > MAX_UPDATE_BYTES:
          raise UpdateVerificationError("Update package exceeds the maximum allowed size.")
        destination.write(chunk)
  except UpdateVerificationError:
    raise
  except Exception as cause:
    raise UpdateVerificationError("Update package download failed.") from cause


def prepare_update_artifact(
  payload: Mapping[str, Any],
  *,
  ssl_context: ssl.SSLContext,
  urlopen: Callable[..., Any] = urllib.request.urlopen,
  temp_parent: Path | None = None,
) -> dict[str, str]:
  version, download_url, expected_sha256 = validate_update_request(payload)
  request = urllib.request.Request(
    download_url,
    headers={"Accept": "application/zip", "User-Agent": "Achievement-Companion-Updater"},
  )
  temporary_directory = tempfile.TemporaryDirectory(
    prefix="achievement-companion-update-",
    dir=str(temp_parent) if temp_parent is not None else None,
  )
  try:
    zip_path = Path(temporary_directory.name) / "update.zip"
    _download_update(request, zip_path, ssl_context=ssl_context, urlopen=urlopen)
    result = verify_update_package(zip_path, version, expected_sha256)
    result["fileUrl"] = zip_path.as_uri()
    with _prepared_artifacts_lock:
      _prepared_artifacts.append(temporary_directory)
    return result
  except BaseException:
    temporary_directory.cleanup()
    raise


def cleanup_prepared_update_artifacts() -> None:
  with _prepared_artifacts_lock:
    directories = _prepared_artifacts[:]
    _prepared_artifacts.clear()
  for directory in directories:
    directory.cleanup()
