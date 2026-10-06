from __future__ import annotations

import hashlib
import json
import ssl
import tempfile
import unittest
import zipfile
from pathlib import Path

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
