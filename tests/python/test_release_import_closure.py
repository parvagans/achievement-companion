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


class ReleaseRuntimeImportClosureTests(unittest.TestCase):
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
