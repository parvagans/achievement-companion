from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from backend import local_server
from backend.paths import BackendPaths


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


def _create_test_context(root: Path) -> local_server.LocalBackendContext:
  return local_server.create_local_backend_context(
    paths=_build_test_backend_paths(root),
    settings_dir_text="cache-endpoint-test-settings",
  )


class _RunningServer:
  def __init__(self, server: local_server.LocalBackendHTTPServer) -> None:
    self.server = server
    self.thread = threading.Thread(target=server.serve_forever, daemon=True)

  def __enter__(self) -> "_RunningServer":
    self.thread.start()
    return self

  def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
    del exc_type, exc, traceback
    self.server.shutdown()
    self.server.server_close()
    self.thread.join(timeout=5)

  @property
  def base_url(self) -> str:
    host, port = self.server.server_address
    return f"http://{host}:{port}"

  def request_json(
    self,
    method: str,
    path: str,
    *,
    token: str | None = None,
    body: dict[str, Any] | None = None,
  ) -> tuple[int, dict[str, Any], dict[str, str]]:
    headers: dict[str, str] = {}
    data: bytes | None = None
    if token is not None:
      headers["Authorization"] = f"Bearer {token}"
    if body is not None:
      data = json.dumps(body).encode("utf-8")
      headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
      f"{self.base_url}{path}",
      data=data,
      headers=headers,
      method=method,
    )
    try:
      with urllib.request.urlopen(request, timeout=5) as response:
        raw_body = response.read().decode("utf-8")
        return (
          response.status,
          json.loads(raw_body) if raw_body else {},
          dict(response.headers.items()),
        )
    except urllib.error.HTTPError as error:
      raw_body = error.read().decode("utf-8")
      return (
        error.code,
        json.loads(raw_body) if raw_body else {},
        dict(error.headers.items()),
      )


