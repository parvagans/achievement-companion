from __future__ import annotations

import hashlib
import json
import io
import ssl
import tempfile
import unittest
import zipfile
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse, unquote
from urllib.request import url2pathname

import _test_support  # noqa: F401
from backend import update

TEMP_ROOT = Path(__file__).resolve().parents[2] / ".tmp"
TEMP_ROOT.mkdir(parents=True, exist_ok=True)


def build_package(path: Path, version: str = "0.9.0") -> str:
  with zipfile.ZipFile(path, "w") as archive:
    archive.writestr("achievement-companion/main.py", "class Plugin: pass\n")
    archive.writestr("achievement-companion/package.json", json.dumps({"name": "fixture", "version": version}))
    archive.writestr("achievement-companion/plugin.json", json.dumps({"name": "Fixture", "version": version}))
    archive.writestr("achievement-companion/py_modules/backend/__init__.py", "")
    archive.writestr("achievement-companion/dist/index.js", "export default {};\n")
  return hashlib.sha256(path.read_bytes()).hexdigest()


class BackendUpdateTests(unittest.TestCase):
  def test_manifest_fetch_uses_backend_http_and_limits_response_size(self) -> None:
    manifest = {"schema": 1, "version": "0.31.3", "channel": "stable", "downloadUrl": "https://example.test/update.zip", "sha256": "a" * 64}
    payload = json.dumps(manifest).encode("utf-8")
    requests = []

    class Response:
      def __init__(self, body: bytes) -> None:
        self.stream = io.BytesIO(body)

      def __enter__(self):
        return self

      def __exit__(self, *_args):
        self.stream.close()

      def read(self, size: int) -> bytes:
        return self.stream.read(size)

    def open_manifest(request, **_kwargs):
      requests.append(request)
      return Response(payload)

    self.assertEqual(update.fetch_update_manifest(ssl_context=ssl.create_default_context(), urlopen=open_manifest), manifest)
    self.assertEqual(requests[0].full_url, update.PRODUCTION_UPDATE_MANIFEST_URL)
    with self.assertRaisesRegex(update.UpdateVerificationError, "maximum allowed size"):
      update.fetch_update_manifest(
        ssl_context=ssl.create_default_context(),
        urlopen=lambda *_args, **_kwargs: Response(b" " * (update.MAX_MANIFEST_BYTES + 1)),
      )

  def test_manifest_fetch_reports_http_failure(self) -> None:
    def fail(request, **_kwargs):
      raise HTTPError(request.full_url, 404, "Not Found", {}, None)

    with self.assertRaisesRegex(update.UpdateVerificationError, "HTTP 404"):
      update.fetch_update_manifest(ssl_context=ssl.create_default_context(), urlopen=fail)

  def test_prepared_package_is_retained_for_decky_and_cleaned_on_unload(self) -> None:
    with tempfile.TemporaryDirectory(dir=TEMP_ROOT) as directory:
      source = Path(directory) / "source.zip"
      checksum = build_package(source)

      class Response:
        headers = {"Content-Length": str(source.stat().st_size)}

        def __enter__(self):
          self.stream = io.BytesIO(source.read_bytes())
          return self

        def __exit__(self, *_args):
          self.stream.close()

        def read(self, size: int) -> bytes:
          return self.stream.read(size)

      result = update.prepare_update_artifact(
        {"version": "0.9.0", "downloadUrl": "https://example.test/update.zip", "sha256": checksum},
        ssl_context=ssl.create_default_context(),
        urlopen=lambda *_args, **_kwargs: Response(),
        temp_parent=Path(directory),
      )
      prepared = Path(url2pathname(unquote(urlparse(result["fileUrl"]).path)))
      try:
        self.assertTrue(prepared.is_file())
        self.assertEqual(prepared.read_bytes(), source.read_bytes())
      finally:
        update.cleanup_prepared_update_artifacts()
      self.assertFalse(prepared.exists())

  def test_valid_package_is_verified(self) -> None:
    with tempfile.TemporaryDirectory(dir=TEMP_ROOT) as directory:
      path = Path(directory) / "update.zip"
      checksum = build_package(path)
      result = update.verify_update_package(path, "0.9.0", checksum)
      self.assertEqual(result["version"], "0.9.0")
      self.assertEqual(result["sha256"], checksum)

  def test_checksum_mismatch_is_rejected(self) -> None:
    with tempfile.TemporaryDirectory(dir=TEMP_ROOT) as directory:
      path = Path(directory) / "update.zip"
      build_package(path)
      with self.assertRaisesRegex(update.UpdateVerificationError, "checksum mismatch"):
        update.verify_update_package(path, "0.9.0", "0" * 64)

  def test_package_version_mismatch_is_rejected(self) -> None:
    with tempfile.TemporaryDirectory(dir=TEMP_ROOT) as directory:
      path = Path(directory) / "update.zip"
      checksum = build_package(path, "0.8.9")
      with self.assertRaisesRegex(update.UpdateVerificationError, "does not match"):
        update.verify_update_package(path, "0.9.0", checksum)

  def test_unsafe_archive_path_is_rejected(self) -> None:
    with tempfile.TemporaryDirectory(dir=TEMP_ROOT) as directory:
      path = Path(directory) / "update.zip"
      with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("../escape", "bad")
      checksum = hashlib.sha256(path.read_bytes()).hexdigest()
      with self.assertRaisesRegex(update.UpdateVerificationError, "unsafe archive path"):
        update.verify_update_package(path, "0.9.0", checksum)

  def test_network_failure_and_timeout_fail_safely(self) -> None:
    payload = {"version": "0.9.0", "downloadUrl": "http://192.0.2.4:8765/update.zip", "sha256": "a" * 64}
    for cause in (OSError("server unavailable"), TimeoutError("timed out")):
      with self.subTest(cause=cause):
        def failed_urlopen(*_args, **_kwargs):
          raise cause
        with self.assertRaisesRegex(update.UpdateVerificationError, "download failed"):
          update.download_and_verify_update(payload, ssl_context=ssl.create_default_context(), urlopen=failed_urlopen, temp_parent=TEMP_ROOT)

  def test_missing_artifact_structure_is_rejected(self) -> None:
    with tempfile.TemporaryDirectory(dir=TEMP_ROOT) as directory:
      path = Path(directory) / "update.zip"
      with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("achievement-companion/package.json", "{}")
      checksum = hashlib.sha256(path.read_bytes()).hexdigest()
      with self.assertRaisesRegex(update.UpdateVerificationError, "missing required Decky files"):
        update.verify_update_package(path, "0.9.0", checksum)


if __name__ == "__main__":
  unittest.main()
