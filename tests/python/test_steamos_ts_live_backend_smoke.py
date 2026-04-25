from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Any

from backend import local_launcher, local_server
from backend.paths import BackendPaths


ROOT_DIR = Path(__file__).resolve().parents[2]


def _resolve_pnpm_command() -> str:
  pnpm_command = shutil.which("pnpm") or shutil.which("pnpm.cmd")
  if pnpm_command is None:
    raise RuntimeError("pnpm is required for the SteamOS TypeScript live backend smoke test.")
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


class SteamOSTypeScriptLiveBackendSmokeTests(unittest.TestCase):
  def test_typescript_client_uses_runtime_metadata_to_call_live_local_backend(self) -> None:
    provider_calls: list[dict[str, Any]] = []

    def provider_requester(**kwargs: Any) -> dict[str, Any]:
      provider_calls.append(kwargs)
      raise AssertionError("Provider requester should not run in the TS live backend smoke test.")

    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      context = local_server.create_local_backend_context(
        paths=paths,
        settings_dir_text="ts-live-smoke-settings",
        provider_requester=provider_requester,
      )
      runtime = local_launcher.start_local_backend(paths=paths, context=context)
      try:
        fixture_path = ROOT_DIR / "tests" / "fixtures" / "steamos-live-client-smoke.ts"
        result = subprocess.run(
          [_resolve_pnpm_command(), "exec", "tsx", str(fixture_path), str(paths.runtime_metadata_path)],
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
    self.assertNotIn(runtime.token, combined_output)
    for forbidden in ("apiKey", "apiKeyDraft", "password", "secret"):
      self.assertNotIn(forbidden, combined_output)
    self.assertEqual(provider_calls, [])

    payload = json.loads(result.stdout)
    self.assertEqual(payload["ok"], True)
    self.assertEqual(payload["baseUrl"], runtime.base_url)
    self.assertEqual(
      payload["endpoints"],
      ["health", "get_provider_configs", "record_diagnostic_event"],
    )
    self.assertNotIn(runtime.token, payload["baseUrl"])

    self.assertFalse(paths.runtime_metadata_path.exists())

  def test_typescript_live_backend_fixture_stays_out_of_decky_release_payload(self) -> None:
    fixture_source = (ROOT_DIR / "tests" / "fixtures" / "steamos-live-client-smoke.ts").read_text(encoding="utf-8")
    package_release = (ROOT_DIR / "scripts" / "package_release.py").read_text(encoding="utf-8")
    check_release = (ROOT_DIR / "scripts" / "check_release_artifact.py").read_text(encoding="utf-8")

    self.assertNotIn("platform/decky", fixture_source)
    self.assertNotIn("@decky/", fixture_source)
    self.assertNotIn("localStorage", fixture_source)
    self.assertNotIn("sessionStorage", fixture_source)
    self.assertNotIn("OneDrive", fixture_source)
    self.assertNotIn("tests/fixtures/steamos-live-client-smoke.ts", package_release)
    self.assertNotIn("tests/fixtures/steamos-live-client-smoke.ts", check_release)
    self.assertNotIn("backend/local_launcher.py", package_release)
    self.assertNotIn("backend/local_launcher.py", check_release)
    self.assertNotIn("backend/local_server.py", package_release)
    self.assertNotIn("backend/local_server.py", check_release)
    self.assertNotIn("backend/paths.py", package_release)
    self.assertNotIn("backend/paths.py", check_release)


if __name__ == "__main__":
  unittest.main()
