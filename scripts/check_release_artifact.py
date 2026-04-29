from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

from package_release import ROOT_DIR, read_package_version

EXPECTED_RELEASE_ARCHIVE_NAMES = {
  "achievement-companion/LICENSE",
  "achievement-companion/README.md",
  "achievement-companion/THIRD_PARTY_NOTICES.md",
  "achievement-companion/backend/__init__.py",
  "achievement-companion/backend/http.py",
  "achievement-companion/backend/diagnostics.py",
  "achievement-companion/backend/redaction.py",
  "achievement-companion/backend/secrets.py",
  "achievement-companion/backend/provider_config.py",
  "achievement-companion/backend/storage.py",
  "achievement-companion/backend/tls.py",
  "achievement-companion/dist/index.js",
  "achievement-companion/main.py",
  "achievement-companion/package.json",
  "achievement-companion/plugin.json",
}
PACKAGE_JSON_RELEASE_FORBIDDEN_MARKERS = (
  "build:steamos",
  "start:steamos",
  "doctor:steamos",
  "steamos_doctor",
  "dev_shell",
  "local_launcher",
  "local_server",
  "--xdg-root",
)
PACKAGE_JSON_REQUIRED_FIELDS = (
  "name",
  "version",
)


def get_release_zip_path(root_dir: Path = ROOT_DIR) -> Path:
  version = read_package_version(root_dir)
  return root_dir / "release" / f"achievement-companion-v{version}.zip"


def verify_release_zip_payload(zip_path: Path) -> None:
  with zipfile.ZipFile(zip_path) as archive:
    names = set(archive.namelist())

  missing_names = sorted(EXPECTED_RELEASE_ARCHIVE_NAMES - names)
  unexpected_names = sorted(names - EXPECTED_RELEASE_ARCHIVE_NAMES)
  if missing_names or unexpected_names:
    problems: list[str] = []
    if missing_names:
      problems.append(f"missing: {', '.join(missing_names)}")
    if unexpected_names:
      problems.append(f"unexpected: {', '.join(unexpected_names)}")
    raise RuntimeError(f"Release artifact payload mismatch ({'; '.join(problems)}).")


def verify_release_package_json(zip_path: Path) -> None:
  with zipfile.ZipFile(zip_path) as archive:
    package_json_bytes = archive.read("achievement-companion/package.json")

  package_json_text = package_json_bytes.decode("utf-8")
  package_data = json.loads(package_json_text)

  missing_fields = [
    field_name
    for field_name in PACKAGE_JSON_REQUIRED_FIELDS
    if not isinstance(package_data.get(field_name), str) or package_data[field_name].strip() == ""
  ]
  if missing_fields:
    raise RuntimeError(
      f"Release package.json is missing required string fields: {', '.join(missing_fields)}."
    )

  if package_data["version"].strip() != read_package_version():
    raise RuntimeError("Release package.json version does not match the source package version.")

  forbidden_markers = [
    marker
    for marker in PACKAGE_JSON_RELEASE_FORBIDDEN_MARKERS
    if marker in package_json_text
  ]
  if forbidden_markers:
    raise RuntimeError(
      "Release package.json still exposes SteamOS-only helpers or markers: "
      + ", ".join(forbidden_markers)
      + "."
    )


def main(argv: list[str] | None = None) -> int:
  del argv
  zip_path = get_release_zip_path()
  if not zip_path.exists():
    raise RuntimeError(f"Release artifact does not exist: {zip_path}")

  verify_release_zip_payload(zip_path)
  verify_release_package_json(zip_path)
  print(zip_path)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
