from __future__ import annotations

import os
import shutil
import sys
import tarfile
from pathlib import Path
from typing import Iterable


ROOT_DIR = Path(__file__).resolve().parents[1]
RELEASE_DIR = ROOT_DIR / "release"
STEAMOS_PREVIEW_ROOT_DIRNAME = "achievement-companion-steamos"
STEAMOS_PREVIEW_VERSION = "0.3.0"
STEAMOS_PREVIEW_ARCHIVE_NAME = f"achievement-companion-steamos-preview-v{STEAMOS_PREVIEW_VERSION}.tar.gz"
STEAMOS_PREVIEW_STAGE_DIR = RELEASE_DIR / "staged" / STEAMOS_PREVIEW_ROOT_DIRNAME
STEAMOS_PREVIEW_SOURCE_TO_STAGE_PATHS: dict[Path, Path] = {
  Path("backend/__init__.py"): Path("backend/__init__.py"),
  Path("backend/cache.py"): Path("backend/cache.py"),
  Path("backend/dev_shell.py"): Path("backend/dev_shell.py"),
  Path("backend/diagnostics.py"): Path("backend/diagnostics.py"),
  Path("backend/http.py"): Path("backend/http.py"),
  Path("backend/local_launcher.py"): Path("backend/local_launcher.py"),
  Path("backend/local_server.py"): Path("backend/local_server.py"),
  Path("backend/paths.py"): Path("backend/paths.py"),
  Path("backend/provider_config.py"): Path("backend/provider_config.py"),
  Path("backend/redaction.py"): Path("backend/redaction.py"),
  Path("backend/secrets.py"): Path("backend/secrets.py"),
  Path("backend/steamos_doctor.py"): Path("backend/steamos_doctor.py"),
  Path("backend/storage.py"): Path("backend/storage.py"),
  Path("backend/tls.py"): Path("backend/tls.py"),
  Path("dist-steamos/steamos-bootstrap.js"): Path("dist-steamos/steamos-bootstrap.js"),
  Path("scripts/steamos-preview/start-steamos.sh"): Path("scripts/start-steamos.sh"),
  Path("scripts/steamos-preview/doctor-steamos.sh"): Path("scripts/doctor-steamos.sh"),
  Path("docs/steamos-preview-readme.md"): Path("STEAMOS_PREVIEW_README.md"),
  Path("LICENSE"): Path("LICENSE"),
  Path("THIRD_PARTY_NOTICES.md"): Path("THIRD_PARTY_NOTICES.md"),
}
STEAMOS_PREVIEW_EXECUTABLE_STAGE_PATHS = {
  Path("scripts/start-steamos.sh"),
  Path("scripts/doctor-steamos.sh"),
}


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


def get_steamos_preview_tarball_path(
  *,
  root_dir: Path = ROOT_DIR,
  release_dir: Path | None = None,
) -> Path:
  del root_dir
  target_release_dir = release_dir or RELEASE_DIR
  return target_release_dir / STEAMOS_PREVIEW_ARCHIVE_NAME


def _copy_required_file(root_dir: Path, stage_dir: Path, source_relative_path: Path, stage_relative_path: Path) -> None:
  source_path = root_dir / source_relative_path
  if not source_path.is_file():
    raise FileNotFoundError(f"Required SteamOS preview file is missing: {source_relative_path.as_posix()}")

  destination_path = stage_dir / stage_relative_path
  destination_path.parent.mkdir(parents=True, exist_ok=True)
  shutil.copy2(source_path, destination_path)


def stage_steamos_preview_package(
  *,
  root_dir: Path = ROOT_DIR,
  stage_dir: Path = STEAMOS_PREVIEW_STAGE_DIR,
) -> Path:
  if stage_dir.exists():
    _remove_tree(stage_dir)

  stage_dir.mkdir(parents=True, exist_ok=True)
  for source_relative_path, stage_relative_path in STEAMOS_PREVIEW_SOURCE_TO_STAGE_PATHS.items():
    _copy_required_file(root_dir, stage_dir, source_relative_path, stage_relative_path)

  return stage_dir


def verify_staged_steamos_preview_package(stage_dir: Path = STEAMOS_PREVIEW_STAGE_DIR) -> None:
  for required_stage_path in STEAMOS_PREVIEW_SOURCE_TO_STAGE_PATHS.values():
    if not (stage_dir / required_stage_path).is_file():
      raise RuntimeError(
        f"Staged SteamOS preview output is missing {required_stage_path.as_posix()}."
      )


def _normalize_tar_info(member: tarfile.TarInfo) -> tarfile.TarInfo:
  member.uid = 0
  member.gid = 0
  member.uname = ""
  member.gname = ""
  if member.isdir():
    member.mode = 0o755
  elif member.name.endswith(".sh"):
    member.mode = 0o755
  else:
    member.mode = 0o644
  return member


def create_steamos_preview_tarball(
  *,
  root_dir: Path = ROOT_DIR,
  release_dir: Path = RELEASE_DIR,
  stage_dir: Path = STEAMOS_PREVIEW_STAGE_DIR,
) -> Path:
  del root_dir
  release_dir.mkdir(parents=True, exist_ok=True)
  tarball_path = get_steamos_preview_tarball_path(release_dir=release_dir)
  if tarball_path.exists():
    tarball_path.unlink()

  with tarfile.open(tarball_path, "w:gz") as archive:
    archive.add(stage_dir, arcname=STEAMOS_PREVIEW_ROOT_DIRNAME, recursive=False, filter=_normalize_tar_info)
    for file_path in sorted(path for path in stage_dir.rglob("*") if path.is_file()):
      archive.add(
        file_path,
        arcname=f"{STEAMOS_PREVIEW_ROOT_DIRNAME}/{file_path.relative_to(stage_dir).as_posix()}",
        filter=_normalize_tar_info,
      )

  return tarball_path


def build_steamos_preview_package(root_dir: Path = ROOT_DIR) -> tuple[Path, Path]:
  stage_dir = stage_steamos_preview_package(root_dir=root_dir)
  verify_staged_steamos_preview_package(stage_dir)
  tarball_path = create_steamos_preview_tarball(root_dir=root_dir, stage_dir=stage_dir)
  return stage_dir, tarball_path


def main(argv: Iterable[str] | None = None) -> int:
  del argv
  _, tarball_path = build_steamos_preview_package(ROOT_DIR)
  print(tarball_path)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
