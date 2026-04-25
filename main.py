from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Mapping

import decky
from backend.redaction import is_secret_key as _is_secret_key
from backend.redaction import redact_text as _redact_text
from backend.redaction import redact_value as _redact_value
from backend.provider_config import build_retroachievements_config_view as _build_retroachievements_config_view
from backend.provider_config import build_steam_config_view as _build_steam_config_view
from backend.provider_config import clear_provider_config as _provider_clear_provider_config
from backend.provider_config import PLUGIN_CONFIG_VERSION
from backend.provider_config import load_provider_config as _provider_load_provider_config
from backend.provider_config import load_provider_config_store as _provider_load_provider_config_store
from backend.provider_config import save_provider_config as _provider_save_provider_config
from backend.provider_config import _normalize_boolean as _normalize_boolean
from backend.provider_config import _normalize_optional_positive_count as _normalize_optional_positive_count
from backend.provider_config import _normalize_positive_count as _normalize_positive_count
from backend.secrets import _load_secret_store as _provider_load_secret_store
from backend.secrets import clear_secret_api_key as _provider_clear_secret_api_key
from backend.secrets import load_secret_api_key as _provider_load_secret_api_key
from backend.secrets import save_secret_api_key as _provider_save_secret_api_key
from backend.storage import build_corrupt_backup_path as _build_corrupt_backup_path
from backend.storage import quarantine_corrupt_json_file as _quarantine_corrupt_json_file
from backend.storage import read_json_file as _read_json_file
from backend.storage import write_json_file as _write_json_file

REQUEST_TIMEOUT_SECONDS = 20
SLOW_PROVIDER_REQUEST_LOG_THRESHOLD_MS = 2000
BACKEND_HTTP_USER_AGENT = "Achievement Companion Decky Plugin"
BACKEND_HTTP_CA_CANDIDATES = (
  ("system-cert.pem", Path("/etc/ssl/cert.pem")),
  ("system-ca-certificates.crt", Path("/etc/ssl/certs/ca-certificates.crt")),
  ("system-tls-ca-bundle.pem", Path("/etc/ca-certificates/extracted/tls-ca-bundle.pem")),
)

SETTINGS_PATH = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
LOGS_PATH = SETTINGS_PATH.parent.parent / "logs" / "achievement-companion"
CONFIG_PATH = SETTINGS_PATH / "provider-config.json"
SECRETS_PATH = SETTINGS_PATH / "provider-secrets.json"

DIAGNOSTIC_EVENT_MESSAGES = {
  "dashboard_refresh_started": "Dashboard refresh started",
  "dashboard_refresh_completed": "Dashboard refresh completed",
  "dashboard_refresh_failed": "Dashboard refresh failed",
  "steam_library_scan_started": "Steam library scan started",
  "steam_library_scan_progress": "Steam library scan progress",
  "steam_library_scan_completed": "Steam library scan completed",
  "steam_library_scan_failed": "Steam library scan failed",
}

DIAGNOSTIC_EVENT_ALLOWED_FIELDS = {
  "dashboard_refresh_started": ("providerId", "mode"),
  "dashboard_refresh_completed": ("providerId", "mode", "durationMs", "source"),
  "dashboard_refresh_failed": ("providerId", "mode", "durationMs", "errorKind"),
  "steam_library_scan_started": ("providerId", "ownedGameCount"),
  "steam_library_scan_progress": ("providerId", "ownedGameCount", "scannedGameCount", "skippedGameCount", "failedGameCount"),
  "steam_library_scan_completed": (
    "providerId",
    "durationMs",
    "ownedGameCount",
    "scannedGameCount",
    "gamesWithAchievements",
    "skippedGameCount",
    "failedGameCount",
    "totalAchievements",
    "unlockedAchievements",
    "perfectGames",
    "completionPercent",
  ),
  "steam_library_scan_failed": (
    "providerId",
    "durationMs",
    "ownedGameCount",
    "scannedGameCount",
    "skippedGameCount",
    "failedGameCount",
    "errorKind",
  ),
}


