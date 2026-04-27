from __future__ import annotations

import io
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Mapping

from backend import http as backend_http
from backend import local_server
from backend.paths import BackendPaths
from backend import secrets as secret_helpers


ROOT_DIR = Path(__file__).resolve().parents[2]
_SECRET_LIKE_KEYS = {"apiKey", "apiKeyDraft", "key", "y", "token", "password", "secret", "Authorization"}


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


def _create_test_context(
  root: Path,
  *,
  provider_requester: local_server.ProviderRequestCallback | None = None,
) -> local_server.LocalBackendContext:
  return local_server.create_local_backend_context(
    paths=_build_test_backend_paths(root),
    settings_dir_text="smoke-test-settings",
    provider_requester=provider_requester,
  )


def _assert_no_secret_like_keys(test_case: unittest.TestCase, value: Any) -> None:
  if isinstance(value, dict):
    for key, nested_value in value.items():
      test_case.assertNotIn(key, _SECRET_LIKE_KEYS)
      _assert_no_secret_like_keys(test_case, nested_value)
    return

  if isinstance(value, list):
    for item in value:
      _assert_no_secret_like_keys(test_case, item)


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


class LocalBackendSmokeTests(unittest.TestCase):
  def test_health_smoke_over_real_localhost_http(self) -> None:
    with _RunningServer(local_server.create_local_backend_server(token="health-token")) as running:
      status, payload, _headers = running.request_json("GET", "/health")

    self.assertEqual(status, 200)
    self.assertEqual(payload["ok"], True)
    self.assertEqual(payload["service"], "achievement-companion")
    self.assertIn("health", payload["capabilities"])
    serialized = json.dumps(payload)
    for forbidden in ("token", "apiKey", "secret", "Authorization"):
      self.assertNotIn(forbidden, serialized)

  def test_auth_smoke_for_provider_configs_over_http(self) -> None:
    token = "correct-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        missing_status, missing_payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          body={},
        )
        wrong_status, wrong_payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          token="wrong-token",
          body={},
        )
        success_status, success_payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          token=token,
          body={},
        )

    self.assertEqual(missing_status, 401)
    self.assertEqual(missing_payload, {"error": "unauthorized", "ok": False})
    self.assertEqual(wrong_status, 401)
    self.assertEqual(wrong_payload, {"error": "unauthorized", "ok": False})
    self.assertEqual(success_status, 200)
    self.assertEqual(success_payload, {"version": 1})
    self.assertNotIn(token, json.dumps([missing_payload, wrong_payload, success_payload]))

  def test_config_and_credential_smoke_flow_keeps_responses_and_files_secret_safe(self) -> None:
    token = "config-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      context = _create_test_context(root)
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        ra_status, ra_payload, _ = running.request_json(
          "POST",
          "/save_retroachievements_credentials",
          token=token,
          body={
            "username": "sol88",
            "apiKeyDraft": "retro-secret-value",
            "recentAchievementsCount": 10,
            "recentlyPlayedCount": 9,
          },
        )
        steam_status, steam_payload, _ = running.request_json(
          "POST",
          "/save_steam_credentials",
          token=token,
          body={
            "steamId64": "76561198136628813",
            "apiKeyDraft": "steam-secret-value",
            "language": "english",
            "recentAchievementsCount": 3,
            "recentlyPlayedCount": 4,
            "includePlayedFreeGames": True,
          },
        )
        configs_status, configs_payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          token=token,
          body={},
        )

      self.assertEqual(ra_status, 200)
      self.assertEqual(
        ra_payload,
        {
          "username": "sol88",
          "hasApiKey": True,
          "recentAchievementsCount": 10,
          "recentlyPlayedCount": 9,
        },
      )
      self.assertEqual(steam_status, 200)
      self.assertEqual(
        steam_payload,
        {
          "steamId64": "76561198136628813",
          "hasApiKey": True,
          "language": "english",
          "recentAchievementsCount": 3,
          "recentlyPlayedCount": 4,
          "includePlayedFreeGames": True,
        },
      )
      self.assertEqual(configs_status, 200)
      self.assertEqual(configs_payload["retroAchievements"]["hasApiKey"], True)
      self.assertEqual(configs_payload["steam"]["hasApiKey"], True)

      _assert_no_secret_like_keys(self, configs_payload)

      config_text = context.paths.config_path.read_text(encoding="utf-8")
      secrets_text = context.paths.secrets_path.read_text(encoding="utf-8")
      self.assertNotIn("retro-secret-value", config_text)
      self.assertNotIn("steam-secret-value", config_text)
      self.assertNotIn("apiKey", config_text)
      self.assertNotIn("apiKeyDraft", config_text)
      self.assertNotIn("retro-secret-value", secrets_text)
      self.assertNotIn("steam-secret-value", secrets_text)

  def test_provider_request_smoke_flow_uses_backend_owned_secrets_only(self) -> None:
    token = "request-token"
    calls: list[dict[str, Any]] = []

    def fake_requester(**kwargs: Any) -> dict[str, Any]:
      calls.append(kwargs)
      if kwargs["provider_id"] == "retroachievements":
        return {"user": "Retro Player"}
      if kwargs["provider_id"] == "steam":
        return {"response": {"game_count": 7}}
      raise AssertionError(f"Unexpected provider: {kwargs['provider_id']}")

    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir), provider_requester=fake_requester)
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        running.request_json(
          "POST",
          "/save_retroachievements_credentials",
          token=token,
          body={
            "username": "sol88",
            "apiKeyDraft": "backend-ra-secret",
            "recentAchievementsCount": 10,
          },
        )
        running.request_json(
          "POST",
          "/save_steam_credentials",
          token=token,
          body={
            "steamId64": "76561198136628813",
            "apiKeyDraft": "backend-steam-secret",
            "language": "english",
            "recentAchievementsCount": 3,
            "recentlyPlayedCount": 3,
            "includePlayedFreeGames": True,
          },
        )

        ra_status, ra_payload, _ = running.request_json(
          "POST",
          "/request_retroachievements_json",
          token=token,
          body={
            "path": "API/API_GetUserProfile.php",
            "query": {
              "u": "frontend-user",
              "y": "frontend-y",
              "key": "frontend-key",
              "apiKey": "frontend-api-key",
              "Authorization": "Bearer frontend",
            },
          },
        )
        steam_status, steam_payload, _ = running.request_json(
          "POST",
          "/request_steam_json",
          token=token,
          body={
            "path": "IPlayerService/GetOwnedGames/v1/",
            "query": {
              "steamid": "frontend-steamid",
              "key": "frontend-key",
              "apiKey": "frontend-api-key",
              "token": "frontend-token",
              "password": "frontend-password",
              "Authorization": "Bearer frontend",
            },
          },
        )

    self.assertEqual(ra_status, 200)
    self.assertEqual(ra_payload, {"user": "Retro Player"})
    self.assertEqual(steam_status, 200)
    self.assertEqual(steam_payload, {"response": {"game_count": 7}})
    self.assertEqual(len(calls), 2)

    retro_call = calls[0]
    steam_call = calls[1]
    self.assertEqual(retro_call["path"], "API/API_GetUserProfile.php")
    self.assertEqual(retro_call["query"], {"u": "frontend-user"})
    self.assertEqual(retro_call["auth_query"], {"u": "sol88", "y": "backend-ra-secret"})
    self.assertEqual(steam_call["path"], "IPlayerService/GetOwnedGames/v1/")
    self.assertEqual(steam_call["query"], {"steamid": "frontend-steamid"})
    self.assertEqual(steam_call["auth_query"], {"steamid": "76561198136628813", "key": "backend-steam-secret"})

    serialized_payloads = json.dumps([ra_payload, steam_payload])
    for forbidden_value in (
      "backend-ra-secret",
      "backend-steam-secret",
      "frontend-api-key",
      "frontend-token",
      "frontend-password",
    ):
      self.assertNotIn(forbidden_value, serialized_payloads)

  def test_steam_handled_status_smoke_flow_returns_safe_envelope(self) -> None:
    token = "request-token"
    calls: list[dict[str, Any]] = []

    def fake_requester(**kwargs: Any) -> dict[str, Any]:
      calls.append(kwargs)
      return {
        "handledHttpError": True,
        "status": 403,
        "statusText": "Forbidden",
        "message": "HTTP 403",
        "durationMs": 5,
      }

    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir), provider_requester=fake_requester)
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        running.request_json(
          "POST",
          "/save_steam_credentials",
          token=token,
          body={
            "steamId64": "76561198136628813",
            "apiKeyDraft": "backend-steam-secret",
            "language": "english",
            "recentAchievementsCount": 3,
            "recentlyPlayedCount": 3,
            "includePlayedFreeGames": True,
          },
        )
        status, payload, _ = running.request_json(
          "POST",
          "/request_steam_json",
          token=token,
          body={
            "path": "IPlayerService/GetRecentlyPlayedGames/v1/",
            "query": {"count": 3},
            "handledHttpStatuses": [403],
          },
        )

    self.assertEqual(status, 200)
    self.assertEqual(
      payload,
      {
        "handledHttpError": True,
        "status": 403,
        "statusText": "Forbidden",
        "message": "HTTP 403",
        "durationMs": 5,
      },
    )
    self.assertEqual(calls[0]["handled_http_statuses"], {403})
    self.assertNotIn("backend-steam-secret", json.dumps(payload))

  def test_provider_request_failure_smoke_flow_returns_safe_diagnostic_envelope(self) -> None:
    token = "request-token"
    original_urlopen = backend_http.urlopen

    def fake_urlopen(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      raise urllib.error.HTTPError(
        url=request.full_url,
        code=403,
        msg="Forbidden",
        hdrs=None,
        fp=io.BytesIO(b"private profile apiKey=secret"),
      )

    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      backend_http.urlopen = fake_urlopen  # type: ignore[assignment]
      try:
        context.paths.config_path.parent.mkdir(parents=True, exist_ok=True)
        context.paths.config_path.write_text(
          json.dumps(
            {
              "version": 1,
              "retroAchievements": {"username": "sol88", "hasApiKey": True},
            },
          ),
          encoding="utf-8",
        )
        secret_helpers.save_secret_api_key(
          context.paths.secrets_path,
          "retroAchievements",
          "backend-ra-secret",
          settings_dir_text=context.settings_dir_text,
        )
        with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
          status, payload, _ = running.request_json(
            "POST",
            "/request_retroachievements_json",
            token=token,
            body={"path": "API/API_GetUserProfile.php", "query": {"u": "sol88"}},
          )
      finally:
        backend_http.urlopen = original_urlopen  # type: ignore[assignment]

    self.assertEqual(status, 502)
    self.assertEqual(payload["ok"], False)
    self.assertEqual(payload["error"], "provider_request_failed")
    self.assertEqual(payload["errorCategory"], "http_error")
    self.assertEqual(payload["providerId"], "retroachievements")
    self.assertEqual(payload["path"], "API/API_GetUserProfile.php")
    self.assertEqual(payload["status"], 403)
    self.assertIsInstance(payload["durationMs"], int)
    self.assertNotIn("backend-ra-secret", json.dumps(payload))
    self.assertNotIn("private profile", json.dumps(payload))

  def test_clear_smoke_flow_only_clears_selected_provider(self) -> None:
    token = "clear-token"
    with tempfile.TemporaryDirectory() as temp_dir:
      context = _create_test_context(Path(temp_dir))
      with _RunningServer(local_server.create_local_backend_server(token=token, context=context)) as running:
        running.request_json(
          "POST",
          "/save_retroachievements_credentials",
          token=token,
          body={
            "username": "sol88",
            "apiKeyDraft": "backend-ra-secret",
            "recentAchievementsCount": 10,
          },
        )
        running.request_json(
          "POST",
          "/save_steam_credentials",
          token=token,
          body={
            "steamId64": "76561198136628813",
            "apiKeyDraft": "backend-steam-secret",
            "language": "english",
            "recentAchievementsCount": 3,
            "recentlyPlayedCount": 3,
            "includePlayedFreeGames": True,
          },
        )
        clear_status, clear_payload, _ = running.request_json(
          "POST",
          "/clear_provider_credentials",
          token=token,
          body={"providerId": "steam"},
        )
        configs_status, configs_payload, _ = running.request_json(
          "POST",
          "/get_provider_configs",
          token=token,
          body={},
        )

    self.assertEqual(clear_status, 200)
    self.assertEqual(clear_payload, {"ok": True, "cleared": True})
    self.assertEqual(configs_status, 200)
    self.assertEqual(configs_payload["retroAchievements"]["hasApiKey"], True)
    self.assertNotIn("steam", configs_payload)

  def test_release_boundary_smoke_keeps_local_backend_out_of_decky_payload(self) -> None:
    source = (ROOT_DIR / "backend" / "local_server.py").read_text(encoding="utf-8")
    package_release = (ROOT_DIR / "scripts" / "package_release.py").read_text(encoding="utf-8")
    check_release = (ROOT_DIR / "scripts" / "check_release_artifact.py").read_text(encoding="utf-8")

    self.assertNotIn("import decky", source)
    self.assertNotIn("from decky", source)
    self.assertNotIn("import main", source)
    self.assertNotIn("from main import", source)
    self.assertNotIn("backend/local_server.py", package_release)
    self.assertNotIn("backend/local_server.py", check_release)
    self.assertNotIn("backend/paths.py", package_release)
    self.assertNotIn("backend/paths.py", check_release)


if __name__ == "__main__":
  unittest.main()
