from __future__ import annotations

import sys
import zipfile
from pathlib import Path

from package_release import ROOT_DIR, read_package_version

EXPECTED_RELEASE_ARCHIVE_NAMES = {
  "achievement-companion/LICENSE",
  "achievement-companion/README.md",
  "achievement-companion/THIRD_PARTY_NOTICES.md",
  "achievement-companion/backend/__init__.py",
  "achievement-companion/backend/redaction.py",
  "achievement-companion/backend/secrets.py",
  "achievement-companion/backend/provider_config.py",
  "achievement-companion/backend/storage.py",
  "achievement-companion/dist/index.js",
  "achievement-companion/main.py",
  "achievement-companion/package.json",
  "achievement-companion/plugin.json",
}


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


def main(argv: list[str] | None = None) -> int:
  del argv
  zip_path = get_release_zip_path()
  if not zip_path.exists():
    raise RuntimeError(f"Release artifact does not exist: {zip_path}")

  verify_release_zip_payload(zip_path)
  print(zip_path)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
