from __future__ import annotations

import contextlib
import io
import json
import os
import stat
import tempfile
import unittest
import urllib.request
from pathlib import Path
from typing import Any

from backend import local_launcher, local_server
from backend.paths import BackendPaths


ROOT_DIR = Path(__file__).resolve().parents[2]


def _build_test_backend_paths(root: Path) -> BackendPaths:
  return BackendPaths(
    config_path=root / "config" / "achievement-companion" / "provider-config.json",
    secrets_path=root / "data" / "achievement-companion" / "provider-secrets.json",
    logs_dir=root / "state" / "achievement-companion" / "logs",
    dashboard_cache_dir=root / "cache" / "achievement-companion" / "dashboard",
    steam_scan_overview_path=root / "cache" / "achievement-companion" / "steam" / "library-achievement-scan-overview.json",
    steam_scan_summary_path=root / "cache" / "achievement-companion" / "steam" / "library-achievement-scan-summary.json",
    runtime_metadata_path=root / "runtime" / "achievement-companion" / "backend.json",
  )


def _request_json(url: str) -> dict[str, Any]:
  with urllib.request.urlopen(url, timeout=5) as response:
    return json.loads(response.read().decode("utf-8"))


class LocalBackendLauncherTests(unittest.TestCase):
  def test_start_local_backend_writes_runtime_metadata_without_printing_token(self) -> None:
    stdout = io.StringIO()
    stderr = io.StringIO()
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))

      with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        runtime = local_launcher.start_local_backend(paths=paths)

      try:
        self.assertEqual(runtime.host, "127.0.0.1")
        self.assertGreater(runtime.port, 0)
        self.assertEqual(runtime.base_url, f"http://127.0.0.1:{runtime.port}")
        self.assertTrue(runtime.thread.is_alive())
        self.assertTrue(paths.runtime_metadata_path.is_file())

        metadata = json.loads(paths.runtime_metadata_path.read_text(encoding="utf-8"))
        self.assertEqual(metadata["host"], "127.0.0.1")
        self.assertEqual(metadata["port"], runtime.port)
        self.assertEqual(metadata["pid"], os.getpid())
        self.assertEqual(metadata["token"], runtime.token)
        self.assertIsInstance(metadata["startedAt"], str)
        self.assertTrue(paths.config_path.parent.is_dir())
        self.assertTrue(paths.secrets_path.parent.is_dir())
        self.assertTrue(paths.logs_dir.is_dir())
        self.assertTrue(paths.dashboard_cache_dir.is_dir())
        self.assertTrue(paths.steam_scan_overview_path.parent.is_dir())
        self.assertTrue(paths.steam_scan_summary_path.parent.is_dir())
        self.assertTrue(paths.runtime_metadata_path is not None and paths.runtime_metadata_path.parent.is_dir())
        self.assertNotIn(runtime.token, stdout.getvalue())
        self.assertNotIn(runtime.token, stderr.getvalue())
        if os.name != "nt":
          self.assertEqual(stat.S_IMODE(paths.runtime_metadata_path.stat().st_mode), 0o600)
          self.assertEqual(stat.S_IMODE(paths.runtime_metadata_path.parent.stat().st_mode), 0o700)
      finally:
        runtime.shutdown()

  def test_launched_runtime_serves_health_and_shuts_down_cleanly(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      runtime = local_launcher.start_local_backend(paths=paths)
      try:
        payload = _request_json(f"{runtime.base_url}/health")
        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["service"], "achievement-companion")
        self.assertIn("health", payload["capabilities"])
        self.assertNotIn(runtime.token, json.dumps(payload))
      finally:
        runtime.shutdown()

      self.assertFalse(runtime.thread.is_alive())
      self.assertFalse(paths.runtime_metadata_path.exists())

  def test_missing_xdg_runtime_dir_refuses_implicit_metadata_location(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)

      with self.assertRaises(RuntimeError) as raised:
        local_launcher.start_local_backend(env={}, home=root)

      self.assertIn("XDG_RUNTIME_DIR is required", str(raised.exception))
      self.assertIn("Set XDG_RUNTIME_DIR", str(raised.exception))
      self.assertFalse((root / ".cache" / "achievement-companion" / "backend.json").exists())
      self.assertFalse((root / ".config" / "achievement-companion" / "backend.json").exists())

  def test_explicit_metadata_path_allows_test_launch_without_xdg_runtime_dir(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      metadata_path = root / "explicit-runtime" / "backend.json"
      runtime = local_launcher.start_local_backend(
        env={},
        home=root,
        metadata_path=metadata_path,
      )
      try:
        self.assertTrue(metadata_path.is_file())
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        self.assertEqual(metadata["token"], runtime.token)
      finally:
        runtime.shutdown()

  def test_run_local_backend_once_honors_injected_xdg_runtime_dir(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      env = {
        "XDG_CONFIG_HOME": str(root / "config"),
        "XDG_DATA_HOME": str(root / "data"),
        "XDG_STATE_HOME": str(root / "state"),
        "XDG_CACHE_HOME": str(root / "cache"),
        "XDG_RUNTIME_DIR": str(root / "runtime"),
      }
      expected_metadata_path = root / "runtime" / "achievement-companion" / "backend.json"
      once_stdout = io.StringIO()
      once_stderr = io.StringIO()

      with contextlib.redirect_stdout(once_stdout), contextlib.redirect_stderr(once_stderr):
        exit_code = local_launcher.run_local_backend(env=env, home=root, once=True)

      self.assertEqual(exit_code, 0)
      self.assertIn("127.0.0.1", once_stdout.getvalue())
      self.assertIn(str(expected_metadata_path), once_stdout.getvalue())
      self.assertIn("Local backend health available at http://127.0.0.1:", once_stdout.getvalue())
      self.assertNotIn("token", once_stdout.getvalue().lower())
      self.assertEqual(once_stderr.getvalue(), "")
      self.assertFalse(expected_metadata_path.exists())

  def test_cli_help_and_once_output_do_not_print_token(self) -> None:
    help_stdout = io.StringIO()
    help_stderr = io.StringIO()
    with contextlib.redirect_stdout(help_stdout), contextlib.redirect_stderr(help_stderr):
      with self.assertRaises(SystemExit) as raised:
        local_launcher.main(["--help"])

    self.assertEqual(raised.exception.code, 0)
    self.assertIn("usage:", help_stdout.getvalue())
    self.assertNotIn("token", help_stdout.getvalue().lower())
    self.assertEqual(help_stderr.getvalue(), "")

    with tempfile.TemporaryDirectory() as temp_dir:
      metadata_path = Path(temp_dir) / "runtime" / "backend.json"
      once_stdout = io.StringIO()
      once_stderr = io.StringIO()
      with contextlib.redirect_stdout(once_stdout), contextlib.redirect_stderr(once_stderr):
        exit_code = local_launcher.main(["--once", "--metadata-path", str(metadata_path)])

      self.assertEqual(exit_code, 0)
      self.assertIn("127.0.0.1", once_stdout.getvalue())
      self.assertIn(str(metadata_path), once_stdout.getvalue())
      self.assertIn("Local backend health available at http://127.0.0.1:", once_stdout.getvalue())
      self.assertFalse(metadata_path.exists())
      self.assertNotIn("token", once_stdout.getvalue().lower())
      self.assertEqual(once_stderr.getvalue(), "")

  def test_launch_does_not_call_provider_requester(self) -> None:
    calls: list[str] = []

    def provider_requester(**kwargs: Any) -> dict[str, Any]:
      del kwargs
      calls.append("called")
      raise AssertionError("provider requester should not run during launch")

    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      paths = _build_test_backend_paths(root)
      context = local_server.create_local_backend_context(
        paths=paths,
        settings_dir_text="launcher-test-settings",
        provider_requester=provider_requester,
      )
      runtime = local_launcher.start_local_backend(paths=paths, context=context)
      try:
        self.assertEqual(calls, [])
      finally:
        runtime.shutdown()

  def test_local_launcher_stays_out_of_decky_boundaries_and_release_payload(self) -> None:
    source = (ROOT_DIR / "backend" / "local_launcher.py").read_text(encoding="utf-8")
    package_release = (ROOT_DIR / "scripts" / "package_release.py").read_text(encoding="utf-8")
    check_release = (ROOT_DIR / "scripts" / "check_release_artifact.py").read_text(encoding="utf-8")

    self.assertNotIn("import decky", source)
    self.assertNotIn("from decky", source)
    self.assertNotIn("import main", source)
    self.assertNotIn("from main import", source)
    self.assertNotIn("OneDrive", source)
    self.assertNotIn("backend/local_launcher.py", package_release)
    self.assertNotIn("backend/local_launcher.py", check_release)
    self.assertNotIn("backend/local_server.py", package_release)
    self.assertNotIn("backend/local_server.py", check_release)
    self.assertNotIn("backend/paths.py", package_release)
    self.assertNotIn("backend/paths.py", check_release)


if __name__ == "__main__":
  unittest.main()
