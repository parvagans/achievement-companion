from __future__ import annotations

import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend import steamos_doctor


def _write_repo_root_markers(root: Path) -> None:
  (root / "backend").mkdir(parents=True, exist_ok=True)
  (root / "package.json").write_text('{"name": "steam-deck-achievement-companion"}\n', encoding="utf-8")
  (root / "backend" / "dev_shell.py").write_text("# marker\n", encoding="utf-8")
  (root / "rollup.steamos.config.js").write_text("// marker\n", encoding="utf-8")


class SteamOSDoctorTests(unittest.TestCase):
  def test_missing_build_asset_reports_safe_guidance(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      _write_repo_root_markers(root)
      stdout = io.StringIO()

      exit_code = steamos_doctor.run_steamos_doctor(
        env={},
        home=root,
        cwd=root,
        repo_root=root,
        stdout=stdout,
      )

      output = stdout.getvalue()
      self.assertEqual(exit_code, 1)
      self.assertIn("SteamOS bootstrap asset", output)
      self.assertIn("npm run build:steamos", output)
      self.assertIn("XDG_RUNTIME_DIR missing", output)
      self.assertNotIn("Authorization", output)
      self.assertNotIn("Bearer abc", output)
      self.assertNotIn("super-secret-key", output)

  def test_present_build_asset_reports_safe_boolean_readiness(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      _write_repo_root_markers(root)
      (root / "dist-steamos").mkdir(parents=True, exist_ok=True)
      (root / "dist-steamos" / "steamos-bootstrap.js").write_text("\"use strict\";\n", encoding="utf-8")
      runtime_dir = root / "runtime"
      stdout = io.StringIO()

      exit_code = steamos_doctor.run_steamos_doctor(
        env={"XDG_RUNTIME_DIR": str(runtime_dir)},
        home=root,
        cwd=root,
        repo_root=root,
        stdout=stdout,
      )

      output = stdout.getvalue()
      self.assertEqual(exit_code, 0)
      self.assertIn("[PASS] SteamOS bootstrap asset", output)
      self.assertIn("[PASS] Runtime metadata directory", output)
      self.assertIn("provider config file present: no", output)
      self.assertIn("provider secrets file present: no", output)
      self.assertIn("retroachievements cache present: no", output)
      self.assertIn("steam cache present: no", output)
      self.assertIn("The standalone SteamOS shell is not the Decky release ZIP.", output)
      self.assertNotIn(str(root), output)

  def test_output_reports_presence_booleans_without_secret_contents(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      _write_repo_root_markers(root)
      (root / "dist-steamos").mkdir(parents=True, exist_ok=True)
      (root / "dist-steamos" / "steamos-bootstrap.js").write_text("\"use strict\";\n", encoding="utf-8")
      runtime_dir = root / "runtime"
      config_path = root / ".config" / "achievement-companion" / "provider-config.json"
      secrets_path = root / ".local" / "share" / "achievement-companion" / "provider-secrets.json"
      cache_dir = root / ".cache" / "achievement-companion" / "dashboard"
      config_path.parent.mkdir(parents=True, exist_ok=True)
      secrets_path.parent.mkdir(parents=True, exist_ok=True)
      cache_dir.mkdir(parents=True, exist_ok=True)
      config_path.write_text('{"retroAchievements":{"username":"sol88","hasApiKey":true}}\n', encoding="utf-8")
      secrets_path.write_text('{"ciphertext":"super-secret-key","token":"Bearer abc"}\n', encoding="utf-8")
      (cache_dir / "retroachievements.json").write_text('{"refreshedAt":1}\n', encoding="utf-8")
      (cache_dir / "steam.json").write_text('{"refreshedAt":2}\n', encoding="utf-8")
      stdout = io.StringIO()

      exit_code = steamos_doctor.run_steamos_doctor(
        env={"XDG_RUNTIME_DIR": str(runtime_dir)},
        home=root,
        cwd=root,
        repo_root=root,
        stdout=stdout,
      )

      output = stdout.getvalue()
      self.assertEqual(exit_code, 0)
      self.assertIn("provider config file present: yes", output)
      self.assertIn("provider secrets file present: yes", output)
      self.assertIn("retroachievements cache present: yes", output)
      self.assertIn("steam cache present: yes", output)
      self.assertNotIn("sol88", output)
      self.assertNotIn("super-secret-key", output)
      self.assertNotIn("Bearer abc", output)
      self.assertNotIn("76561198136628813", output)
      self.assertNotIn("provider-config.json", output)
      self.assertNotIn("provider-secrets.json", output)

  def test_doctor_does_not_start_shell_backend_or_provider_work(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      _write_repo_root_markers(root)
      stdout = io.StringIO()

      with patch("backend.local_launcher.start_local_backend", side_effect=AssertionError("must not start backend")), patch(
        "backend.dev_shell.start_steamos_dev_shell",
        side_effect=AssertionError("must not start shell"),
      ):
        exit_code = steamos_doctor.run_steamos_doctor(
          env={},
          home=root,
          cwd=root,
          repo_root=root,
          stdout=stdout,
        )

      self.assertEqual(exit_code, 1)

  def test_main_help_and_report_stay_secret_safe(self) -> None:
    help_stdout = io.StringIO()
    help_stderr = io.StringIO()
    with contextlib.redirect_stdout(help_stdout), contextlib.redirect_stderr(help_stderr):
      with self.assertRaises(SystemExit) as raised:
        steamos_doctor.main(["--help"])

    self.assertEqual(raised.exception.code, 0)
    self.assertIn("usage:", help_stdout.getvalue())
    self.assertNotIn("token", help_stdout.getvalue().lower())
    self.assertEqual(help_stderr.getvalue(), "")


if __name__ == "__main__":
  unittest.main()
