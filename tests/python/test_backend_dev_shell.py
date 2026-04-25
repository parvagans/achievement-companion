from __future__ import annotations

import contextlib
import io
import json
import os
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from backend import dev_shell
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


def _request(
  url: str,
  *,
  method: str = "GET",
  origin: str | None = None,
  headers: dict[str, str] | None = None,
) -> tuple[int, bytes, dict[str, str]]:
  request_headers = dict(headers or {})
  if origin is not None:
    request_headers["Origin"] = origin
  request = urllib.request.Request(url, headers=request_headers, method=method)
  try:
    with urllib.request.urlopen(request, timeout=5) as response:
      return response.status, response.read(), dict(response.headers.items())
  except urllib.error.HTTPError as error:
    return error.code, error.read(), dict(error.headers.items())


def _request_json(url: str, **kwargs: Any) -> tuple[int, dict[str, Any], dict[str, str]]:
  status, body, headers = _request(url, **kwargs)
  return status, json.loads(body.decode("utf-8")) if body else {}, headers


class SteamOSDevShellTests(unittest.TestCase):
  def test_dev_shell_starts_backend_and_serves_health(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      runtime = dev_shell.start_steamos_dev_shell(paths=paths)
      try:
        self.assertEqual(runtime.shell_host, "127.0.0.1")
        self.assertGreater(runtime.shell_port, 0)
        self.assertEqual(runtime.backend_runtime.host, "127.0.0.1")
        self.assertGreater(runtime.backend_runtime.port, 0)
        self.assertTrue(runtime.shell_thread.is_alive())
        self.assertTrue(runtime.backend_runtime.thread.is_alive())

        status, payload, _ = _request_json(f"{runtime.backend_url}/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["service"], "achievement-companion")
      finally:
        runtime.shutdown()

  def test_root_html_is_token_free_and_minimal(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      runtime = dev_shell.start_steamos_dev_shell(paths=paths)
      try:
        status, body, headers = _request(f"{runtime.shell_url}/")
        html = body.decode("utf-8")

        self.assertEqual(status, 200)
        self.assertIn("text/html", headers.get("Content-Type", ""))
        self.assertIn("Achievement Companion SteamOS dev shell", html)
        self.assertIn('id="root"', html)
        self.assertNotIn(runtime.backend_runtime.token, html)
        self.assertNotIn("provider-secrets", html)
        self.assertNotIn("apiKey", html)
        self.assertNotIn("Authorization", html)
        self.assertNotIn('"token"', html)
        self.assertNotIn('"startedAt"', html)
      finally:
        runtime.shutdown()

  def test_runtime_endpoint_returns_no_store_metadata_with_token_only_in_body(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      runtime = dev_shell.start_steamos_dev_shell(paths=paths)
      try:
        runtime_url = f"{runtime.shell_url}/__achievement_companion__/runtime"
        status, payload, headers = _request_json(runtime_url)

        self.assertEqual(status, 200)
        self.assertIn("application/json", headers.get("Content-Type", ""))
        self.assertEqual(headers.get("Cache-Control"), "no-store")
        self.assertEqual(payload["host"], "127.0.0.1")
        self.assertEqual(payload["port"], runtime.backend_runtime.port)
        self.assertEqual(payload["pid"], os.getpid())
        self.assertEqual(payload["startedAt"], runtime.backend_runtime.started_at)
        self.assertEqual(payload["token"], runtime.backend_runtime.token)
        self.assertNotIn(runtime.backend_runtime.token, runtime_url)
      finally:
        runtime.shutdown()

  def test_backend_cors_allows_only_exact_shell_origin_without_wildcard(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      runtime = dev_shell.start_steamos_dev_shell(paths=paths)
      try:
        status, _, headers = _request(f"{runtime.backend_url}/health", origin=runtime.shell_url)
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), runtime.shell_url)
        self.assertNotEqual(headers.get("Access-Control-Allow-Origin"), "*")

        status, payload, headers = _request_json(
          f"{runtime.backend_url}/get_provider_configs",
          method="OPTIONS",
          origin=runtime.shell_url,
          headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
          },
        )
        self.assertEqual(status, 204)
        self.assertEqual(payload, {})
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), runtime.shell_url)
        self.assertNotEqual(headers.get("Access-Control-Allow-Origin"), "*")

        status, payload, headers = _request_json(
          f"{runtime.backend_url}/get_provider_configs",
          method="OPTIONS",
          origin="http://127.0.0.1:9",
          headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
          },
        )
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"], "origin_forbidden")
        self.assertNotIn("Access-Control-Allow-Origin", headers)
      finally:
        runtime.shutdown()

  def test_shutdown_stops_threads_and_removes_metadata(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      runtime = dev_shell.start_steamos_dev_shell(paths=paths)
      metadata_path = paths.runtime_metadata_path
      self.assertTrue(metadata_path.is_file())

      runtime.shutdown()

      self.assertFalse(runtime.shell_thread.is_alive())
      self.assertFalse(runtime.backend_runtime.thread.is_alive())
      self.assertFalse(metadata_path.exists())

  def test_static_safety_rejects_unknown_paths_and_traversal(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      runtime = dev_shell.start_steamos_dev_shell(paths=paths)
      try:
        status, payload, _ = _request_json(f"{runtime.shell_url}/missing.js")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"], "not_found")

        for unsafe_path in ("/../backend/dev_shell.py", "/%2e%2e/backend/dev_shell.py", "/foo\\bar"):
          status, payload, _ = _request_json(f"{runtime.shell_url}{unsafe_path}")
          self.assertIn(status, {400, 404})
          self.assertIn(payload["error"], {"invalid_path", "not_found"})
      finally:
        runtime.shutdown()

  def test_cli_help_and_once_output_are_token_free(self) -> None:
    help_stdout = io.StringIO()
    help_stderr = io.StringIO()
    with contextlib.redirect_stdout(help_stdout), contextlib.redirect_stderr(help_stderr):
      with self.assertRaises(SystemExit) as raised:
        dev_shell.main(["--help"])

    self.assertEqual(raised.exception.code, 0)
    self.assertIn("usage:", help_stdout.getvalue())
    self.assertNotIn("token", help_stdout.getvalue().lower())
    self.assertEqual(help_stderr.getvalue(), "")

    with tempfile.TemporaryDirectory() as temp_dir:
      metadata_path = Path(temp_dir) / "runtime" / "backend.json"
      once_stdout = io.StringIO()
      once_stderr = io.StringIO()
      with contextlib.redirect_stdout(once_stdout), contextlib.redirect_stderr(once_stderr):
        exit_code = dev_shell.main(["--once", "--metadata-path", str(metadata_path)])

      self.assertEqual(exit_code, 0)
      self.assertIn("SteamOS dev shell listening on http://127.0.0.1:", once_stdout.getvalue())
      self.assertIn("Local backend listening on http://127.0.0.1:", once_stdout.getvalue())
      self.assertNotIn("token", once_stdout.getvalue().lower())
      self.assertEqual(once_stderr.getvalue(), "")
      self.assertFalse(metadata_path.exists())

  def test_dev_shell_stays_out_of_decky_boundaries_and_release_payload(self) -> None:
    source = (ROOT_DIR / "backend" / "dev_shell.py").read_text(encoding="utf-8")
    package_release = (ROOT_DIR / "scripts" / "package_release.py").read_text(encoding="utf-8")
    check_release = (ROOT_DIR / "scripts" / "check_release_artifact.py").read_text(encoding="utf-8")

    self.assertNotIn("import decky", source)
    self.assertNotIn("from decky", source)
    self.assertNotIn("import main", source)
    self.assertNotIn("from main import", source)
    self.assertNotIn("OneDrive", source)
    for steam_os_only_path in (
      "backend/dev_shell.py",
      "backend/local_launcher.py",
      "backend/local_server.py",
      "backend/paths.py",
      "backend/cache.py",
    ):
      self.assertNotIn(steam_os_only_path, package_release)
      self.assertNotIn(steam_os_only_path, check_release)


if __name__ == "__main__":
  unittest.main()
