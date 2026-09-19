from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT_DIR = ROOT_DIR / "scripts"
if str(SCRIPT_DIR) not in sys.path:
  sys.path.insert(0, str(SCRIPT_DIR))

import check_release_artifact  # type: ignore  # noqa: E402
import package_release  # type: ignore  # noqa: E402


class ReleaseRuntimeImportClosureTests(unittest.TestCase):
  def test_nested_dist_runtime_assets_are_staged_and_validated(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root_dir = Path(temp_dir)
      dist_dir = root_dir / "dist"
      asset_path = dist_dir / "assets" / "trophy-1234.svg"
      bundle_path = dist_dir / "index.js"
      source_map_path = dist_dir / "index.js.map"
      bundle_path.parent.mkdir(parents=True)
      asset_path.parent.mkdir(parents=True)
      bundle_path.write_text("export default {};\n", encoding="utf-8")
      asset_path.write_text("<svg />\n", encoding="utf-8")
      source_map_path.write_text("{}\n", encoding="utf-8")

      stage_dir = root_dir / "stage"
      package_release._copy_dist_bundle_files(root_dir, stage_dir)

      self.assertEqual(
        (stage_dir / "dist" / "index.js").read_text(encoding="utf-8"),
        bundle_path.read_text(encoding="utf-8"),
      )
      self.assertEqual(
        (stage_dir / "dist" / "assets" / "trophy-1234.svg").read_text(encoding="utf-8"),
        asset_path.read_text(encoding="utf-8"),
      )
      self.assertFalse((stage_dir / "dist" / "index.js.map").exists())
      self.assertEqual(
        check_release_artifact.get_expected_dist_archive_names(root_dir),
        {
          "achievement-companion/dist/index.js",
          "achievement-companion/dist/assets/trophy-1234.svg",
        },
      )

  def test_missing_transitive_runtime_module_fails_validation(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      zip_path = Path(temp_dir) / "release.zip"
      with zipfile.ZipFile(zip_path, "w") as archive:
        archive.writestr(
          "achievement-companion/main.py",
          "from backend.http import request_json\n",
        )
        archive.writestr(
          "achievement-companion/py_modules/backend/__init__.py",
          "",
        )
        archive.writestr(
          "achievement-companion/py_modules/backend/http.py",
          "from backend.redaction import redact_text\n",
        )

      with self.assertRaisesRegex(
        RuntimeError,
        r"backend\.redaction required by backend\.http.*py_modules/backend/redaction\.py",
      ):
        check_release_artifact.verify_release_runtime_import_closure(zip_path)


if __name__ == "__main__":
  unittest.main()
