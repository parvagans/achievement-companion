from __future__ import annotations

import json
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT_DIR = ROOT_DIR / "scripts"
if str(SCRIPT_DIR) not in sys.path:
  sys.path.insert(0, str(SCRIPT_DIR))

import check_steamos_preview_artifact  # type: ignore  # noqa: E402
import package_steamos_preview  # type: ignore  # noqa: E402


def _write_text(path: Path, text: str) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(text, encoding="utf-8")


def _create_preview_source_tree(root_dir: Path) -> None:
  for source_relative_path in package_steamos_preview.STEAMOS_PREVIEW_SOURCE_TO_STAGE_PATHS:
    target_path = root_dir / source_relative_path
    if target_path.suffix == ".json":
      _write_text(target_path, json.dumps({"ok": True}) + "\n")
      continue
    if target_path.suffix == ".sh":
      _write_text(target_path, "#!/usr/bin/env sh\nset -eu\nexec python3 -m backend.dev_shell --xdg-root .tmp-steamos-preview\n")
      continue
    _write_text(target_path, f"placeholder for {source_relative_path.as_posix()}\n")


class SteamOSPreviewPackagingTests(unittest.TestCase):
  def test_stage_and_tarball_include_expected_preview_runtime_files(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root_dir = Path(temp_dir) / "root"
      release_dir = Path(temp_dir) / "release"
      stage_dir = release_dir / "staged" / package_steamos_preview.STEAMOS_PREVIEW_ROOT_DIRNAME
      _create_preview_source_tree(root_dir)

      staged_dir = package_steamos_preview.stage_steamos_preview_package(
        root_dir=root_dir,
        stage_dir=stage_dir,
      )
      package_steamos_preview.verify_staged_steamos_preview_package(staged_dir)

      self.assertTrue((staged_dir / "backend" / "dev_shell.py").exists())
      self.assertTrue((staged_dir / "backend" / "steamos_doctor.py").exists())
      self.assertTrue((staged_dir / "dist-steamos" / "steamos-bootstrap.js").exists())
      self.assertTrue((staged_dir / "scripts" / "start-steamos.sh").exists())
      self.assertTrue((staged_dir / "scripts" / "doctor-steamos.sh").exists())
      self.assertTrue((staged_dir / "STEAMOS_PREVIEW_README.md").exists())
      self.assertFalse((staged_dir / "plugin.json").exists())
      self.assertFalse((staged_dir / "provider-config.json").exists())
      self.assertFalse((staged_dir / "provider-secrets.json").exists())

      tarball_path = package_steamos_preview.create_steamos_preview_tarball(
        root_dir=root_dir,
        release_dir=release_dir,
        stage_dir=staged_dir,
      )
      check_steamos_preview_artifact.verify_steamos_preview_tarball_payload(tarball_path)
      check_steamos_preview_artifact.verify_steamos_preview_tarball_exclusions(tarball_path)

      with tarfile.open(tarball_path, "r:gz") as archive:
        names = set(archive.getnames())
        self.assertIn(package_steamos_preview.STEAMOS_PREVIEW_ROOT_DIRNAME, names)
        self.assertIn(
          "achievement-companion-steamos/backend/local_server.py",
          names,
        )
        self.assertIn(
          "achievement-companion-steamos/dist-steamos/steamos-bootstrap.js",
          names,
        )
        self.assertIn(
          "achievement-companion-steamos/scripts/start-steamos.sh",
          names,
        )
        self.assertNotIn("achievement-companion-steamos/plugin.json", names)
        self.assertNotIn("achievement-companion-steamos/provider-config.json", names)
        self.assertNotIn("achievement-companion-steamos/provider-secrets.json", names)


if __name__ == "__main__":
  unittest.main()