class BackendLocalServerCacheTests(unittest.TestCase):
  def test_cache_endpoints_require_bearer_auth(self) -> None:
    token = "cache-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        for route, body in (
          ("/cache/dashboard/read", {"providerId": "steam"}),
          ("/cache/dashboard/write", {"providerId": "steam", "value": {"status": "success"}}),
          ("/cache/dashboard/clear", {}),
          ("/cache/steam-scan/read-overview", {}),
          ("/cache/steam-scan/write-overview", {"value": {"ownedGameCount": 1}}),
          ("/cache/steam-scan/read-summary", {}),
          ("/cache/steam-scan/write-summary", {"value": {"games": []}}),
          ("/cache/steam-scan/clear", {}),
        ):
          missing_status, missing_payload, _ = running.request_json("POST", route, body=body)
          wrong_status, wrong_payload, _ = running.request_json("POST", route, token="wrong-token", body=body)
          self.assertEqual(missing_status, 401)
          self.assertEqual(missing_payload, {"error": "unauthorized", "ok": False})
          self.assertEqual(wrong_status, 401)
          self.assertEqual(wrong_payload, {"error": "unauthorized", "ok": False})
          self.assertNotIn(token, json.dumps([missing_payload, wrong_payload]))

  def test_dashboard_cache_endpoints_round_trip_and_clear_by_provider_or_globally(self) -> None:
    token = "cache-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      context = _create_test_context(root)
      steam_snapshot = {
        "profile": {
          "providerId": "steam",
          "identity": {
            "providerId": "steam",
            "accountId": "steam-user",
            "displayName": "Steam Player",
          },
          "summary": {
            "unlockedCount": 10,
            "totalCount": 20,
            "completionPercent": 50,
          },
          "metrics": [
            {
              "key": "games-beaten",
              "label": "Perfect Games",
              "value": "3",
            },
          ],
          "refreshedAt": 123,
        },
        "recentAchievements": [],
        "recentlyPlayedGames": [],
        "recentUnlocks": [],
        "featuredGames": [],
        "refreshedAt": 123,
      }
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        write_steam_status, write_steam_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/write",
          token=token,
          body={"providerId": "steam", "value": steam_snapshot},
        )
        write_ra_status, write_ra_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/write",
          token=token,
          body={"providerId": "retroachievements", "value": {"status": "success", "profile": {"providerId": "retroachievements"}}},
        )
        read_steam_status, read_steam_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/read",
          token=token,
          body={"providerId": "steam"},
        )
        clear_steam_status, clear_steam_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/clear",
          token=token,
          body={"providerId": "steam"},
        )
        read_cleared_status, read_cleared_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/read",
          token=token,
          body={"providerId": "steam"},
        )
        read_ra_status, read_ra_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/read",
          token=token,
          body={"providerId": "retroachievements"},
        )
        clear_all_status, clear_all_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/clear",
          token=token,
          body={},
        )
        read_ra_after_clear_status, read_ra_after_clear_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/read",
          token=token,
          body={"providerId": "retroachievements"},
        )

      self.assertEqual(write_steam_status, 200)
      self.assertEqual(write_steam_payload, {"ok": True})
      self.assertEqual(write_ra_status, 200)
      self.assertEqual(write_ra_payload, {"ok": True})
      self.assertEqual(read_steam_status, 200)
      self.assertEqual(read_steam_payload, {"hit": True, "value": steam_snapshot})
      self.assertEqual(clear_steam_status, 200)
      self.assertEqual(clear_steam_payload, {"ok": True, "cleared": True})
      self.assertEqual(read_cleared_status, 200)
      self.assertEqual(read_cleared_payload, {"hit": False})
      self.assertEqual(read_ra_status, 200)
      self.assertEqual(read_ra_payload, {"hit": True, "value": {"status": "success", "profile": {"providerId": "retroachievements"}}})
      self.assertEqual(clear_all_status, 200)
      self.assertEqual(clear_all_payload, {"ok": True, "cleared": True})
      self.assertEqual(read_ra_after_clear_status, 200)
      self.assertEqual(read_ra_after_clear_payload, {"hit": False})

  def test_dashboard_cache_endpoints_reject_invalid_provider_ids_and_secret_like_payloads(self) -> None:
    token = "cache-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      context = _create_test_context(root)
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        invalid_provider_status, invalid_provider_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/read",
          token=token,
          body={"providerId": "steam/../../secret"},
        )
        secret_write_status, secret_write_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/write",
          token=token,
          body={"providerId": "steam", "value": {"profile": {"apiKey": "raw-cache-secret"}}},
        )
        missing_value_status, missing_value_payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/write",
          token=token,
          body={"providerId": "steam"},
        )

      self.assertEqual(invalid_provider_status, 400)
      self.assertEqual(invalid_provider_payload, {"error": "invalid_provider_id", "ok": False})
      self.assertEqual(secret_write_status, 400)
      self.assertEqual(secret_write_payload, {"error": "invalid_payload", "ok": False})
      self.assertEqual(missing_value_status, 400)
      self.assertEqual(missing_value_payload, {"error": "invalid_payload", "ok": False})
      self.assertFalse((root / "cache" / "achievement-companion" / "dashboard" / "steam.json").exists())

  def test_dashboard_cache_corruption_returns_miss_and_quarantines_file(self) -> None:
    token = "cache-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      context = _create_test_context(root)
      dashboard_path = context.paths.dashboard_cache_dir / "steam.json"
      dashboard_path.parent.mkdir(parents=True, exist_ok=True)
      dashboard_path.write_text('{"status":"success"', encoding="utf-8")

      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/cache/dashboard/read",
          token=token,
          body={"providerId": "steam"},
        )

      self.assertEqual(status, 200)
      self.assertEqual(payload, {"hit": False})
      self.assertFalse(dashboard_path.exists())
      self.assertEqual(len(list(dashboard_path.parent.glob("steam.json.corrupt-*"))), 1)
      self.assertNotIn('{"status":"success"', json.dumps(context.warning_events))

  def test_steam_scan_cache_endpoints_round_trip_clear_and_quarantine(self) -> None:
    token = "cache-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      context = _create_test_context(root)
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        missing_overview_status, missing_overview_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-overview",
          token=token,
          body={},
        )
        missing_summary_status, missing_summary_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-summary",
          token=token,
          body={},
        )
        write_overview_status, write_overview_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/write-overview",
          token=token,
          body={"value": {"ownedGameCount": 4, "scannedGameCount": 3}},
        )
        write_summary_status, write_summary_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/write-summary",
          token=token,
          body={"value": {"games": [{"appid": 10}], "scannedAt": "2026-04-25T00:00:00+00:00"}},
        )
        read_overview_status, read_overview_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-overview",
          token=token,
          body={},
        )
        read_summary_status, read_summary_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-summary",
          token=token,
          body={},
        )
        secret_overview_status, secret_overview_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/write-overview",
          token=token,
          body={"value": {"token": "should-not-cache"}},
        )
        clear_status, clear_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/clear",
          token=token,
          body={},
        )
        post_clear_overview_status, post_clear_overview_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-overview",
          token=token,
          body={},
        )
        post_clear_summary_status, post_clear_summary_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-summary",
          token=token,
          body={},
        )

      self.assertEqual(missing_overview_status, 200)
      self.assertEqual(missing_overview_payload, {"hit": False})
      self.assertEqual(missing_summary_status, 200)
      self.assertEqual(missing_summary_payload, {"hit": False})
      self.assertEqual(write_overview_status, 200)
      self.assertEqual(write_overview_payload, {"ok": True})
      self.assertEqual(write_summary_status, 200)
      self.assertEqual(write_summary_payload, {"ok": True})
      self.assertEqual(read_overview_status, 200)
      self.assertEqual(read_overview_payload, {"hit": True, "value": {"ownedGameCount": 4, "scannedGameCount": 3}})
      self.assertEqual(read_summary_status, 200)
      self.assertEqual(read_summary_payload, {"hit": True, "value": {"games": [{"appid": 10}], "scannedAt": "2026-04-25T00:00:00+00:00"}})
      self.assertEqual(secret_overview_status, 400)
      self.assertEqual(secret_overview_payload, {"error": "invalid_payload", "ok": False})
      self.assertEqual(clear_status, 200)
      self.assertEqual(clear_payload, {"ok": True, "cleared": True})
      self.assertEqual(post_clear_overview_status, 200)
      self.assertEqual(post_clear_overview_payload, {"hit": False})
      self.assertEqual(post_clear_summary_status, 200)
      self.assertEqual(post_clear_summary_payload, {"hit": False})
      self.assertFalse(context.paths.steam_scan_overview_path.exists())
      self.assertFalse(context.paths.steam_scan_summary_path.exists())

  def test_steam_scan_cache_corruption_returns_miss_without_leaking_payload_contents(self) -> None:
    token = "cache-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      context = _create_test_context(root)
      context.paths.steam_scan_overview_path.parent.mkdir(parents=True, exist_ok=True)
      context.paths.steam_scan_overview_path.write_text('{"ownedGameCount": "secret-fragment"', encoding="utf-8")
      context.paths.steam_scan_summary_path.parent.mkdir(parents=True, exist_ok=True)
      context.paths.steam_scan_summary_path.write_text('{"games": "secret-fragment"', encoding="utf-8")

      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        overview_status, overview_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-overview",
          token=token,
          body={},
        )
        summary_status, summary_payload, _ = running.request_json(
          "POST",
          "/cache/steam-scan/read-summary",
          token=token,
          body={},
        )

      self.assertEqual(overview_status, 200)
      self.assertEqual(overview_payload, {"hit": False})
      self.assertEqual(summary_status, 200)
      self.assertEqual(summary_payload, {"hit": False})
      self.assertEqual(len(list(context.paths.steam_scan_overview_path.parent.glob("library-achievement-scan-overview.json.corrupt-*"))), 1)
      self.assertEqual(len(list(context.paths.steam_scan_summary_path.parent.glob("library-achievement-scan-summary.json.corrupt-*"))), 1)
      self.assertNotIn("secret-fragment", json.dumps(context.warning_events))


if __name__ == "__main__":
  unittest.main()