def _sanitize_backend_runtime_environment() -> None:
  ld_library_path = os.environ.get("LD_LIBRARY_PATH")
  if ld_library_path is None:
    return

  if "/tmp/_MEI" not in ld_library_path:
    return

  os.environ.pop("LD_LIBRARY_PATH", None)


_sanitize_backend_runtime_environment()


def _storage_warning(message: str, fields: Mapping[str, Any]) -> None:
  _log("warning", message, **dict(fields))


def _load_provider_config_store() -> dict[str, Any]:
  return _provider_load_provider_config_store(CONFIG_PATH, warn=_storage_warning)


def _load_provider_config(provider_key: str) -> dict[str, Any] | None:
  return _provider_load_provider_config(CONFIG_PATH, provider_key, warn=_storage_warning)


def _save_provider_config(provider_key: str, config: dict[str, Any]) -> None:
  _provider_save_provider_config(CONFIG_PATH, provider_key, config, warn=_storage_warning)


def _clear_provider_config(provider_key: str) -> None:
  _provider_clear_provider_config(CONFIG_PATH, provider_key, warn=_storage_warning)


def _load_secret_store() -> dict[str, Any]:
  return _provider_load_secret_store(SECRETS_PATH, warn=_storage_warning)


def _load_secret_api_key(provider_key: str) -> str | None:
  return _provider_load_secret_api_key(
    SECRETS_PATH,
    provider_key,
    warn=_storage_warning,
    settings_dir_text=decky.DECKY_PLUGIN_SETTINGS_DIR,
  )


def _save_secret_api_key(provider_key: str, api_key: str) -> None:
  _provider_save_secret_api_key(
    SECRETS_PATH,
    provider_key,
    api_key,
    warn=_storage_warning,
    settings_dir_text=decky.DECKY_PLUGIN_SETTINGS_DIR,
  )


def _clear_secret_api_key(provider_key: str) -> None:
  _provider_clear_secret_api_key(SECRETS_PATH, provider_key, warn=_storage_warning)


def _coerce_positive_int(value: Any) -> int | None:
  if isinstance(value, bool):
    return None

  if isinstance(value, (int, float)) and value >= 0:
    return int(value)

  return None


def _coerce_string(value: Any) -> str | None:
  if isinstance(value, str):
    trimmed = value.strip()
    return trimmed if trimmed != "" else None
  return None


def _record_diagnostic_event(payload: Mapping[str, Any]) -> bool:
  event = _coerce_string(payload.get("event"))
  if event is None or event not in DIAGNOSTIC_EVENT_MESSAGES:
    return False

  allowed_fields = DIAGNOSTIC_EVENT_ALLOWED_FIELDS[event]
  fields: dict[str, Any] = {}

  for field_name in allowed_fields:
    raw_value = payload.get(field_name)
    if field_name in {"durationMs", "ownedGameCount", "scannedGameCount", "skippedGameCount", "failedGameCount", "gamesWithAchievements", "totalAchievements", "unlockedAchievements", "perfectGames", "completionPercent"}:
      numeric_value = _coerce_positive_int(raw_value)
      if numeric_value is not None:
        fields[field_name] = numeric_value
      continue

    if field_name in {"providerId", "mode", "source", "errorKind"}:
      coerced_value = _coerce_string(raw_value)
      if coerced_value is not None:
        fields[field_name] = coerced_value

  _log("info", DIAGNOSTIC_EVENT_MESSAGES[event], **fields)
  return True


def _log(level: str, message: str, **fields: Any) -> None:
  message = _redact_text(message)
  payload = json.dumps(_redact_value(fields), ensure_ascii=False, separators=(",", ":")) if fields else ""
  if payload:
    getattr(decky.logger, level)("%s %s", message, payload)
  else:
    getattr(decky.logger, level)(message)


def _resolve_api_key(payload: Mapping[str, Any], provider_key: str) -> str | None:
  api_key = _coerce_string(payload.get("apiKey"))
  if api_key is not None:
    return api_key

  draft_api_key = _coerce_string(payload.get("apiKeyDraft"))
  if draft_api_key is not None:
    return draft_api_key

  existing_api_key = _load_secret_api_key(provider_key)
  return existing_api_key


