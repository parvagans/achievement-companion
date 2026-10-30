from __future__ import annotations

import asyncio
import hashlib
import json
import re
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

_PLUGIN_DIR = Path(__file__).resolve().parent
_PLUGIN_PY_MODULES_DIR = _PLUGIN_DIR / "py_modules"
_PLUGIN_PY_MODULES_DIR_TEXT = str(_PLUGIN_PY_MODULES_DIR)
if _PLUGIN_PY_MODULES_DIR_TEXT not in sys.path:
  sys.path.insert(0, _PLUGIN_PY_MODULES_DIR_TEXT)

import decky
from backend.http import ProviderRequestError as _ProviderRequestError
from backend.http import request_json as _backend_request_json
from backend.ra_scheduler import RaScheduler
from backend.ra_state import RaStateStore
from backend.ra_coordinator import RaCoordinator, account_scope, resource_identity
from backend.ra_history import RaHistorySynchronizer
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
from backend.provider_config import save_provider_config as _provider_save_provider_config
from backend.provider_config import _normalize_optional_positive_count as _normalize_optional_positive_count
from backend.provider_config import _normalize_positive_count as _normalize_positive_count
from backend.secrets import clear_secret_api_key as _provider_clear_secret_api_key
from backend.secrets import load_secret_api_key as _provider_load_secret_api_key
from backend.secrets import save_secret_api_key as _provider_save_secret_api_key
from backend.steam_shortcuts import load_steam_shortcut_metadata as _load_steam_shortcut_metadata
from backend.ra_hash import load_steam_shortcut_rom_hash as _load_steam_shortcut_rom_hash
from backend.storage import build_corrupt_backup_path as _build_corrupt_backup_path
from backend.storage import quarantine_corrupt_json_file as _quarantine_corrupt_json_file
from backend.storage import read_json_file as _read_json_file
from backend.storage import write_json_file as _write_json_file
from backend.update import cleanup_prepared_update_artifacts as _cleanup_prepared_update_artifacts
from backend.update import prepare_update_artifact as _prepare_update_artifact
from backend.update import fetch_update_manifest as _fetch_update_manifest
from backend.version import get_application_version as _get_application_version

SETTINGS_PATH = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
LOGS_PATH = Path(decky.DECKY_PLUGIN_LOG_DIR)
LOG_FILE_PATH = LOGS_PATH / "achievement-companion.log"
LOG_FILE_MAX_BYTES = 2 * 1024 * 1024
LOG_FILE_BACKUPS = 3
_LOG_FILE_LOCK = threading.Lock()
_log_file_failure_reported = False
CONFIG_PATH = SETTINGS_PATH / "provider-config.json"
SECRETS_PATH = SETTINGS_PATH / "provider-secrets.json"
STEAM_HUNTERS_REQUEST_TIMEOUT_SECONDS = 8
RETROACHIEVEMENTS_API_PATHS = frozenset({
  "API_GetUserProfile.php",
  "API_GetUserSummary.php",
  "API_GetConsoleIDs.php",
  "API_GetGameList.php",
  "API_GetGameExtended.php",
  "API_GetUserProgress.php",
  "API_GetUserCompletionProgress.php",
  "API_GetAchievementsEarnedBetween.php",
  "API_GetUserRecentAchievements.php",
  "API_GetUserRecentlyPlayedGames.php",
  "API_GetGameInfoAndUserProgress.php",
  "API_GetAchievementDistribution.php",
  "API_GetGameProgression.php",
  "API_GetGameRankAndScore.php",
})
STEAM_API_PATHS = frozenset({
  "ISteamUser/GetPlayerSummaries/v2/",
  "IPlayerService/GetSteamLevel/v1/",
  "IPlayerService/GetBadges/v1/",
  "IPlayerService/GetOwnedGames/v1/",
  "IPlayerService/GetRecentlyPlayedGames/v1/",
  "ISteamUserStats/GetPlayerAchievements/v1/",
  "ISteamUserStats/GetSchemaForGame/v2/",
  "ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/",
})
_STEAM_USER_ENTRY_PATTERN = re.compile(
  r'"(?P<steam_id64>\d{17})"\s*\{(?P<body>[^{}]*)\}',
  re.DOTALL,
)
_MOST_RECENT_STEAM_USER_PATTERN = re.compile(
  r'(?m)^\s*"MostRecent"\s+"1"\s*$',
  re.IGNORECASE,
)


