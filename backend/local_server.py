from __future__ import annotations

import asyncio
import json
import os
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Callable, Iterable, Mapping
from urllib.parse import urlsplit

from backend.cache import (
  clear_dashboard_cache,
  clear_steam_scan_cache,
  read_dashboard_cache,
  read_steam_scan_overview,
  read_steam_scan_summary,
  write_dashboard_cache,
  write_steam_scan_overview,
  write_steam_scan_summary,
)
from backend.diagnostics import sanitize_diagnostic_event
from backend.http import ProviderRequestError, request_json as backend_request_json
from backend.paths import BackendPaths, resolve_steamos_backend_paths
from backend.provider_config import (
  PLUGIN_CONFIG_VERSION,
  build_retroachievements_config_view,
  build_steam_config_view,
  clear_provider_config,
  load_provider_config,
  save_provider_config,
)
from backend.secrets import clear_secret_api_key, load_secret_api_key, save_secret_api_key


LOCAL_BACKEND_HOST = "127.0.0.1"
SERVICE_NAME = "achievement-companion"
LOCAL_BACKEND_CAPABILITIES = ("health", "diagnostics", "provider-config")
MAX_JSON_BODY_BYTES = 1024 * 1024
_RETROACHIEVEMENTS_PROVIDER_KEY = "retroAchievements"
_STEAM_PROVIDER_KEY = "steam"
_RETROACHIEVEMENTS_BASE_URL = "https://retroachievements.org/API/"
_STEAM_BASE_URL = "https://api.steampowered.com/"
_SECRET_QUERY_KEYS = {"apikey", "apikeydraft", "authorization", "key", "password", "secret", "token", "y"}

ProviderRequestCallback = Callable[..., Any]


def create_session_token() -> str:
  return secrets.token_urlsafe(32)


def resolve_runtime_metadata_path(
  *,
  env: Mapping[str, str] | None = None,
) -> Path | None:
  return resolve_steamos_backend_paths(env=env or os.environ).runtime_metadata_path


def write_runtime_metadata(
  path: Path,
  *,
  host: str,
  port: int,
  token: str,
  pid: int | None = None,
  started_at: str | None = None,
) -> None:
  metadata = {
    "host": host,
    "pid": os.getpid() if pid is None else pid,
    "port": port,
    "startedAt": started_at or datetime.now(timezone.utc).isoformat(),
    "token": token,
  }

  path.parent.mkdir(parents=True, exist_ok=True)
  try:
    os.chmod(path.parent, 0o700)
  except OSError:
    pass
  payload = json.dumps(metadata, indent=2, sort_keys=True) + "\n"
  with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp_file:
    temp_path = Path(temp_file.name)
    temp_file.write(payload)

  try:
    os.chmod(temp_path, 0o600)
  except OSError:
    pass

  temp_path.replace(path)
  try:
    os.chmod(path, 0o600)
  except OSError:
    pass


@dataclass
class LocalBackendContext:
  paths: BackendPaths
  settings_dir_text: str
  provider_requester: ProviderRequestCallback | None = None
  warning_events: list[dict[str, Any]] = field(default_factory=list)

  def warn(self, message: str, fields: Mapping[str, Any]) -> None:
    self.warning_events.append(
      {
        "message": message,
        "fields": dict(fields),
      },
    )


def create_local_backend_context(
  *,
  paths: BackendPaths | None = None,
  settings_dir_text: str | None = None,
  provider_requester: ProviderRequestCallback | None = None,
) -> LocalBackendContext:
  resolved_paths = paths or resolve_steamos_backend_paths(env=os.environ)
  resolved_settings_dir_text = settings_dir_text or str(resolved_paths.config_path.parent)
  return LocalBackendContext(
    paths=resolved_paths,
    settings_dir_text=resolved_settings_dir_text,
    provider_requester=provider_requester,
  )


def _coerce_string(value: Any) -> str | None:
  if isinstance(value, str):
    trimmed = value.strip()
    return trimmed if trimmed != "" else None
  return None


def _normalize_positive_count(value: Any, fallback: int) -> int:
  if isinstance(value, bool):
    return fallback
  if isinstance(value, (int, float)) and value > 0:
    return int(value)
  return fallback


def _normalize_optional_positive_count(value: Any) -> int | None:
  if isinstance(value, bool):
    return None
  if isinstance(value, (int, float)) and value > 0:
    return int(value)
  return None


def _normalize_boolean(value: Any, fallback: bool) -> bool:
  if isinstance(value, bool):
    return value
  return fallback