_backend_http_ssl_context = None
_backend_http_ssl_context_source: str | None = None


def _select_backend_ca_source() -> tuple[str | None, str | None]:
  for label, candidate in BACKEND_HTTP_CA_CANDIDATES:
    if candidate.exists():
      return str(candidate), label

  try:
    import certifi
  except Exception:
    certifi = None

  if certifi is not None:
    candidate = Path(certifi.where())
    if candidate.exists():
      return str(candidate), "certifi"

  return None, None


def _get_backend_http_ssl_context():
  global _backend_http_ssl_context
  global _backend_http_ssl_context_source

  if _backend_http_ssl_context is not None:
    return _backend_http_ssl_context

  import ssl

  ca_file, source = _select_backend_ca_source()
  if ca_file is not None:
    try:
      _backend_http_ssl_context = ssl.create_default_context(cafile=ca_file)
      _backend_http_ssl_context_source = source or ca_file
    except OSError as cause:
      decky.logger.warning(
        "Unable to load backend TLS CA file",
        extra={"path": ca_file, "error": str(cause)},
      )

  if _backend_http_ssl_context is None:
    _backend_http_ssl_context = ssl.create_default_context()
    _backend_http_ssl_context_source = "default"

  return _backend_http_ssl_context


def _get_backend_http_ssl_context_source() -> str:
  if _backend_http_ssl_context_source is None:
    _get_backend_http_ssl_context()

  return _backend_http_ssl_context_source or "default"


def _request_json(
  *,
  provider_id: str,
  provider_label: str,
  base_url: str,
  path: str,
  query: Mapping[str, Any] | None,
  auth_query: Mapping[str, Any],
  handled_http_statuses: set[int] | None = None,
) -> Any:
  from urllib.error import HTTPError, URLError
  from urllib.parse import urlencode, urljoin
  from urllib.request import Request, urlopen

  loop = asyncio.get_running_loop()
  started_at = loop.time()
  request_url = urljoin(base_url, path)
  request_query: dict[str, Any] = {}
  if query is not None:
    for key, value in query.items():
      if value is not None:
        request_query[key] = value
  for key, value in auth_query.items():
    if value is not None:
      request_query[key] = value

  full_url = f"{request_url}?{urlencode(request_query, doseq=True)}" if request_query else request_url
  request = Request(
    full_url,
    headers={
      "Accept": "application/json",
      "User-Agent": BACKEND_HTTP_USER_AGENT,
    },
    method="GET",
  )

  try:
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS, context=_get_backend_http_ssl_context()) as response:
      body = response.read().decode("utf-8")
      duration_ms = int((loop.time() - started_at) * 1000)
      if duration_ms >= SLOW_PROVIDER_REQUEST_LOG_THRESHOLD_MS:
        _log(
          "info",
          "Slow provider request",
          providerId=provider_id,
          path=path,
          durationMs=duration_ms,
        )
      if body.strip() == "":
        return None
      return json.loads(body)
  except HTTPError as cause:
    duration_ms = int((loop.time() - started_at) * 1000)

    if handled_http_statuses is not None and cause.code in handled_http_statuses:
      response_body = ""
      try:
        response_body = cause.read().decode("utf-8").strip()
      except Exception:
        response_body = ""

      return {
        "handledHttpError": True,
        "status": cause.code,
        "statusText": _redact_text(str(getattr(cause, "reason", ""))) if getattr(cause, "reason", None) else "",
        "message": _redact_text(response_body) if response_body != "" else f"HTTP {cause.code}",
        "durationMs": duration_ms,
      }

    _log(
      "warning",
      f"{provider_label} request failed",
      providerId=provider_id,
      path=path,
      status=getattr(cause, "code", None),
      reason=getattr(cause, "reason", None),
      durationMs=duration_ms,
    )
    raise RuntimeError(f"{provider_label} request failed with HTTP {getattr(cause, 'code', 'unknown')}.") from cause
  except URLError as cause:
    duration_ms = int((loop.time() - started_at) * 1000)
    _log(
      "warning",
      f"{provider_label} request failed",
      providerId=provider_id,
      path=path,
      error=str(cause),
      durationMs=duration_ms,
    )
    raise RuntimeError(f"{provider_label} request failed due to a network error.") from cause
  except json.JSONDecodeError as cause:
    duration_ms = int((loop.time() - started_at) * 1000)
    _log(
      "warning",
      f"{provider_label} response decode failed",
      providerId=provider_id,
      path=path,
      error=str(cause),
      durationMs=duration_ms,
    )
    raise RuntimeError(f"{provider_label} returned invalid JSON.") from cause