def _get_current_steam_id64(home: Path | None = None) -> str | None:
  """Return the unambiguous Steam account ID saved by the local Steam client."""
  resolved_home = home if home is not None else Path.home()
  roots = (
    resolved_home / ".local" / "share" / "Steam",
    resolved_home / ".steam" / "steam",
    resolved_home / ".steam" / "root",
  )
  entries: dict[str, bool] = {}
  seen_paths: set[Path] = set()

  for root in roots:
    path = root / "config" / "loginusers.vdf"
    resolved_path = path.resolve(strict=False)
    if resolved_path in seen_paths or not resolved_path.is_file():
      continue
    seen_paths.add(resolved_path)

    try:
      text = resolved_path.read_text(encoding="utf-8-sig", errors="replace")
    except OSError:
      continue

    for match in _STEAM_USER_ENTRY_PATTERN.finditer(text):
      steam_id64 = match.group("steam_id64")
      is_most_recent = _MOST_RECENT_STEAM_USER_PATTERN.search(match.group("body")) is not None
      entries[steam_id64] = entries.get(steam_id64, False) or is_most_recent

  most_recent_ids = [steam_id64 for steam_id64, is_most_recent in entries.items() if is_most_recent]
  if len(most_recent_ids) == 1:
    return most_recent_ids[0]
  if len(entries) == 1:
    return next(iter(entries))
  return None


_sanitize_backend_runtime_environment()


def _storage_warning(message: str, fields: Mapping[str, Any]) -> None:
  _log("warning", message, **dict(fields))


def _load_provider_config(provider_key: str) -> dict[str, Any] | None:
  return _provider_load_provider_config(CONFIG_PATH, provider_key, warn=_storage_warning)


def _save_provider_config(provider_key: str, config: dict[str, Any]) -> None:
  _provider_save_provider_config(CONFIG_PATH, provider_key, config, warn=_storage_warning)


def _clear_provider_config(provider_key: str) -> None:
  _provider_clear_provider_config(CONFIG_PATH, provider_key, warn=_storage_warning)


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
  global _log_file_failure_reported
  message = _redact_text(message)
  payload = json.dumps(_redact_value(fields), ensure_ascii=False, separators=(",", ":")) if fields else ""
  rendered = f"{message} {payload}" if payload else message
  if payload:
    getattr(decky.logger, level)("%s %s", message, payload)
  else:
    getattr(decky.logger, level)(message)

  if not LOGS_PATH.is_dir():
    return
  try:
    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S,%f%z")
    line = f"[{timestamp}][{level.upper()}]: {rendered}\n"
    with _LOG_FILE_LOCK:
      if LOG_FILE_PATH.is_file() and LOG_FILE_PATH.stat().st_size + len(line.encode("utf-8")) > LOG_FILE_MAX_BYTES:
        for index in range(LOG_FILE_BACKUPS, 1, -1):
          older = LOG_FILE_PATH.with_name(f"{LOG_FILE_PATH.name}.{index - 1}")
          newer = LOG_FILE_PATH.with_name(f"{LOG_FILE_PATH.name}.{index}")
          if older.is_file():
            older.replace(newer)
        LOG_FILE_PATH.replace(LOG_FILE_PATH.with_name(f"{LOG_FILE_PATH.name}.1"))
      with LOG_FILE_PATH.open("a", encoding="utf-8") as log_file:
        log_file.write(line)
  except OSError as error:
    if not _log_file_failure_reported:
      _log_file_failure_reported = True
      decky.logger.warning("Achievement Companion file logging unavailable: %s", type(error).__name__)


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
  timeout_seconds: int | None = None,
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
    **({"timeout_seconds": timeout_seconds} if timeout_seconds is not None else {}),
  )