def _load_secret_for_provider(context: LocalBackendContext, provider_key: str) -> str | None:
  return load_secret_api_key(
    context.paths.secrets_path,
    provider_key,
    warn=context.warn,
    settings_dir_text=context.settings_dir_text,
  )


def _resolve_api_key(payload: Mapping[str, Any], provider_key: str, context: LocalBackendContext) -> str | None:
  api_key = _coerce_string(payload.get("apiKey"))
  if api_key is not None:
    return api_key

  draft_api_key = _coerce_string(payload.get("apiKeyDraft"))
  if draft_api_key is not None:
    return draft_api_key

  return _load_secret_for_provider(context, provider_key)


def _build_provider_configs_response(context: LocalBackendContext) -> dict[str, Any]:
  retroachievements_config = build_retroachievements_config_view(
    load_provider_config(context.paths.config_path, _RETROACHIEVEMENTS_PROVIDER_KEY, warn=context.warn),
    _load_secret_for_provider(context, _RETROACHIEVEMENTS_PROVIDER_KEY) is not None,
  )
  steam_config = build_steam_config_view(
    load_provider_config(context.paths.config_path, _STEAM_PROVIDER_KEY, warn=context.warn),
    _load_secret_for_provider(context, _STEAM_PROVIDER_KEY) is not None,
  )

  result: dict[str, Any] = {"version": PLUGIN_CONFIG_VERSION}
  if retroachievements_config is not None:
    result["retroAchievements"] = retroachievements_config
  if steam_config is not None:
    result["steam"] = steam_config
  return result


def _save_retroachievements_credentials(
  context: LocalBackendContext,
  payload: Mapping[str, Any],
) -> dict[str, Any] | None:
  username = _coerce_string(payload.get("username"))
  if username is None:
    return None

  api_key = _resolve_api_key(payload, _RETROACHIEVEMENTS_PROVIDER_KEY, context)
  if api_key is None:
    return None

  existing_config = load_provider_config(context.paths.config_path, _RETROACHIEVEMENTS_PROVIDER_KEY, warn=context.warn) or {}
  recent_achievements_count = _normalize_optional_positive_count(payload.get("recentAchievementsCount"))
  if recent_achievements_count is None:
    recent_achievements_count = _normalize_optional_positive_count(existing_config.get("recentAchievementsCount"))

  recently_played_count = _normalize_optional_positive_count(payload.get("recentlyPlayedCount"))
  if recently_played_count is None:
    recently_played_count = _normalize_optional_positive_count(existing_config.get("recentlyPlayedCount"))

  save_secret_api_key(
    context.paths.secrets_path,
    _RETROACHIEVEMENTS_PROVIDER_KEY,
    api_key,
    warn=context.warn,
    settings_dir_text=context.settings_dir_text,
  )

  config: dict[str, Any] = {
    "username": username,
    "hasApiKey": True,
  }
  if recent_achievements_count is not None:
    config["recentAchievementsCount"] = recent_achievements_count
  if recently_played_count is not None:
    config["recentlyPlayedCount"] = recently_played_count

  save_provider_config(
    context.paths.config_path,
    _RETROACHIEVEMENTS_PROVIDER_KEY,
    config,
    warn=context.warn,
  )
  return build_retroachievements_config_view(config, True)


def _save_steam_credentials(
  context: LocalBackendContext,
  payload: Mapping[str, Any],
) -> dict[str, Any] | None:
  steam_id64 = _coerce_string(payload.get("steamId64"))
  if steam_id64 is None:
    return None

  api_key = _resolve_api_key(payload, _STEAM_PROVIDER_KEY, context)
  if api_key is None:
    return None

  config = {
    "steamId64": steam_id64,
    "hasApiKey": True,
    "language": _coerce_string(payload.get("language")) or "english",
    "recentAchievementsCount": _normalize_positive_count(payload.get("recentAchievementsCount"), 5),
    "recentlyPlayedCount": _normalize_positive_count(payload.get("recentlyPlayedCount"), 5),
    "includePlayedFreeGames": _normalize_boolean(payload.get("includePlayedFreeGames"), False),
  }

  save_secret_api_key(
    context.paths.secrets_path,
    _STEAM_PROVIDER_KEY,
    api_key,
    warn=context.warn,
    settings_dir_text=context.settings_dir_text,
  )
  save_provider_config(
    context.paths.config_path,
    _STEAM_PROVIDER_KEY,
    config,
    warn=context.warn,
  )
  return build_steam_config_view(config, True)


