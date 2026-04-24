from __future__ import annotations

import json
import os
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Iterable

ROOT_DIR = Path(__file__).resolve().parents[1]
RELEASE_DIR = ROOT_DIR / "release"
STAGE_DIR = RELEASE_DIR / "staged" / "achievement-companion"
REQUIRED_RELATIVE_PATHS: tuple[Path, ...] = (
  Path("main.py"),
  Path("backend/__init__.py"),
  Path("backend/redaction.py"),
  Path("backend/storage.py"),
  Path("package.json"),
  Path("plugin.json"),
  Path("README.md"),
  Path("LICENSE"),
  Path("THIRD_PARTY_NOTICES.md"),
  Path("dist/index.js"),
)


def read_package_version(root_dir: Path = ROOT_DIR) -> str:
  package_json_path = root_dir / "package.json"
  package_data = json.loads(package_json_path.read_text(encoding="utf-8"))
  version = package_data.get("version")
  if not isinstance(version, str) or version.strip() == "":
    raise RuntimeError("package.json version is missing.")
  return version.strip()


def _copy_required_file(root_dir: Path, stage_dir: Path, relative_path: Path) -> None:
  source_path = root_dir / relative_path
  if not source_path.exists():
    raise FileNotFoundError(f"Required release file is missing: {relative_path.as_posix()}")

  destination_path = stage_dir / relative_path
  destination_path.parent.mkdir(parents=True, exist_ok=True)
  shutil.copy2(source_path, destination_path)


def _remove_tree(path: Path) -> None:
  if not path.exists():
    return

  def handle_remove_error(func, target_path, exc_info):  # noqa: ANN001
    del exc_info
    try:
      os.chmod(target_path, 0o700)
    except OSError:
      pass
    func(target_path)

  shutil.rmtree(path, onerror=handle_remove_error)


def stage_release_package(root_dir: Path = ROOT_DIR, stage_dir: Path = STAGE_DIR) -> Path:
  if stage_dir.exists():
    _remove_tree(stage_dir)

  stage_dir.mkdir(parents=True, exist_ok=True)
  for relative_path in REQUIRED_RELATIVE_PATHS:
    _copy_required_file(root_dir, stage_dir, relative_path)

  if not (stage_dir / "main.py").exists():
    raise RuntimeError("Staged release output is missing main.py.")
  if not (stage_dir / "backend" / "__init__.py").exists():
    raise RuntimeError("Staged release output is missing backend/__init__.py.")

  return stage_dir


def verify_staged_release_package(stage_dir: Path = STAGE_DIR) -> None:
  if not (stage_dir / "main.py").exists():
    raise RuntimeError("Staged release output is missing main.py.")
  if not (stage_dir / "backend" / "__init__.py").exists():
    raise RuntimeError("Staged release output is missing backend/__init__.py.")


def create_release_zip(
  *,
  root_dir: Path = ROOT_DIR,
  release_dir: Path = RELEASE_DIR,
  stage_dir: Path = STAGE_DIR,
) -> Path:
  release_dir.mkdir(parents=True, exist_ok=True)
  version = read_package_version(root_dir)
  zip_path = release_dir / f"achievement-companion-v{version}.zip"
  if zip_path.exists():
    zip_path.unlink()

  with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for file_path in sorted(path for path in stage_dir.rglob("*") if path.is_file()):
      archive.write(file_path, arcname=f"achievement-companion/{file_path.relative_to(stage_dir).as_posix()}")

  return zip_path


def build_release_package(root_dir: Path = ROOT_DIR) -> tuple[Path, Path]:
  stage_dir = stage_release_package(root_dir=root_dir)
  verify_staged_release_package(stage_dir)
  zip_path = create_release_zip(root_dir=root_dir, stage_dir=stage_dir)
  return stage_dir, zip_path


def main(argv: Iterable[str] | None = None) -> int:
  del argv
  _, zip_path = build_release_package(ROOT_DIR)
  print(zip_path)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