class Plugin:
  async def _request_ra(self, *, path: str, query, auth_query, handled_http_statuses: set[int]) -> Any:
    scheduler = getattr(self, "_ra_requests", None)
    if scheduler is None:
      scheduler = RaScheduler(store=RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3"), log=_log)
      self._ra_requests = scheduler
    # Credentials are used only to derive an opaque, nonpersisted request identity.
    parameters = {**(query or {}), **auth_query}
    identity = hashlib.sha256(json.dumps([path, parameters], sort_keys=True, default=str).encode()).hexdigest()
    low = path in {"API_GetAchievementDistribution.php", "API_GetGameProgression.php",
                   "API_GetGameRankAndScore.php", "API_GetGameList.php", "API_GetGameExtended.php",
                   "API_GetAchievementsEarnedBetween.php"}
    return await scheduler.submit(identity, path, lambda: asyncio.to_thread(
      _request_json, provider_id="retroachievements", provider_label="RetroAchievements",
      base_url="https://retroachievements.org/API/", path=path, query=query,
      auth_query=auth_query, handled_http_statuses=handled_http_statuses | {408, 425, 500, 502, 503, 504},
    ), priority=3 if low else 1)

  async def _ensure_ra_resource(self, *, path: str, query, auth_query, username: str,
                                force: bool = False, active: bool = False, entry_point: str | None = None) -> Any:
    # The legacy callable and the resource protocol share the same backend authority.
    scheduler = getattr(self, "_ra_requests", None)
    if scheduler is None:
      scheduler = RaScheduler(store=RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3"), log=_log)
      self._ra_requests = scheduler
    coordinator = getattr(self, "_ra_resources", None)
    if coordinator is None:
      coordinator = RaCoordinator(scheduler.store, scheduler, log=_log)
      self._ra_resources = coordinator
    if path == "API_GetUserCompletionProgress.php" and str((query or {}).get("o", 0)) == "0" and str((query or {}).get("c")) == "500":
      async def fetch_page(offset):
        return await asyncio.to_thread(_request_json, provider_id="retroachievements", provider_label="RetroAchievements",
          base_url="https://retroachievements.org/API/", path=path, query={**(query or {}), "o": offset, "c": 500},
          auth_query=auth_query, handled_http_statuses={401, 403, 404, 408, 425, 429, 500, 502, 503, 504})
      return await coordinator.ensure_completion_collection({**(query or {}), "u": username}, account_scope(username, auth_query["y"]),
        fetch_page, force=force, entry_point=entry_point or "provider")
    parameters = {**(query or {}), **{key: value for key, value in auth_query.items() if key != "y"}}
    low = path in {"API_GetAchievementDistribution.php", "API_GetGameProgression.php",
                   "API_GetGameRankAndScore.php", "API_GetGameList.php", "API_GetGameExtended.php",
                   "API_GetAchievementsEarnedBetween.php"}
    low = low or entry_point == "game-playtime" or (path == "API_GetUserProfile.php" and query and query.get("u") not in (None, username))
    return await coordinator.ensure(path, parameters, account_scope(username, auth_query["y"]),
      lambda: asyncio.to_thread(_request_json, provider_id="retroachievements", provider_label="RetroAchievements",
        base_url="https://retroachievements.org/API/", path=path, query=query, auth_query=auth_query,
        handled_http_statuses={401, 403, 404, 408, 425, 429, 500, 502, 503, 504}),
      force=force, active=active, priority=3 if low else 2 if path == "API_GetUserRecentlyPlayedGames.php" and not force else 1,
      entry_point=entry_point or "provider")

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
    failures = []
    for attribute in ("_ra_resources", "_ra_history", "_ra_requests"):
      service = getattr(self, attribute, None)
      if service is not None:
        try:
          await service.close()
        except BaseException as error:
          failures.append(error)
          _log("error", "Achievement Companion shutdown step failed", resource=attribute)
    try:
      _cleanup_prepared_update_artifacts()
    finally:
      _log("info", "Achievement Companion backend unloaded")
    if failures:
      raise failures[0]

  async def _uninstall(self) -> None:
    _log("info", "Achievement Companion backend uninstalled")

  async def get_plugin_version(self) -> str:
    return _get_application_version(_PLUGIN_DIR)

  async def fetch_update_manifest(self) -> dict[str, Any]:
    return await asyncio.to_thread(
      _fetch_update_manifest,
      ssl_context=_get_backend_http_ssl_context(),
    )

  async def prepare_update_artifact(self, payload: dict[str, Any]) -> dict[str, str]:
    return await asyncio.to_thread(
      _prepare_update_artifact,
      payload,
      ssl_context=_get_backend_http_ssl_context(),
    )

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

  async def get_current_steam_id64(self) -> dict[str, str | None]:
    return {"steamId64": _get_current_steam_id64()}

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

    _save_secret_api_key("steam", api_key)
    config = {
      "steamId64": steam_id64,
      "hasApiKey": True,
      "language": language,
      "recentAchievementsCount": recent_achievements_count,
      "recentlyPlayedCount": recently_played_count,
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

  async def get_retroachievements_diagnostics(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    scheduler = getattr(self, "_ra_requests", None)
    store = scheduler.store if scheduler else RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3")
    cache = await asyncio.to_thread(store.diagnostics)
    failure = await asyncio.to_thread(store.read, "ra-last-failure")
    cooldown = await asyncio.to_thread(store.read, "ra-cooldown")
    requests = scheduler.diagnostics() if scheduler else {"pending": 0, "active": 0, "sent": 0,
      "cooldownUntil": round(cooldown.get("until", 0) * 1000) if isinstance(cooldown, dict) else 0}
    resources = getattr(self, "_ra_resources", None)
    counts = dict(resources.counts) if resources else {"hits": 0, "misses": 0}
    total = counts["hits"] + counts["misses"]
    return {"cache": cache, "requests": requests, "coordinator": {**counts,
      "hitRatio": counts["hits"] / total if total else None}, "lastFailure": failure,
      "historyActive": len(getattr(getattr(self, "_ra_history", None), "loads", {}))}

  async def read_retroachievements_calendar(self, payload: dict[str, Any] | None = None) -> dict[str, Any] | None:
    def read():
      config = _load_provider_config("retroAchievements")
      secret = _load_secret_api_key("retroAchievements")
      if not config or not secret:
        return None
      scope = account_scope(config["username"], secret)
      store = RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3")
      return store.calendar(scope, int(datetime.now(timezone.utc).timestamp()) - 366 * 86400)
    return await asyncio.to_thread(read)

  async def read_retroachievements_observed_sessions(self, payload: dict[str, Any] | None = None) -> dict[str, Any] | None:
    def read():
      config, secret = _load_provider_config("retroAchievements"), _load_secret_api_key("retroAchievements")
      if not config or not secret:
        return None
      scope = account_scope(config["username"], secret)
      store = RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3")
      return {"scope": scope, "sessions": store.read(f"observed-sessions:{scope}") or []}
    return await asyncio.to_thread(read)

  async def write_retroachievements_observed_sessions(self, payload: dict[str, Any]) -> bool:
    def write():
      config, secret = _load_provider_config("retroAchievements"), _load_secret_api_key("retroAchievements")
      if not config or not secret:
        return False
      scope = account_scope(config["username"], secret)
      # A delayed write from an old account/credential revision cannot cross scopes.
      if payload.get("scope") != scope:
        return False
      rows = payload.get("sessions")
      if not isinstance(rows, list) or len(rows) > 12:
        return False
      sanitized = []
      now = datetime.now(timezone.utc).timestamp() * 1000
      for row in rows:
        if not isinstance(row, dict) or not str(row.get("gameId", "")).isdigit() or int(row["gameId"]) <= 0:
          return False
        times = {key: row[key] for key in ("observedAt", "heartbeatAt", "endedAt") if key in row}
        if not all(isinstance(value, (int, float)) and 0 < value <= now for value in times.values()):
          return False
        if not {"observedAt", "heartbeatAt"}.issubset(times) or times["heartbeatAt"] > times["observedAt"]:
          return False
        sanitized.append({"gameId": str(int(row["gameId"])), **times, **({"localOwnership": row["localOwnership"]} if row.get("localOwnership") in ("mapped", "emulator") else {}), **({"localAppId": row["localAppId"]} if isinstance(row.get("localAppId"), str) and row["localAppId"].isdigit() else {})})
      return RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3").write(f"observed-sessions:{scope}", sanitized)
    return await asyncio.to_thread(write)

  async def export_retroachievements_diagnostics(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    # Export aggregate, allowlisted data only. Never include account payloads,
    # resource queries, paths, credentials, or arbitrary log/provider bodies.
    report = await self.get_retroachievements_diagnostics()
    destination = LOGS_PATH / "retroachievements-diagnostics.json"
    def save():
      destination.parent.mkdir(parents=True, exist_ok=True)
      temporary = destination.with_suffix(".tmp")
      temporary.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
      temporary.chmod(0o600)
      temporary.replace(destination)
    try:
      await asyncio.to_thread(save)
      return {"ok": True, "location": "Decky plugin logs/retroachievements-diagnostics.json"}
    except OSError:
      return {"ok": False, "message": "Could not write diagnostic export."}

  async def recover_retroachievements_resource(self, payload: dict[str, Any]) -> dict[str, Any]:
    target = payload.get("target")
    if target not in ("profile", "game", "history-checkpoint"):
      return {"ok": False, "message": "Choose a supported resource."}
    def credentials():
      return _load_provider_config("retroAchievements"), _load_secret_api_key("retroAchievements")
    config, secret = await asyncio.to_thread(credentials)
    if not config or not secret:
      return {"ok": False, "message": "Set up RetroAchievements in account settings."}
    scope = account_scope(config["username"], secret)
    scheduler = getattr(self, "_ra_requests", None)
    store = scheduler.store if scheduler else RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3")
    coordinator = getattr(self, "_ra_resources", None)
    if target == "history-checkpoint":
      history = getattr(self, "_ra_history", None)
      if history and scope in history.loads:
        return {"ok": False, "message": "History synchronization is already running."}
      ok = await asyncio.to_thread(store.rebuild_history_checkpoint, scope)
      return {"ok": ok, "message": "Coverage checkpoint rebuilt; verified events retained. Open Activity to resume."}
    if target == "game":
      game_id = str(payload.get("gameId", ""))
      if not re.fullmatch(r"[0-9]+", game_id):
        return {"ok": False, "message": "Enter a valid RetroAchievements game ID."}
      await self.invalidate_retroachievements_game({"gameId": game_id})
    else:
      kinds = ("profile", "summary", "recent-achievements", "recent-games", "completion-library")
      if coordinator:
        await coordinator.invalidate_kinds(scope, kinds)
      else:
        def invalidate_saved_group():
          for kind in kinds:
            store.invalidate(scope=scope, kind=kind)
        await asyncio.to_thread(invalidate_saved_group)
    return {"ok": True, "message": "Resource marked for revalidation on next entry. Saved data and cooldown retained."}

  async def request_retroachievements_json(self, payload: dict[str, Any]) -> Any:
    path = _coerce_string(payload.get("path"))
    if path is None:
      raise RuntimeError("RetroAchievements request requires a path.")
    if path not in RETROACHIEVEMENTS_API_PATHS:
      raise RuntimeError("RetroAchievements request requires an allowed API endpoint.")

    def load_credentials() -> tuple[dict[str, Any] | None, str | None]:
      secret = _load_secret_api_key("retroAchievements")
      config = _build_retroachievements_config_view(_load_provider_config("retroAchievements"), secret is not None)
      return config, secret

    config, secret = await asyncio.to_thread(load_credentials)
    if config is None or config.get("hasApiKey") is not True:
      raise RuntimeError("RetroAchievements credentials are missing.")

    if secret is None:
      raise RuntimeError("RetroAchievements API key is missing.")

    query = payload.get("query")
    query_mapping = query if isinstance(query, Mapping) else None
    response = await self._ensure_ra_resource(
      path=path,
      query=query_mapping,
      auth_query=(
        {"y": secret}
        if path == "API_GetUserProfile.php"
        else {"u": config["username"], "y": secret}
      ),
      username=config["username"],
      force=payload.get("refreshIntent") == "explicit",
      active=payload.get("activeViewing") is True,
      entry_point=payload.get("entryPoint") if isinstance(payload.get("entryPoint"), str) else None,
    )
    if payload.get("resourceProtocol") == 1:
      return response
    return response.get("payload") if isinstance(response, dict) and response.get("raResource") == 1 else response


  async def synchronize_retroachievements_history(self, payload: dict[str, Any]) -> Any:
    def credentials():
      secret = _load_secret_api_key("retroAchievements")
      config = _load_provider_config("retroAchievements")
      return (config, secret)

    config, secret = await asyncio.to_thread(credentials)
    if not config or not config.get("username") or not secret:
      return {"handledHttpError": True, "status": 401, "category": "authentication"}
    username = config["username"]
    auth = {"u": username, "y": secret}
    profile = await self._ensure_ra_resource(path="API_GetUserProfile.php", query=None,
                                              auth_query=auth, username=username)
    if not isinstance(profile, dict) or profile.get("raResource") != 1:
      return profile
    raw = profile["payload"]
    member_since = raw.get("MemberSince", raw.get("memberSince"))
    try:
      parsed = datetime.fromisoformat(member_since.replace("Z", "+00:00"))
      if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
      start = int(parsed.timestamp())
      if start < 0 or start > int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("Invalid membership date")
    except (AttributeError, TypeError, ValueError, OverflowError):
      return {"handledHttpError": True, "status": 422, "category": "history_membership_unavailable"}
    synchronizer = getattr(self, "_ra_history", None)
    if synchronizer is None:
      synchronizer = RaHistorySynchronizer(self._ra_resources.store, self._ra_resources)
      self._ra_history = synchronizer

    async def fetch_range(begin, end):
      return await asyncio.to_thread(_request_json, provider_id="retroachievements", provider_label="RetroAchievements",
        base_url="https://retroachievements.org/API/", path="API_GetAchievementsEarnedBetween.php",
        query={"f": begin, "t": end}, auth_query=auth,
        handled_http_statuses={401, 403, 404, 408, 425, 429, 500, 502, 503, 504})

    return await synchronizer.ensure(account_scope(username, secret), start, username, fetch_range)

  async def invalidate_retroachievements_game(self, payload: dict[str, Any]) -> bool:
    game_id = str(payload.get("gameId", ""))
    if not game_id.isdigit() or int(game_id) <= 0:
      return False

    def identity():
      secret = _load_secret_api_key("retroAchievements")
      config = _load_provider_config("retroAchievements")
      if secret is None or not config or not config.get("username"):
        return None
      return config["username"], account_scope(config["username"], secret)

    account = await asyncio.to_thread(identity)
    if account is None:
      return False
    username, scope = account
    query = {"g": game_id, "a": 1, "u": username}
    coordinator = getattr(self, "_ra_resources", None)
    if coordinator:
      await coordinator.invalidate_resource("API_GetGameInfoAndUserProgress.php", query, scope)
    else:
      key = resource_identity("API_GetGameInfoAndUserProgress.php", query, scope)[0]
      await asyncio.to_thread(RaStateStore(SETTINGS_PATH / "retroachievements.sqlite3").invalidate_key, key)
    return True

  async def validate_retroachievements_credentials(self, payload: dict[str, Any]) -> dict[str, Any]:
    username = _coerce_string(payload.get("username"))
    api_key = _coerce_string(payload.get("apiKey"))
    if username is None or api_key is None:
      return {"ok": False, "failure": {"category": "authentication"}}

    try:
      # API_GetUserProfile is a small authenticated endpoint and does not persist draft credentials.
      response = await self._request_ra(
        path="API_GetUserProfile.php",
        query=None,
        auth_query={"u": username, "y": api_key},
        handled_http_statuses={400, 401, 403, 404, 429},
      )
      if isinstance(response, Mapping) and response.get("handledHttpError") is True:
        return {
          "ok": False,
          "failure": {
            "category": "http",
            "statusCode": response.get("status"),
          },
        }
      # RetroAchievements can return a JSON error object for an unknown user without a HTTP error.
      if isinstance(response, Mapping) and any(
        key in response for key in ("Error", "error", "ErrorCode", "errorCode")
      ):
        return {"ok": False, "failure": {"category": "authentication"}}
      return {"ok": True}
    except _ProviderRequestError as cause:
      return {
        "ok": False,
        "failure": {
          "category": cause.category,
          **({"statusCode": cause.status_code} if cause.status_code is not None else {}),
        },
      }

  async def request_steam_json(self, payload: dict[str, Any]) -> Any:
    path = _coerce_string(payload.get("path"))
    if path is None:
      raise RuntimeError("Steam request requires a path.")
    if path not in STEAM_API_PATHS:
      raise RuntimeError("Steam request requires an allowed API endpoint.")

    def load_credentials() -> tuple[dict[str, Any] | None, str | None]:
      secret = _load_secret_api_key("steam")
      config = _build_steam_config_view(_load_provider_config("steam"), secret is not None)
      return config, secret

    config, secret = await asyncio.to_thread(load_credentials)
    if config is None or config.get("hasApiKey") is not True:
      raise RuntimeError("Steam credentials are missing.")

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
    if handled_http_statuses is None:
      handled_http_statuses = {401, 403, 429}
    else:
      handled_http_statuses.update({401, 403, 429})
    return await asyncio.to_thread(
      _request_json,
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

  async def request_steamhunters_json(self, payload: dict[str, Any]) -> Any:
    resource = _coerce_string(payload.get("resource"))
    if resource == "profile":
      steam_id = _coerce_string(payload.get("steamId"))
      if steam_id is None or not steam_id.isdigit() or not 15 <= len(steam_id) <= 20:
        raise RuntimeError("SteamHunters profile request requires a SteamID64.")
      path = f"steam-users/{steam_id}"
    else:
      raw_app_id = payload.get("appId")
      if isinstance(raw_app_id, bool) or not isinstance(raw_app_id, int) or raw_app_id <= 0:
        raise RuntimeError("SteamHunters request requires a positive Steam AppID.")

      if resource == "app":
        path = f"apps/{raw_app_id}"
      elif resource == "achievements":
        path = f"apps/{raw_app_id}/achievements"
      elif resource == "groups":
        path = f"GetAchievementGroups/v1?appid={raw_app_id}"
      else:
        raise RuntimeError("SteamHunters request requires an allowed resource.")

    return await asyncio.to_thread(
      _request_json,
      provider_id="steamhunters",
      provider_label="SteamHunters",
      base_url="https://steamhunters.com/api/",
      path=path,
      query=None,
      auth_query={},
      handled_http_statuses={404},
      timeout_seconds=STEAM_HUNTERS_REQUEST_TIMEOUT_SECONDS,
    )

  async def validate_steam_credentials(self, payload: dict[str, Any]) -> dict[str, Any]:
    steam_id64 = _coerce_string(payload.get("steamId64"))
    api_key = _coerce_string(payload.get("apiKey"))
    if steam_id64 is None or api_key is None:
      return {"ok": False, "failure": {"category": "account"}}
    if not steam_id64.isdigit() or not 15 <= len(steam_id64) <= 20:
      return {"ok": False, "failure": {"category": "account"}}

    try:
      response = await asyncio.to_thread(
        _request_json,
        provider_id="steam",
        provider_label="Steam",
        base_url="https://api.steampowered.com/",
        path="ISteamUser/GetPlayerSummaries/v2/",
        query={"steamids": steam_id64, "format": "json"},
        auth_query={"steamid": steam_id64, "key": api_key},
        handled_http_statuses={401, 403, 429},
      )
      if isinstance(response, Mapping) and response.get("handledHttpError") is True:
        return {"ok": False, "failure": {"category": "http", "statusCode": response.get("status")}}
      players = response.get("response", {}).get("players") if isinstance(response, Mapping) else None
      if not isinstance(players, list) or len(players) == 0:
        return {"ok": False, "failure": {"category": "account"}}
      return {"ok": True}
    except _ProviderRequestError as cause:
      return {"ok": False, "failure": {"category": cause.category, **({"statusCode": cause.status_code} if cause.status_code is not None else {})}}

  async def get_steam_shortcut_metadata(self, payload: dict[str, Any]) -> dict[str, Any] | None:
    raw_app_id = payload.get("appId")
    app_id = _coerce_string(raw_app_id)
    if app_id is None and isinstance(raw_app_id, (int, float)) and not isinstance(raw_app_id, bool):
      app_id = str(int(raw_app_id))

    if app_id is None:
      return None

    metadata = await asyncio.to_thread(_load_steam_shortcut_metadata, app_id)
    if metadata is None:
      return None

    return dict(metadata)

  async def get_steam_shortcut_rom_hash(self, payload: dict[str, Any]) -> dict[str, Any] | None:
    raw_app_id = payload.get("appId")
    app_id = _coerce_string(raw_app_id)
    if app_id is None and isinstance(raw_app_id, (int, float)) and not isinstance(raw_app_id, bool):
      app_id = str(int(raw_app_id))

    if app_id is None:
      return None

    raw_console_id = payload.get("consoleId")
    if isinstance(raw_console_id, bool) or not isinstance(raw_console_id, int) or not 1 <= raw_console_id <= 65535:
      return None

    result = await asyncio.to_thread(_load_steam_shortcut_rom_hash, app_id, raw_console_id)
    if result is None:
      return None

    return dict(result)