def _clear_provider_credentials(
  context: LocalBackendContext,
  payload: Mapping[str, Any],
) -> bool | None:
  provider_id = _coerce_string(payload.get("providerId"))
  if provider_id is None:
    return None

  provider_key = None
  if provider_id == "retroachievements":
    provider_key = _RETROACHIEVEMENTS_PROVIDER_KEY
  elif provider_id == "steam":
    provider_key = _STEAM_PROVIDER_KEY

  if provider_key is None:
    return None

  removed_any = False
  if load_provider_config(context.paths.config_path, provider_key, warn=context.warn) is not None:
    clear_provider_config(context.paths.config_path, provider_key, warn=context.warn)
    removed_any = True
  if _load_secret_for_provider(context, provider_key) is not None:
    clear_secret_api_key(context.paths.secrets_path, provider_key, warn=context.warn)
    removed_any = True
  return removed_any


def _extract_object_payload_value(payload: Mapping[str, Any], field_name: str) -> Mapping[str, Any] | None:
  value = payload.get(field_name)
  return value if isinstance(value, Mapping) else None


def _validate_provider_path(value: Any) -> str | None:
  path = _coerce_string(value)
  if path is None:
    return None
  parsed = urlsplit(path)
  if parsed.scheme != "" or parsed.netloc != "" or path.startswith(("/", "\\")):
    return None
  normalized_parts = path.replace("\\", "/").split("/")
  if any(part == ".." for part in normalized_parts):
    return None
  return path


def _validate_retroachievements_provider_path(value: Any) -> str | None:
  path = _validate_provider_path(value)
  if path is None:
    return None

  normalized_path = path.replace("\\", "/")
  if normalized_path.startswith("API/"):
    normalized_path = normalized_path[len("API/") :]

  if "/" in normalized_path or normalized_path == "":
    return None

  return normalized_path


def _sanitize_request_query(value: Any) -> dict[str, Any] | None:
  if value is None:
    return {}
  if not isinstance(value, Mapping):
    return None

  query: dict[str, Any] = {}
  for key, raw_value in value.items():
    if not isinstance(key, str):
      continue
    if key.strip().lower() in _SECRET_QUERY_KEYS:
      continue
    query[key] = raw_value
  return query


def _parse_handled_http_statuses(value: Any) -> set[int] | None:
  if not isinstance(value, list):
    return None

  handled_statuses: set[int] = set()
  for status_value in value:
    if isinstance(status_value, bool):
      continue
    if isinstance(status_value, (int, float)) and status_value >= 0:
      handled_statuses.add(int(status_value))
  return handled_statuses or None


async def _request_provider_json_async(
  *,
  provider_id: str,
  provider_label: str,
  base_url: str,
  path: str,
  query: Mapping[str, Any] | None,
  auth_query: Mapping[str, Any],
  handled_http_statuses: set[int] | None = None,
) -> Any:
  return backend_request_json(
    provider_id=provider_id,
    provider_label=provider_label,
    base_url=base_url,
    path=path,
    query=query,
    auth_query=auth_query,
    handled_http_statuses=handled_http_statuses,
  )


def _request_provider_json(
  context: LocalBackendContext,
  *,
  provider_id: str,
  provider_label: str,
  base_url: str,
  path: str,
  query: Mapping[str, Any] | None,
  auth_query: Mapping[str, Any],
  handled_http_statuses: set[int] | None = None,
) -> Any:
  if context.provider_requester is not None:
    return context.provider_requester(
      provider_id=provider_id,
      provider_label=provider_label,
      base_url=base_url,
      path=path,
      query=query,
      auth_query=auth_query,
      handled_http_statuses=handled_http_statuses,
    )

  return asyncio.run(
    _request_provider_json_async(
      provider_id=provider_id,
      provider_label=provider_label,
      base_url=base_url,
      path=path,
      query=query,
      auth_query=auth_query,
      handled_http_statuses=handled_http_statuses,
    ),
  )


def _build_provider_request_failure_payload(error: ProviderRequestError) -> dict[str, Any]:
  payload: dict[str, Any] = {
    "ok": False,
    "error": "provider_request_failed",
    "errorCategory": error.category,
    "providerId": error.provider_id,
    "path": error.path,
    "durationMs": error.duration_ms,
  }
  if error.status_code is not None:
    payload["status"] = error.status_code
  return payload


def _read_json_object(path: Path | None) -> dict[str, Any] | None:
  if path is None or not path.exists():
    return None

  try:
    raw_text = path.read_text(encoding="utf-8")
  except OSError:
    return None

  if raw_text.strip() == "":
    return None

  try:
    payload = json.loads(raw_text)
  except json.JSONDecodeError:
    return None

  return payload if isinstance(payload, dict) else None