class Plugin:
  async def _main(self) -> None:
    self.loop = asyncio.get_event_loop()
    SETTINGS_PATH.mkdir(parents=True, exist_ok=True)
    LOGS_PATH.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    SECRETS_PATH.parent.mkdir(parents=True, exist_ok=True)
    _log(
      "info",
      "Achievement Companion storage ready",
      settingsPath=str(SETTINGS_PATH),
      logPath=str(LOGS_PATH),
    )
    _get_backend_http_ssl_context()
    _log("info", "Achievement Companion backend TLS context ready", caSource=_get_backend_http_ssl_context_source())
    _log("info", "Achievement Companion backend loaded")

  async def _unload(self) -> None:
    _log("info", "Achievement Companion backend unloaded")

  async def _uninstall(self) -> None:
    _log("info", "Achievement Companion backend uninstalled")

  async def get_provider_configs(self) -> dict[str, Any]:
    retroachievements_config = _build_retroachievements_config_view(
      _load_provider_config("retroAchievements"),
      _load_secret_api_key("retroAchievements") is not None,
    )
    steam_config = _build_steam_config_view(
      _load_provider_config("steam"),
      _load_secret_api_key("steam") is not None,
    )

    result: dict[str, Any] = {"version": PLUGIN_CONFIG_VERSION}
    if retroachievements_config is not None:
      result["retroAchievements"] = retroachievements_config
    if steam_config is not None:
      result["steam"] = steam_config
    return result

  async def save_retroachievements_credentials(self, payload: dict[str, Any]) -> dict[str, Any] | None:
    username = _coerce_string(payload.get("username"))
    if username is None:
      return None

    api_key = _resolve_api_key(payload, "retroAchievements")
    if api_key is None:
      return None

    existing_config = _load_provider_config("retroAchievements") or {}
    recent_achievements_count = _normalize_optional_positive_count(payload.get("recentAchievementsCount"))
    if recent_achievements_count is None:
      recent_achievements_count = _normalize_optional_positive_count(
        existing_config.get("recentAchievementsCount"),
      )

    recently_played_count = _normalize_optional_positive_count(payload.get("recentlyPlayedCount"))
    if recently_played_count is None:
      recently_played_count = _normalize_optional_positive_count(existing_config.get("recentlyPlayedCount"))

    _save_secret_api_key("retroAchievements", api_key)
    config: dict[str, Any] = {
      "username": username,
      "hasApiKey": True,
    }
    if recent_achievements_count is not None:
      config["recentAchievementsCount"] = recent_achievements_count
    if recently_played_count is not None:
      config["recentlyPlayedCount"] = recently_played_count
    _save_provider_config("retroAchievements", config)
    _log(
      "info",
      "Saved RetroAchievements credentials",
      providerId="retroachievements",
      status="saved",
      hasApiKey=True,
    )
    return config

  async def save_steam_credentials(self, payload: dict[str, Any]) -> dict[str, Any] | None:
    steam_id64 = _coerce_string(payload.get("steamId64"))
    if steam_id64 is None:
      return None

    api_key = _resolve_api_key(payload, "steam")
    if api_key is None:
      return None

    language = _coerce_string(payload.get("language")) or "english"
    recent_achievements_count = _normalize_positive_count(payload.get("recentAchievementsCount"), 5)
    recently_played_count = _normalize_positive_count(payload.get("recentlyPlayedCount"), 5)
    include_played_free_games = _normalize_boolean(payload.get("includePlayedFreeGames"), False)

    _save_secret_api_key("steam", api_key)
    config = {
      "steamId64": steam_id64,
      "hasApiKey": True,
      "language": language,
      "recentAchievementsCount": recent_achievements_count,
      "recentlyPlayedCount": recently_played_count,
      "includePlayedFreeGames": include_played_free_games,
    }
    _save_provider_config("steam", config)
    _log("info", "Saved Steam credentials", providerId="steam", status="saved", hasApiKey=True)
    return config

  async def clear_provider_credentials(self, payload: dict[str, Any]) -> bool:
    provider_id = _coerce_string(payload.get("providerId"))
    if provider_id is None:
      return False

    if provider_id == "retroachievements":
      removed_any = False
      if _load_provider_config("retroAchievements") is not None:
        _clear_provider_config("retroAchievements")
        removed_any = True
      if _load_secret_api_key("retroAchievements") is not None:
        _clear_secret_api_key("retroAchievements")
        removed_any = True
      if removed_any:
        _log(
          "info",
          "Cleared RetroAchievements credentials",
          providerId="retroachievements",
          status="cleared",
        )
      return removed_any

    if provider_id == "steam":
      removed_any = False
      if _load_provider_config("steam") is not None:
        _clear_provider_config("steam")
        removed_any = True
      if _load_secret_api_key("steam") is not None:
        _clear_secret_api_key("steam")
        removed_any = True
      if removed_any:
        _log("info", "Cleared Steam credentials", providerId="steam", status="cleared")
      return removed_any

    return False

  async def record_diagnostic_event(self, payload: dict[str, Any]) -> bool:
    return _record_diagnostic_event(payload)

  async def request_retroachievements_json(self, payload: dict[str, Any]) -> Any:
    path = _coerce_string(payload.get("path"))
    if path is None:
      raise RuntimeError("RetroAchievements request requires a path.")

    config = _build_retroachievements_config_view(
      _load_provider_config("retroAchievements"),
      _load_secret_api_key("retroAchievements") is not None,
    )
    if config is None or config.get("hasApiKey") is not True:
      raise RuntimeError("RetroAchievements credentials are missing.")

    secret = _load_secret_api_key("retroAchievements")
    if secret is None:
      raise RuntimeError("RetroAchievements API key is missing.")

    query = payload.get("query")
    query_mapping = query if isinstance(query, Mapping) else None
    return _request_json(
      provider_id="retroachievements",
      provider_label="RetroAchievements",
      base_url="https://retroachievements.org/API/",
      path=path,
      query=query_mapping,
      auth_query={
        "u": config["username"],
        "y": secret,
      },
    )

  async def request_steam_json(self, payload: dict[str, Any]) -> Any:
    path = _coerce_string(payload.get("path"))
    if path is None:
      raise RuntimeError("Steam request requires a path.")

    config = _build_steam_config_view(
      _load_provider_config("steam"),
      _load_secret_api_key("steam") is not None,
    )
    if config is None or config.get("hasApiKey") is not True:
      raise RuntimeError("Steam credentials are missing.")

    secret = _load_secret_api_key("steam")
    if secret is None:
      raise RuntimeError("Steam Web API key is missing.")

    query = payload.get("query")
    query_mapping = query if isinstance(query, Mapping) else None
    handled_http_statuses_value = payload.get("handledHttpStatuses")
    handled_http_statuses: set[int] | None = None
    if isinstance(handled_http_statuses_value, list):
      handled_http_statuses = set()
      for status_value in handled_http_statuses_value:
        if isinstance(status_value, bool):
          continue
        if isinstance(status_value, (int, float)) and status_value >= 0:
          handled_http_statuses.add(int(status_value))
      if len(handled_http_statuses) == 0:
        handled_http_statuses = None
    return _request_json(
      provider_id="steam",
      provider_label="Steam",
      base_url="https://api.steampowered.com/",
      path=path,
      query=query_mapping,
      auth_query={
        "steamid": config["steamId64"],
        "key": secret,
      },
      handled_http_statuses=handled_http_statuses,
    )
