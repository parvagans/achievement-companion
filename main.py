from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Mapping

import decky
from backend.http import request_json as _backend_request_json
from backend.tls import get_backend_http_ssl_context as _backend_get_backend_http_ssl_context
from backend.tls import get_backend_http_ssl_context_source as _backend_get_backend_http_ssl_context_source
from backend.tls import sanitize_backend_runtime_environment as _sanitize_backend_runtime_environment
from backend.redaction import is_secret_key as _is_secret_key
from backend.redaction import redact_text as _redact_text
from backend.redaction import redact_value as _redact_value
from backend.diagnostics import sanitize_diagnostic_event as _sanitize_diagnostic_event
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

SETTINGS_PATH = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
LOGS_PATH = SETTINGS_PATH.parent.parent / "logs" / "achievement-companion"
CONFIG_PATH = SETTINGS_PATH / "provider-config.json"
SECRETS_PATH = SETTINGS_PATH / "provider-secrets.json"


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


def _coerce_string(value: Any) -> str | None:
  if isinstance(value, str):
    trimmed = value.strip()
    return trimmed if trimmed != "" else None
  return None


def _record_diagnostic_event(payload: Mapping[str, Any]) -> bool:
  diagnostic_event = _sanitize_diagnostic_event(payload)
  if diagnostic_event is None:
    return False

  _log("info", diagnostic_event["message"], **diagnostic_event["fields"])
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


def _get_backend_http_ssl_context():
  return _backend_get_backend_http_ssl_context(log=_log)


def _get_backend_http_ssl_context_source() -> str:
  return _backend_get_backend_http_ssl_context_source()


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
  return _backend_request_json(
    provider_id=provider_id,
    provider_label=provider_label,
    base_url=base_url,
    path=path,
    query=query,
    auth_query=auth_query,
    handled_http_statuses=handled_http_statuses,
    log=_log,
    get_ssl_context=_get_backend_http_ssl_context,
  )


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