def _safe_file_metadata(path: Path | None) -> dict[str, Any]:
  if path is None:
    return {"present": False}

  try:
    stat_result = path.stat()
  except OSError:
    return {"present": False}

  return {
    "present": True,
    "sizeBytes": stat_result.st_size,
    "mtimeMs": int(stat_result.st_mtime * 1000),
  }


def _is_valid_runtime_metadata(payload: Mapping[str, Any]) -> bool:
  host = payload.get("host")
  port = payload.get("port")
  pid = payload.get("pid")
  token = payload.get("token")
  started_at = payload.get("startedAt")
  if host != LOCAL_BACKEND_HOST:
    return False
  if not isinstance(port, (int, float)) or isinstance(port, bool) or int(port) <= 0 or int(port) > 65_535:
    return False
  if not isinstance(pid, (int, float)) or isinstance(pid, bool) or int(pid) <= 0:
    return False
  if not isinstance(token, str) or token.strip() != token or len(token) < 32:
    return False
  if not isinstance(started_at, str):
    return False
  try:
    datetime.fromisoformat(started_at)
  except ValueError:
    return False
  return True


def _build_runtime_metadata_status(path: Path | None) -> dict[str, Any]:
  metadata_status = _safe_file_metadata(path)
  if path is None or metadata_status["present"] is not True:
    return {
      "present": False,
      "valid": False,
    }

  payload = _read_json_object(path)
  if payload is None:
    return {
      **metadata_status,
      "valid": False,
    }

  return {
    **metadata_status,
    "valid": _is_valid_runtime_metadata(payload),
  }


def _build_dashboard_cache_status(path: Path | None) -> dict[str, Any]:
  cache_status = _safe_file_metadata(path)
  if path is None or cache_status["present"] is not True:
    return {
      "present": False,
      "valid": False,
    }

  payload = _read_json_object(path)
  if payload is None:
    return {
      **cache_status,
      "valid": False,
    }

  result: dict[str, Any] = {
    **cache_status,
    "valid": True,
  }
  refreshed_at = payload.get("refreshedAt")
  if isinstance(refreshed_at, (int, float)) and not isinstance(refreshed_at, bool):
    result["refreshedAtMs"] = int(refreshed_at)
  return result


def _extract_scan_refreshed_at_ms(payload: Mapping[str, Any]) -> int | None:
  refreshed_at = payload.get("refreshedAt")
  if isinstance(refreshed_at, (int, float)) and not isinstance(refreshed_at, bool):
    return int(refreshed_at)

  scanned_at = payload.get("scannedAt")
  if not isinstance(scanned_at, str):
    return None

  try:
    return int(datetime.fromisoformat(scanned_at).timestamp() * 1000)
  except ValueError:
    return None


def _build_steam_scan_cache_status(path: Path | None) -> dict[str, Any]:
  if path is None:
    return {
      "present": False,
      "valid": False,
    }

  cache_status = _safe_file_metadata(path)
  if cache_status["present"] is not True:
    return {
      "present": False,
      "valid": False,
    }

  payload = _read_json_object(path)
  if payload is None:
    return {
      **cache_status,
      "valid": False,
    }

  result: dict[str, Any] = {
    **cache_status,
    "valid": True,
  }
  refreshed_at_ms = _extract_scan_refreshed_at_ms(payload)
  if refreshed_at_ms is not None:
    result["refreshedAtMs"] = refreshed_at_ms
  return result


