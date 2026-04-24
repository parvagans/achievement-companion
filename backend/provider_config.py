from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

from backend.storage import WarningCallback, read_json_file, write_json_file

PLUGIN_CONFIG_VERSION = 1
_SENSITIVE_CONFIG_KEYS = {"apikey", "apikeydraft", "key", "y", "token", "password", "secret", "authorization"}


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


def _normalize_has_api_key(_value: Any, secret_present: bool) -> bool:
  return secret_present


def _sanitize_provider_config(config: Mapping[str, Any]) -> dict[str, Any]:
  sanitized: dict[str, Any] = {}
  for key, value in config.items():
    if isinstance(key, str) and key.strip().lower() in _SENSITIVE_CONFIG_KEYS:
      continue
    sanitized[key] = value
  return sanitized


def load_provider_config_store(path: Path, *, warn: WarningCallback | None = None) -> dict[str, Any]:
  store = read_json_file(path, warn=warn)
  if store.get("version") != PLUGIN_CONFIG_VERSION:
    return {"version": PLUGIN_CONFIG_VERSION}
  return store


def load_provider_config(path: Path, provider_key: str, *, warn: WarningCallback | None = None) -> dict[str, Any] | None:
  store = load_provider_config_store(path, warn=warn)
  provider_config = store.get(provider_key)
  if isinstance(provider_config, dict):
    return provider_config
  return None


def save_provider_config(path: Path, provider_key: str, config: dict[str, Any], *, warn: WarningCallback | None = None) -> None:
  store = load_provider_config_store(path, warn=warn)
  store["version"] = PLUGIN_CONFIG_VERSION
  store[provider_key] = _sanitize_provider_config(config)
  write_json_file(path, store)


def clear_provider_config(path: Path, provider_key: str, *, warn: WarningCallback | None = None) -> None:
  store = load_provider_config_store(path, warn=warn)
  if provider_key in store:
    store.pop(provider_key, None)
    if len(store) <= 1:
      try:
        path.unlink()
      except FileNotFoundError:
        pass
      except OSError as cause:
        if warn is not None:
          warn("Unable to remove provider config file", {"path": str(path), "error": str(cause)})
      return

    write_json_file(path, store)


def build_retroachievements_config_view(store_value: dict[str, Any] | None, secret_present: bool) -> dict[str, Any] | None:
  if store_value is None:
    return None

  username = _coerce_string(store_value.get("username"))
  if username is None:
    return None

  config: dict[str, Any] = {
    "username": username,
    "hasApiKey": _normalize_has_api_key(store_value.get("hasApiKey"), secret_present),
  }

  recent_achievements_count = _normalize_optional_positive_count(store_value.get("recentAchievementsCount"))
  if recent_achievements_count is not None:
    config["recentAchievementsCount"] = recent_achievements_count

  recently_played_count = _normalize_optional_positive_count(store_value.get("recentlyPlayedCount"))
  if recently_played_count is not None:
    config["recentlyPlayedCount"] = recently_played_count

  return config


def build_steam_config_view(store_value: dict[str, Any] | None, secret_present: bool) -> dict[str, Any] | None:
  if store_value is None:
    return None

  steam_id64 = _coerce_string(store_value.get("steamId64"))
  if steam_id64 is None:
    return None

  language = _coerce_string(store_value.get("language")) or "english"
  recent_achievements_count = _normalize_positive_count(store_value.get("recentAchievementsCount"), 5)
  recently_played_count = _normalize_positive_count(store_value.get("recentlyPlayedCount"), 5)
  include_played_free_games = _normalize_boolean(store_value.get("includePlayedFreeGames"), False)

  return {
    "steamId64": steam_id64,
    "hasApiKey": _normalize_has_api_key(store_value.get("hasApiKey"), secret_present),
    "language": language,
    "recentAchievementsCount": recent_achievements_count,
    "recentlyPlayedCount": recently_played_count,
    "includePlayedFreeGames": include_played_free_games,
  }
