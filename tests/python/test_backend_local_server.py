from __future__ import annotations

import json
import os
import stat
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Mapping

from backend import local_server
from backend import secrets as secret_helpers
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


def _create_test_context(root: Path) -> local_server.LocalBackendContext:
  return local_server.create_local_backend_context(
    paths=_build_test_backend_paths(root),
    settings_dir_text="test-settings",
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
    authorization: str | None = None,
    body: dict[str, Any] | bytes | None = None,
    origin: str | None = None,
    content_type: str | None = None,
    extra_headers: Mapping[str, str] | None = None,
  ) -> tuple[int, dict[str, Any], dict[str, str]]:
    headers: dict[str, str] = {}
    data: bytes | None = None
    if token is not None:
      headers["Authorization"] = f"Bearer {token}"
    if authorization is not None:
      headers["Authorization"] = authorization
    if origin is not None:
      headers["Origin"] = origin
    if isinstance(body, dict):
      data = json.dumps(body).encode("utf-8")
      headers["Content-Type"] = content_type or "application/json"
    elif isinstance(body, bytes):
      data = body
      headers["Content-Type"] = content_type or "application/json"
    elif content_type is not None:
      headers["Content-Type"] = content_type
    if extra_headers is not None:
      headers.update(extra_headers)

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


class BackendLocalServerTests(unittest.TestCase):
  def test_session_token_generation_uses_distinct_high_entropy_values(self) -> None:
    first = local_server.create_session_token()
    second = local_server.create_session_token()

    self.assertIsInstance(first, str)
    self.assertGreaterEqual(len(first), 32)
    self.assertNotEqual(first, second)

  def test_runtime_metadata_writes_expected_fields_with_restrictive_mode(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      metadata_path = Path(temp_dir) / "achievement-companion" / "backend.json"

      local_server.write_runtime_metadata(
        metadata_path,
        host="127.0.0.1",
        port=43991,
        pid=123,
        token="runtime-token",
        started_at="2026-04-25T00:00:00+00:00",
      )

      payload = json.loads(metadata_path.read_text(encoding="utf-8"))
      self.assertEqual(
        payload,
        {
          "host": "127.0.0.1",
          "pid": 123,
          "port": 43991,
          "startedAt": "2026-04-25T00:00:00+00:00",
          "token": "runtime-token",
        },
      )
      if os.name != "nt":
        self.assertEqual(stat.S_IMODE(metadata_path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(metadata_path.parent.stat().st_mode), 0o700)

  def test_runtime_metadata_path_is_absent_without_xdg_runtime_dir(self) -> None:
    self.assertIsNone(local_server.resolve_runtime_metadata_path(env={}))

  def test_health_endpoint_is_public_and_secret_free(self) -> None:
    token = "server-token"
    with _RunningServer(local_server.create_local_backend_server(token=token)) as running:
      status, payload, headers = running.request_json("GET", "/health")

    self.assertEqual(status, 200)
    self.assertEqual(payload["ok"], True)
    self.assertEqual(payload["service"], "achievement-companion")
    self.assertIn("health", payload["capabilities"])
    self.assertNotIn(token, json.dumps(payload))
    self.assertNotEqual(headers.get("Access-Control-Allow-Origin"), "*")

  def test_authorization_parsing_rejects_missing_malformed_and_wrong_tokens(self) -> None:
    token = "correct-token"
    with _RunningServer(local_server.create_local_backend_server(token=token)) as running:
      scenarios = (
        None,
        "Basic abc",
        "Bearer",
        "Bearer ",
        "Bearer  wrong-token",
        "Bearer wrong-token ",
        "Bearer wrong-token",
      )
      for route in (
        "/record_diagnostic_event",
        "/get_provider_configs",
        "/save_retroachievements_credentials",
        "/save_steam_credentials",
        "/clear_provider_credentials",
      ):
        for authorization in scenarios:
          status, payload, _ = running.request_json(
            "POST",
            route,
            authorization=authorization,
            body={},
          )
          self.assertEqual(status, 401)
          self.assertEqual(payload, {"error": "unauthorized", "ok": False})
          self.assertNotIn(token, json.dumps(payload))
          if authorization is not None:
            self.assertNotIn(authorization, json.dumps(payload))

  def test_authorized_diagnostic_route_records_sanitized_events(self) -> None:
    token = "diagnostic-token"
    server = local_server.create_local_backend_server(token=token)

    with _RunningServer(server) as running:
      status, payload, _ = running.request_json(
        "POST",
        "/record_diagnostic_event",
        token=token,
        body={
          "event": "dashboard_refresh_completed",
          "providerId": " steam ",
          "mode": " manual ",
          "durationMs": 42.9,
          "source": " live ",
          "apiKey": "raw-api-key",
          "Authorization": "Bearer secret",
          "token": "diagnostic-token",
        },
      )

    self.assertEqual(status, 200)
    self.assertEqual(payload, {"ok": True, "recorded": True})
    self.assertEqual(
      server.diagnostic_events,
      [
        {
          "event": "dashboard_refresh_completed",
          "message": "Dashboard refresh completed",
          "fields": {
            "providerId": "steam",
            "mode": "manual",
            "durationMs": 42,
            "source": "live",
          },
        },
      ],
    )
    serialized_events = json.dumps(server.diagnostic_events)
    self.assertNotIn("raw-api-key", serialized_events)
    self.assertNotIn("Bearer secret", serialized_events)

  def test_method_policy_returns_safe_errors(self) -> None:
    token = "route-token"
    with _RunningServer(local_server.create_local_backend_server(token=token)) as running:
      health_status, health_payload, health_headers = running.request_json(
        "POST",
        "/health",
      )
      record_get_status, record_get_payload, _ = running.request_json(
        "GET",
        "/record_diagnostic_event",
      )
      provider_configs_get_status, provider_configs_get_payload, _ = running.request_json(
        "GET",
        "/get_provider_configs",
      )
      delete_status, delete_payload, _ = running.request_json(
        "DELETE",
        "/record_diagnostic_event",
        token=token,
      )
      unknown_status, unknown_payload, _ = running.request_json(
        "PUT",
        "/unknown",
        token=token,
      )

    self.assertEqual(health_status, 405)
    self.assertEqual(health_payload, {"error": "method_not_allowed", "ok": False})
    self.assertEqual(health_headers.get("Allow"), "GET")
    self.assertEqual(record_get_status, 405)
    self.assertEqual(record_get_payload, {"error": "method_not_allowed", "ok": False})
    self.assertEqual(provider_configs_get_status, 405)
    self.assertEqual(provider_configs_get_payload, {"error": "method_not_allowed", "ok": False})
    self.assertEqual(delete_status, 405)
    self.assertEqual(delete_payload, {"error": "method_not_allowed", "ok": False})
    self.assertEqual(unknown_status, 404)
    self.assertEqual(unknown_payload, {"error": "not_found", "ok": False})
    self.assertNotIn(token, json.dumps(record_get_payload))
    self.assertNotIn(token, json.dumps(delete_payload))

  def test_json_request_validation_returns_safe_errors(self) -> None:
    token = "route-token"
    with _RunningServer(local_server.create_local_backend_server(token=token)) as running:
      invalid_status, invalid_payload, _ = running.request_json(
        "POST",
        "/record_diagnostic_event",
        token=token,
        body=b"{not-json",
      )
      empty_status, empty_payload, _ = running.request_json(
        "POST",
        "/record_diagnostic_event",
        token=token,
        body=None,
        content_type="application/json",
      )
      wrong_type_status, wrong_type_payload, _ = running.request_json(
        "POST",
        "/record_diagnostic_event",
        token=token,
        body={"event": "dashboard_refresh_started"},
        content_type="text/plain",
      )
      large_status, large_payload, _ = running.request_json(
        "POST",
        "/record_diagnostic_event",
        token=token,
        body=b"x" * (local_server.MAX_JSON_BODY_BYTES + 1),
      )
      unknown_status, unknown_payload, _ = running.request_json(
        "POST",
        "/unknown",
        token=token,
        body={},
      )

    self.assertEqual(invalid_status, 400)
    self.assertEqual(invalid_payload, {"error": "invalid_json", "ok": False})
    self.assertEqual(empty_status, 400)
    self.assertEqual(empty_payload, {"error": "invalid_json", "ok": False})
    self.assertEqual(wrong_type_status, 415)
    self.assertEqual(wrong_type_payload, {"error": "unsupported_media_type", "ok": False})
    self.assertEqual(large_status, 413)
    self.assertEqual(large_payload, {"error": "payload_too_large", "ok": False})
    self.assertEqual(unknown_status, 404)
    self.assertEqual(unknown_payload, {"error": "not_found", "ok": False})
    self.assertNotIn(token, json.dumps(invalid_payload))
    self.assertNotIn(token, json.dumps(empty_payload))
    self.assertNotIn(token, json.dumps(wrong_type_payload))
    self.assertNotIn(token, json.dumps(large_payload))
    self.assertNotIn(token, json.dumps(unknown_payload))

  def test_get_provider_configs_returns_default_shape_when_files_are_missing(self) -> None:
    token = "config-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          token=token,
          body={},
        )

    self.assertEqual(status, 200)
    self.assertEqual(payload, {"version": 1})

  def test_get_provider_configs_uses_actual_secret_presence_for_has_api_key(self) -> None:
    token = "config-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      context = _create_test_context(root)
      context.paths.config_path.parent.mkdir(parents=True, exist_ok=True)
      context.paths.config_path.write_text(
        json.dumps(
          {
            "version": 1,
            "retroAchievements": {
              "username": "sol88",
              "hasApiKey": True,
              "recentAchievementsCount": 10,
              "recentlyPlayedCount": 8,
            },
            "steam": {
              "steamId64": "76561198136628813",
              "hasApiKey": True,
              "language": "english",
              "recentAchievementsCount": 3,
              "recentlyPlayedCount": 3,
              "includePlayedFreeGames": True,
            },
          },
        ),
        encoding="utf-8",
      )
      secret_helpers.save_secret_api_key(
        context.paths.secrets_path,
        "steam",
        "steam-secret",
        settings_dir_text=context.settings_dir_text,
      )

      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          token=token,
          body={},
        )

    self.assertEqual(status, 200)
    self.assertEqual(payload["version"], 1)
    self.assertEqual(
      payload["retroAchievements"],
      {
        "username": "sol88",
        "hasApiKey": False,
        "recentAchievementsCount": 10,
        "recentlyPlayedCount": 8,
      },
    )
    self.assertEqual(
      payload["steam"],
      {
        "steamId64": "76561198136628813",
        "hasApiKey": True,
        "language": "english",
        "recentAchievementsCount": 3,
        "recentlyPlayedCount": 3,
        "includePlayedFreeGames": True,
      },
    )
    serialized = json.dumps(payload)
    for secret_like_key in ("apiKey", "apiKeyDraft", "key", "token", "password", "secret", "Authorization"):
      self.assertNotIn(secret_like_key, serialized)

  def test_save_retroachievements_credentials_writes_safe_config_and_protected_secret(self) -> None:
    token = "ra-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/save_retroachievements_credentials",
          token=token,
          body={
            "username": "sol88",
            "apiKeyDraft": "ra-secret",
            "recentAchievementsCount": 10,
            "recentlyPlayedCount": 9,
          },
        )

      self.assertEqual(status, 200)
      self.assertEqual(
        payload,
        {
          "username": "sol88",
          "hasApiKey": True,
          "recentAchievementsCount": 10,
          "recentlyPlayedCount": 9,
        },
      )
      config_text = context.paths.config_path.read_text(encoding="utf-8")
      secrets_text = context.paths.secrets_path.read_text(encoding="utf-8")
      self.assertIn('"username": "sol88"', config_text)
      self.assertNotIn("ra-secret", config_text)
      self.assertNotIn("apiKey", config_text)
      self.assertNotIn("apiKeyDraft", config_text)
      self.assertNotIn("ra-secret", secrets_text)
      self.assertEqual(
        secret_helpers.load_secret_api_key(
          context.paths.secrets_path,
          "retroAchievements",
          settings_dir_text=context.settings_dir_text,
        ),
        "ra-secret",
      )

  def test_save_retroachievements_credentials_preserves_existing_secret_without_new_key(self) -> None:
    token = "ra-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      secret_helpers.save_secret_api_key(
        context.paths.secrets_path,
        "retroAchievements",
        "existing-secret",
        settings_dir_text=context.settings_dir_text,
      )
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/save_retroachievements_credentials",
          token=token,
          body={
            "username": "sol99",
            "recentAchievementsCount": 11,
          },
        )

      self.assertEqual(status, 200)
      self.assertEqual(payload["hasApiKey"], True)
      self.assertEqual(
        secret_helpers.load_secret_api_key(
          context.paths.secrets_path,
          "retroAchievements",
          settings_dir_text=context.settings_dir_text,
        ),
        "existing-secret",
      )

  def test_save_steam_credentials_writes_safe_config_and_protected_secret(self) -> None:
    token = "steam-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/save_steam_credentials",
          token=token,
          body={
            "steamId64": "76561198136628813",
            "apiKeyDraft": "steam-secret",
            "language": "english",
            "recentAchievementsCount": 3,
            "recentlyPlayedCount": 4,
            "includePlayedFreeGames": True,
          },
        )

      self.assertEqual(status, 200)
      self.assertEqual(
        payload,
        {
          "steamId64": "76561198136628813",
          "hasApiKey": True,
          "language": "english",
          "recentAchievementsCount": 3,
          "recentlyPlayedCount": 4,
          "includePlayedFreeGames": True,
        },
      )
      config_text = context.paths.config_path.read_text(encoding="utf-8")
      secrets_text = context.paths.secrets_path.read_text(encoding="utf-8")
      self.assertNotIn("steam-secret", config_text)
      self.assertNotIn("apiKey", config_text)
      self.assertNotIn("steam-secret", secrets_text)
      self.assertEqual(
        secret_helpers.load_secret_api_key(
          context.paths.secrets_path,
          "steam",
          settings_dir_text=context.settings_dir_text,
        ),
        "steam-secret",
      )

  def test_save_steam_credentials_preserves_existing_secret_without_new_key(self) -> None:
    token = "steam-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      secret_helpers.save_secret_api_key(
        context.paths.secrets_path,
        "steam",
        "existing-steam-secret",
        settings_dir_text=context.settings_dir_text,
      )
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/save_steam_credentials",
          token=token,
          body={
            "steamId64": "76561198136628813",
            "language": "german",
            "recentAchievementsCount": 6,
            "recentlyPlayedCount": 7,
            "includePlayedFreeGames": False,
          },
        )

      self.assertEqual(status, 200)
      self.assertEqual(payload["hasApiKey"], True)
      self.assertEqual(
        secret_helpers.load_secret_api_key(
          context.paths.secrets_path,
          "steam",
          settings_dir_text=context.settings_dir_text,
        ),
        "existing-steam-secret",
      )

  def test_clear_provider_credentials_only_clears_selected_provider(self) -> None:
    token = "clear-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      secret_helpers.save_secret_api_key(
        context.paths.secrets_path,
        "retroAchievements",
        "ra-secret",
        settings_dir_text=context.settings_dir_text,
      )
      secret_helpers.save_secret_api_key(
        context.paths.secrets_path,
        "steam",
        "steam-secret",
        settings_dir_text=context.settings_dir_text,
      )
      context.paths.config_path.parent.mkdir(parents=True, exist_ok=True)
      context.paths.config_path.write_text(
        json.dumps(
          {
            "version": 1,
            "retroAchievements": {"username": "sol88", "hasApiKey": True},
            "steam": {"steamId64": "76561198136628813", "hasApiKey": True},
          },
        ),
        encoding="utf-8",
      )

      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/clear_provider_credentials",
          token=token,
          body={"providerId": "steam"},
        )
        unknown_status, unknown_payload, _ = running.request_json(
          "POST",
          "/clear_provider_credentials",
          token=token,
          body={"providerId": "unknown"},
        )

      self.assertEqual(status, 200)
      self.assertEqual(payload, {"ok": True, "cleared": True})
      self.assertEqual(unknown_status, 400)
      self.assertEqual(unknown_payload, {"error": "invalid_provider_id", "ok": False})
      self.assertIsNotNone(
        secret_helpers.load_secret_api_key(
          context.paths.secrets_path,
          "retroAchievements",
          settings_dir_text=context.settings_dir_text,
        ),
      )
      self.assertIsNone(
        secret_helpers.load_secret_api_key(
          context.paths.secrets_path,
          "steam",
          settings_dir_text=context.settings_dir_text,
        ),
      )
      saved_config = json.loads(context.paths.config_path.read_text(encoding="utf-8"))
      self.assertIn("retroAchievements", saved_config)
      self.assertNotIn("steam", saved_config)

  def test_corrupt_provider_files_are_quarantined_and_responses_stay_safe(self) -> None:
    token = "corrupt-token"
    malformed_secret = '{"version": 2, "steam": {"payload": "secret-fragment"'
    malformed_config = '{"version": 1, "steam": {"steamId64": "7656119"'
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      context.paths.config_path.parent.mkdir(parents=True, exist_ok=True)
      context.paths.secrets_path.parent.mkdir(parents=True, exist_ok=True)
      context.paths.config_path.write_text(malformed_config, encoding="utf-8")
      context.paths.secrets_path.write_text(malformed_secret, encoding="utf-8")

      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        status, payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          token=token,
          body={},
        )

      self.assertEqual(status, 200)
      self.assertEqual(payload, {"version": 1})
      self.assertEqual(len(list(context.paths.config_path.parent.glob("provider-config.json.corrupt-*"))), 1)
      self.assertEqual(len(list(context.paths.secrets_path.parent.glob("provider-secrets.json.corrupt-*"))), 1)
      warnings_serialized = json.dumps(context.warning_events)
      self.assertNotIn("secret-fragment", warnings_serialized)
      self.assertNotIn(malformed_config, warnings_serialized)


  def test_default_origin_policy_does_not_emit_wildcard_cors(self) -> None:
    token = "origin-token"
    with _RunningServer(local_server.create_local_backend_server(token=token)) as running:
      status, payload, headers = running.request_json(
        "POST",
        "/record_diagnostic_event",
        token=token,
        origin="https://example.invalid",
        body={"event": "dashboard_refresh_started"},
      )

    self.assertEqual(status, 403)
    self.assertEqual(payload, {"error": "origin_forbidden", "ok": False})
    self.assertNotIn("Access-Control-Allow-Origin", headers)
    self.assertNotIn(token, json.dumps(payload))

  def test_allowed_origin_is_echoed_without_wildcard(self) -> None:
    token = "origin-token"
    origin = "http://127.0.0.1:3000"
    with _RunningServer(
      local_server.create_local_backend_server(token=token, allowed_origins=(origin,)),
    ) as running:
      status, payload, headers = running.request_json(
        "POST",
        "/record_diagnostic_event",
        token=token,
        origin=origin,
        body={"event": "dashboard_refresh_started", "providerId": "steam", "mode": "manual"},
      )

    self.assertEqual(status, 200)
    self.assertEqual(payload, {"ok": True, "recorded": True})
    self.assertEqual(headers.get("Access-Control-Allow-Origin"), origin)
    self.assertNotEqual(headers.get("Access-Control-Allow-Origin"), "*")

  def test_options_preflight_only_allows_explicit_origins(self) -> None:
    token = "origin-token"
    origin = "http://127.0.0.1:3000"
    with _RunningServer(
      local_server.create_local_backend_server(token=token, allowed_origins=(origin,)),
    ) as running:
      allowed_status, allowed_payload, allowed_headers = running.request_json(
        "OPTIONS",
        "/record_diagnostic_event",
        origin=origin,
      )
      denied_status, denied_payload, denied_headers = running.request_json(
        "OPTIONS",
        "/record_diagnostic_event",
        origin="https://example.invalid",
      )

    self.assertEqual(allowed_status, 204)
    self.assertEqual(allowed_payload, {})
    self.assertEqual(allowed_headers.get("Access-Control-Allow-Origin"), origin)
    self.assertEqual(allowed_headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS")
    self.assertEqual(allowed_headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type")
    self.assertEqual(denied_status, 403)
    self.assertEqual(denied_payload, {"error": "origin_forbidden", "ok": False})
    self.assertNotIn("Access-Control-Allow-Origin", denied_headers)

  def test_server_creation_rejects_non_localhost_bindings(self) -> None:
    with self.assertRaises(ValueError):
      local_server.create_local_backend_server(host="0.0.0.0")

  def test_local_server_module_stays_out_of_decky_boundaries_and_release_payload(self) -> None:
    source = (ROOT_DIR / "backend" / "local_server.py").read_text(encoding="utf-8")
    package_release = (ROOT_DIR / "scripts" / "package_release.py").read_text(encoding="utf-8")
    check_release = (ROOT_DIR / "scripts" / "check_release_artifact.py").read_text(encoding="utf-8")

    self.assertNotIn("import decky", source)
    self.assertNotIn("from decky", source)
    self.assertNotIn("import main", source)
    self.assertNotIn("from main import", source)
    self.assertNotIn("OneDrive", source)
    self.assertNotIn("backend/local_server.py", package_release)
    self.assertNotIn("backend/local_server.py", check_release)
    self.assertNotIn("backend/paths.py", package_release)
    self.assertNotIn("backend/paths.py", check_release)


if __name__ == "__main__":
  unittest.main()