def _build_steamos_diagnostics_status(context: LocalBackendContext) -> dict[str, Any]:
  provider_config_store = _read_json_object(context.paths.config_path)
  provider_secrets_store = _read_json_object(context.paths.secrets_path)

  retroachievements_config = (
    provider_config_store.get(_RETROACHIEVEMENTS_PROVIDER_KEY)
    if isinstance(provider_config_store, Mapping)
    else None
  )
  steam_config = provider_config_store.get(_STEAM_PROVIDER_KEY) if isinstance(provider_config_store, Mapping) else None
  retroachievements_secret = (
    provider_secrets_store.get(_RETROACHIEVEMENTS_PROVIDER_KEY)
    if isinstance(provider_secrets_store, Mapping)
    else None
  )
  steam_secret = provider_secrets_store.get(_STEAM_PROVIDER_KEY) if isinstance(provider_secrets_store, Mapping) else None

  retroachievements_username_present = (
    _coerce_string(retroachievements_config.get("username")) is not None
    if isinstance(retroachievements_config, Mapping)
    else False
  )
  steam_id64_present = (
    _coerce_string(steam_config.get("steamId64")) is not None
    if isinstance(steam_config, Mapping)
    else False
  )

  retroachievements_has_api_key = isinstance(retroachievements_secret, Mapping)
  steam_has_api_key = isinstance(steam_secret, Mapping)

  return {
    "ok": True,
    "backendReachable": True,
    "runtimeMetadata": _build_runtime_metadata_status(context.paths.runtime_metadata_path),
    "providerConfigFilePresent": context.paths.config_path.exists(),
    "providerSecretsFilePresent": context.paths.secrets_path.exists(),
    "retroAchievements": {
      "configured": retroachievements_username_present and retroachievements_has_api_key,
      "usernamePresent": retroachievements_username_present,
      "hasApiKey": retroachievements_has_api_key,
    },
    "steam": {
      "configured": steam_id64_present and steam_has_api_key,
      "steamId64Present": steam_id64_present,
      "hasApiKey": steam_has_api_key,
    },
    "steamLibraryScanCache": _build_steam_scan_cache_status(
      context.paths.steam_scan_overview_path,
    ),
    "dashboardCache": {
      "retroAchievements": _build_dashboard_cache_status(
        context.paths.dashboard_cache_dir / f"{_RETROACHIEVEMENTS_PROVIDER_KEY}.json",
      ),
      "steam": _build_dashboard_cache_status(
        context.paths.dashboard_cache_dir / f"{_STEAM_PROVIDER_KEY}.json",
      ),
    },
  }


def _request_retroachievements_json(
  context: LocalBackendContext,
  payload: Mapping[str, Any],
) -> tuple[int, Any]:
  path = _validate_retroachievements_provider_path(payload.get("path"))
  query = _sanitize_request_query(payload.get("query"))
  if path is None or query is None:
    return 400, {"ok": False, "error": "invalid_payload"}

  config = build_retroachievements_config_view(
    load_provider_config(context.paths.config_path, _RETROACHIEVEMENTS_PROVIDER_KEY, warn=context.warn),
    _load_secret_for_provider(context, _RETROACHIEVEMENTS_PROVIDER_KEY) is not None,
  )
  secret = _load_secret_for_provider(context, _RETROACHIEVEMENTS_PROVIDER_KEY)
  if config is None or config.get("hasApiKey") is not True or secret is None:
    return 403, {"ok": False, "error": "credentials_missing"}

  try:
    return 200, _request_provider_json(
      context,
      provider_id="retroachievements",
      provider_label="RetroAchievements",
      base_url=_RETROACHIEVEMENTS_BASE_URL,
      path=path,
      query=query,
      auth_query={
        "u": config["username"],
        "y": secret,
      },
    )
  except ProviderRequestError as error:
    return 502, _build_provider_request_failure_payload(error)
  except RuntimeError:
    return 502, {"ok": False, "error": "provider_request_failed"}


def _request_steam_json(
  context: LocalBackendContext,
  payload: Mapping[str, Any],
) -> tuple[int, Any]:
  path = _validate_provider_path(payload.get("path"))
  query = _sanitize_request_query(payload.get("query"))
  if path is None or query is None:
    return 400, {"ok": False, "error": "invalid_payload"}

  config = build_steam_config_view(
    load_provider_config(context.paths.config_path, _STEAM_PROVIDER_KEY, warn=context.warn),
    _load_secret_for_provider(context, _STEAM_PROVIDER_KEY) is not None,
  )
  secret = _load_secret_for_provider(context, _STEAM_PROVIDER_KEY)
  if config is None or config.get("hasApiKey") is not True or secret is None:
    return 403, {"ok": False, "error": "credentials_missing"}

  try:
    return 200, _request_provider_json(
      context,
      provider_id="steam",
      provider_label="Steam",
      base_url=_STEAM_BASE_URL,
      path=path,
      query=query,
      auth_query={
        "steamid": config["steamId64"],
        "key": secret,
      },
      handled_http_statuses=_parse_handled_http_statuses(payload.get("handledHttpStatuses")),
    )
  except ProviderRequestError as error:
    return 502, _build_provider_request_failure_payload(error)
  except RuntimeError:
    return 502, {"ok": False, "error": "provider_request_failed"}


def _request_steamos_diagnostics_status(
  context: LocalBackendContext,
  payload: Mapping[str, Any],
) -> tuple[int, Any]:
  if not isinstance(payload, Mapping):
    return 400, {"ok": False, "error": "invalid_payload"}

  return 200, _build_steamos_diagnostics_status(context)


