from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Any

from backend import dev_shell, local_server
from backend.paths import BackendPaths


ROOT_DIR = Path(__file__).resolve().parents[2]
STEAMOS_DIST_DIR = ROOT_DIR / "dist-steamos"
STEAMOS_BOOTSTRAP_ASSET = STEAMOS_DIST_DIR / "steamos-bootstrap.js"


def _resolve_pnpm_command() -> str:
  pnpm_command = shutil.which("pnpm") or shutil.which("pnpm.cmd")
  if pnpm_command is None:
    raise RuntimeError("pnpm is required for the SteamOS dev shell live bootstrap smoke test.")
  return pnpm_command


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


def _remove_steamos_dist() -> None:
  resolved_dist = STEAMOS_DIST_DIR.resolve()
  if resolved_dist == ROOT_DIR.resolve() or ROOT_DIR.resolve() not in resolved_dist.parents:
    raise AssertionError(f"Refusing to remove unexpected SteamOS dist path: {resolved_dist}")
  shutil.rmtree(resolved_dist, ignore_errors=True)


class SteamOSDevShellLiveBootstrapSmokeTests(unittest.TestCase):
  def tearDown(self) -> None:
    _remove_steamos_dist()

  def test_typescript_bootstrap_initializes_against_live_dev_shell(self) -> None:
    provider_calls: list[dict[str, Any]] = []

    def provider_requester(**kwargs: Any) -> dict[str, Any]:
      provider_calls.append(kwargs)
      raise AssertionError("Provider requester should not run in the live shell bootstrap smoke test.")

    build_result = subprocess.run(
      [_resolve_pnpm_command(), "run", "build:steamos"],
      cwd=ROOT_DIR,
      capture_output=True,
      text=True,
      timeout=60,
      check=False,
    )
    self.assertEqual(build_result.returncode, 0, f"{build_result.stdout}\n{build_result.stderr}")
    self.assertTrue(STEAMOS_BOOTSTRAP_ASSET.exists())

    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      context = local_server.create_local_backend_context(
        paths=paths,
        settings_dir_text="dev-shell-live-bootstrap-settings",
        provider_requester=provider_requester,
      )
      runtime = dev_shell.start_steamos_dev_shell(paths=paths, context=context, asset_root=ROOT_DIR)
      try:
        fixture_path = ROOT_DIR / "tests" / "fixtures" / "steamos-live-shell-bootstrap-smoke.ts"
        result = subprocess.run(
          [_resolve_pnpm_command(), "exec", "tsx", str(fixture_path), runtime.shell_url],
          cwd=ROOT_DIR,
          capture_output=True,
          text=True,
          timeout=30,
          check=False,
        )
      finally:
        runtime.shutdown()

      combined_output = f"{result.stdout}\n{result.stderr}"
      self.assertEqual(result.returncode, 0, combined_output)
      self.assertNotIn(runtime.backend_runtime.token, combined_output)
      for forbidden in (
        "apiKey",
        "apiKeyDraft",
        "Authorization: Bearer",
        "localStorage",
        "sessionStorage",
        "password",
        "provider-secrets",
      ):
        self.assertNotIn(forbidden, combined_output)
      self.assertEqual(provider_calls, [])

      payload = json.loads(result.stdout)
      self.assertEqual(payload["ok"], True)
      self.assertEqual(payload["runtimeComposed"], True)
      self.assertEqual(
        payload["endpoints"],
        [
          "root",
          "assets/steamos-bootstrap.js",
          "__achievement_companion__/runtime",
          "get_provider_configs",
          "record_diagnostic_event",
        ],
      )

      self.assertFalse(paths.runtime_metadata_path.exists())

  def test_live_shell_bootstrap_fixture_stays_out_of_decky_release_payload(self) -> None:
    fixture_source = (ROOT_DIR / "tests" / "fixtures" / "steamos-live-shell-bootstrap-smoke.ts").read_text(
      encoding="utf-8",
    )
    package_release = (ROOT_DIR / "scripts" / "package_release.py").read_text(encoding="utf-8")
    check_release = (ROOT_DIR / "scripts" / "check_release_artifact.py").read_text(encoding="utf-8")

    self.assertNotIn("platform/decky", fixture_source)
    self.assertNotIn("@decky/", fixture_source)
    self.assertNotIn("localStorage", fixture_source)
    self.assertNotIn("sessionStorage", fixture_source)
    self.assertNotIn("OneDrive", fixture_source)
    self.assertNotIn("tests/fixtures/steamos-live-shell-bootstrap-smoke.ts", package_release)
    self.assertNotIn("tests/fixtures/steamos-live-shell-bootstrap-smoke.ts", check_release)
    self.assertNotIn("dist-steamos", package_release)
    self.assertNotIn("dist-steamos", check_release)


if __name__ == "__main__":
  unittest.main()