class LocalBackendHTTPServer(HTTPServer):
  def __init__(
    self,
    server_address: tuple[str, int],
    token: str,
    allowed_origins: Iterable[str] = (),
    context: LocalBackendContext | None = None,
  ) -> None:
    super().__init__(server_address, LocalBackendRequestHandler)
    self.session_token = token
    self.allowed_origins = frozenset(allowed_origins)
    self.context = context or create_local_backend_context()
    self.diagnostic_events: list[dict[str, Any]] = []
    self.warning_events = self.context.warning_events


class LocalBackendRequestHandler(BaseHTTPRequestHandler):
  server: LocalBackendHTTPServer

  def log_message(self, format: str, *args: Any) -> None:
    del format, args

  def do_GET(self) -> None:
    path = self._path_without_query()
    if path == "/health":
      self._send_json(
        200,
        {
          "ok": True,
          "service": SERVICE_NAME,
          "capabilities": list(LOCAL_BACKEND_CAPABILITIES),
        },
      )
      return

    if path in {
      "/record_diagnostic_event",
      "/get_provider_configs",
      "/save_retroachievements_credentials",
      "/save_steam_credentials",
      "/clear_provider_credentials",
      "/diagnostics/steamos/status",
      "/cache/dashboard/read",
      "/cache/dashboard/write",
      "/cache/dashboard/clear",
      "/cache/steam-scan/read-overview",
      "/cache/steam-scan/write-overview",
      "/cache/steam-scan/read-summary",
      "/cache/steam-scan/write-summary",
      "/cache/steam-scan/clear",
      "/request_retroachievements_json",
      "/request_steam_json",
    }:
      self._send_method_not_allowed(("POST", "OPTIONS"))
      return

    if not self._authorize_request():
      return

    self._send_json(404, {"ok": False, "error": "not_found"})

  def do_POST(self) -> None:
    path = self._path_without_query()
    if path == "/health":
      self._send_method_not_allowed(("GET",))
      return

    if not self._authorize_request():
      return

    if path == "/record_diagnostic_event":
      self._handle_record_diagnostic_event()
      return
    if path == "/get_provider_configs":
      self._handle_get_provider_configs()
      return
    if path == "/save_retroachievements_credentials":
      self._handle_save_retroachievements_credentials()
      return
    if path == "/save_steam_credentials":
      self._handle_save_steam_credentials()
      return
    if path == "/clear_provider_credentials":
      self._handle_clear_provider_credentials()
      return
    if path == "/diagnostics/steamos/status":
      self._handle_steamos_diagnostics_status()
      return
    if path == "/cache/dashboard/read":
      self._handle_cache_dashboard_read()
      return
    if path == "/cache/dashboard/write":
      self._handle_cache_dashboard_write()
      return
    if path == "/cache/dashboard/clear":
      self._handle_cache_dashboard_clear()
      return
    if path == "/cache/steam-scan/read-overview":
      self._handle_cache_steam_scan_read_overview()
      return
    if path == "/cache/steam-scan/write-overview":
      self._handle_cache_steam_scan_write_overview()
      return
    if path == "/cache/steam-scan/read-summary":
      self._handle_cache_steam_scan_read_summary()
      return
    if path == "/cache/steam-scan/write-summary":
      self._handle_cache_steam_scan_write_summary()
      return
    if path == "/cache/steam-scan/clear":
      self._handle_cache_steam_scan_clear()
      return
    if path == "/request_retroachievements_json":
      self._handle_request_retroachievements_json()
      return
    if path == "/request_steam_json":
      self._handle_request_steam_json()
      return

    self._send_json(404, {"ok": False, "error": "not_found"})

  def do_OPTIONS(self) -> None:
    path = self._path_without_query()
    if path not in {
      "/health",
      "/record_diagnostic_event",
      "/get_provider_configs",
      "/save_retroachievements_credentials",
      "/save_steam_credentials",
      "/clear_provider_credentials",
      "/diagnostics/steamos/status",
      "/cache/dashboard/read",
      "/cache/dashboard/write",
      "/cache/dashboard/clear",
      "/cache/steam-scan/read-overview",
      "/cache/steam-scan/write-overview",
      "/cache/steam-scan/read-summary",
      "/cache/steam-scan/write-summary",
      "/cache/steam-scan/clear",
      "/request_retroachievements_json",
      "/request_steam_json",
    }:
      self._send_json(404, {"ok": False, "error": "not_found"})
      return

    origin = self.headers.get("Origin")
    if origin is None or origin not in self.server.allowed_origins:
      self._send_json(403, {"ok": False, "error": "origin_forbidden"})
      return

    allowed_methods = ("GET", "OPTIONS") if path == "/health" else ("POST", "OPTIONS")
    self.send_response(204)
    self.send_header("Content-Length", "0")
    self.send_header("Cache-Control", "no-store")
    self.send_header("Access-Control-Allow-Origin", origin)
    self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
    self.send_header("Access-Control-Allow-Methods", ", ".join(allowed_methods))
    self.send_header("Vary", "Origin")
    self.end_headers()

  def do_DELETE(self) -> None:
    self._handle_unsupported_method()

  def do_PUT(self) -> None:
    self._handle_unsupported_method()

  def _handle_record_diagnostic_event(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    sanitized_event = sanitize_diagnostic_event(payload)
    recorded = sanitized_event is not None
    if sanitized_event is not None:
      self.server.diagnostic_events.append(sanitized_event)

    self._send_json(200, {"ok": True, "recorded": recorded})

  def _handle_get_provider_configs(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    self._send_json(200, _build_provider_configs_response(self.server.context))

  def _handle_save_retroachievements_credentials(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    config = _save_retroachievements_credentials(self.server.context, payload)
    if config is None:
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    self._send_json(200, config)

  def _handle_save_steam_credentials(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    config = _save_steam_credentials(self.server.context, payload)
    if config is None:
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    self._send_json(200, config)

  def _handle_clear_provider_credentials(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    cleared = _clear_provider_credentials(self.server.context, payload)
    if cleared is None:
      self._send_json(400, {"ok": False, "error": "invalid_provider_id"})
      return

    self._send_json(200, {"ok": True, "cleared": cleared})

  def _handle_steamos_diagnostics_status(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    response_status, response_payload = _request_steamos_diagnostics_status(self.server.context, payload)
    self._send_json(response_status, response_payload)

  def _handle_cache_dashboard_read(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    try:
      response = read_dashboard_cache(
        self.server.context.paths,
        payload.get("providerId"),
        warn=self.server.context.warn,
      )
    except ValueError:
      self._send_json(400, {"ok": False, "error": "invalid_provider_id"})
      return

    self._send_json(200, response)

  def _handle_cache_dashboard_write(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    cache_value = _extract_object_payload_value(payload, "value")
    if cache_value is None:
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    try:
      write_dashboard_cache(self.server.context.paths, payload.get("providerId"), cache_value)
    except ValueError as error:
      if str(error) == "invalid provider id":
        self._send_json(400, {"ok": False, "error": "invalid_provider_id"})
        return
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return
    except TypeError:
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    self._send_json(200, {"ok": True})

  def _handle_cache_dashboard_clear(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    provider_id = payload.get("providerId")
    try:
      cleared = clear_dashboard_cache(self.server.context.paths, provider_id)
    except ValueError:
      self._send_json(400, {"ok": False, "error": "invalid_provider_id"})
      return

    self._send_json(200, {"ok": True, "cleared": cleared})

  def _handle_cache_steam_scan_read_overview(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    self._send_json(200, read_steam_scan_overview(self.server.context.paths, warn=self.server.context.warn))

  def _handle_cache_steam_scan_write_overview(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    cache_value = _extract_object_payload_value(payload, "value")
    if cache_value is None:
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    try:
      write_steam_scan_overview(self.server.context.paths, cache_value)
    except (TypeError, ValueError):
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    self._send_json(200, {"ok": True})

  def _handle_cache_steam_scan_read_summary(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    self._send_json(200, read_steam_scan_summary(self.server.context.paths, warn=self.server.context.warn))

  def _handle_cache_steam_scan_write_summary(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    cache_value = _extract_object_payload_value(payload, "value")
    if cache_value is None:
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    try:
      write_steam_scan_summary(self.server.context.paths, cache_value)
    except (TypeError, ValueError):
      self._send_json(400, {"ok": False, "error": "invalid_payload"})
      return

    self._send_json(200, {"ok": True})

  def _handle_cache_steam_scan_clear(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    self._send_json(200, {"ok": True, "cleared": clear_steam_scan_cache(self.server.context.paths)})

  def _handle_request_retroachievements_json(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    response_status, response_payload = _request_retroachievements_json(self.server.context, payload)
    self._send_json(response_status, response_payload)

  def _handle_request_steam_json(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    response_status, response_payload = _request_steam_json(self.server.context, payload)
    self._send_json(response_status, response_payload)

  def _authorize_request(self) -> bool:
    origin = self.headers.get("Origin")
    if origin is not None and origin not in self.server.allowed_origins:
      self._discard_announced_request_body()
      self._send_json(403, {"ok": False, "error": "origin_forbidden"})
      return False

    provided_token = self._parse_bearer_token(self.headers.get("Authorization"))
    if provided_token != self.server.session_token:
      self._discard_announced_request_body()
      self._send_json(401, {"ok": False, "error": "unauthorized"})
      return False

    return True

  def _read_json_body(self) -> tuple[int, dict[str, Any] | None]:
    content_type = self.headers.get("Content-Type")
    if content_type is None:
      return 415, None
    normalized_content_type = content_type.split(";", 1)[0].strip().lower()
    if normalized_content_type != "application/json":
      return 415, None

    raw_length = self.headers.get("Content-Length", "0")
    try:
      length = int(raw_length)
    except ValueError:
      return 400, None
    if length <= 0:
      return 400, None
    if length > MAX_JSON_BODY_BYTES:
      self._discard_request_body(length)
      return 413, None

    try:
      raw_body = self.rfile.read(length)
      payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
      return 400, None

    return (200, payload) if isinstance(payload, dict) else (400, None)

  def _send_json(self, status: int, payload: dict[str, Any]) -> None:
    response = json.dumps(payload, sort_keys=True).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(response)))
    self.send_header("Cache-Control", "no-store")
    origin = self.headers.get("Origin")
    if origin is not None and origin in self.server.allowed_origins:
      self.send_header("Access-Control-Allow-Origin", origin)
      self.send_header("Vary", "Origin")
    self.end_headers()
    self.wfile.write(response)

  def _path_without_query(self) -> str:
    return self.path.split("?", 1)[0]

  def _discard_request_body(self, length: int) -> None:
    remaining = length
    while remaining > 0:
      chunk = self.rfile.read(min(remaining, 65536))
      if not chunk:
        break
      remaining -= len(chunk)

  def _discard_announced_request_body(self) -> None:
    raw_length = self.headers.get("Content-Length")
    if raw_length is None:
      return
    try:
      length = int(raw_length)
    except ValueError:
      return
    if length > 0:
      self._discard_request_body(length)

  def _handle_unsupported_method(self) -> None:
    path = self._path_without_query()
    if path == "/health":
      self._send_method_not_allowed(("GET", "OPTIONS"))
      return
    if path in {
      "/record_diagnostic_event",
      "/get_provider_configs",
      "/save_retroachievements_credentials",
      "/save_steam_credentials",
      "/clear_provider_credentials",
      "/diagnostics/steamos/status",
      "/cache/dashboard/read",
      "/cache/dashboard/write",
      "/cache/dashboard/clear",
      "/cache/steam-scan/read-overview",
      "/cache/steam-scan/write-overview",
      "/cache/steam-scan/read-summary",
      "/cache/steam-scan/write-summary",
      "/cache/steam-scan/clear",
      "/request_retroachievements_json",
      "/request_steam_json",
    }:
      self._send_method_not_allowed(("POST", "OPTIONS"))
      return
    self._send_json(404, {"ok": False, "error": "not_found"})

  def _send_method_not_allowed(self, allowed_methods: Iterable[str]) -> None:
    self.send_response(405)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Cache-Control", "no-store")
    self.send_header("Allow", ", ".join(allowed_methods))
    self.end_headers()
    self.wfile.write(json.dumps({"ok": False, "error": "method_not_allowed"}, sort_keys=True).encode("utf-8"))

  @staticmethod
  def _parse_bearer_token(authorization_header: str | None) -> str | None:
    if authorization_header is None:
      return None
    if authorization_header.count(" ") != 1:
      return None
    scheme, token = authorization_header.split(" ", 1)
    if scheme != "Bearer" or token == "":
      return None
    return token

  @staticmethod
  def _json_error_code(status: int) -> str:
    if status == 413:
      return "payload_too_large"
    if status == 415:
      return "unsupported_media_type"
    return "invalid_json"


def create_local_backend_server(
  *,
  host: str = LOCAL_BACKEND_HOST,
  port: int = 0,
  token: str | None = None,
  allowed_origins: Iterable[str] = (),
  context: LocalBackendContext | None = None,
) -> LocalBackendHTTPServer:
  if host != LOCAL_BACKEND_HOST:
    raise ValueError("Local backend server must bind to 127.0.0.1.")

  return LocalBackendHTTPServer((host, port), token or create_session_token(), allowed_origins, context=context)
