from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path
from typing import Any, Mapping

import decky
from backend.redaction import is_secret_key as _is_secret_key
from backend.redaction import redact_text as _redact_text
from backend.redaction import redact_value as _redact_value
from backend.storage import build_corrupt_backup_path as _build_corrupt_backup_path
from backend.storage import quarantine_corrupt_json_file as _quarantine_corrupt_json_file
from backend.storage import read_json_file as _read_json_file
from backend.storage import write_json_file as _write_json_file

PLUGIN_CONFIG_VERSION = 1
SECRET_RECORD_VERSION = 2
SECRET_RECORD_SCHEME = "local-obfuscation-v1"
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


def _coerce_positive_int(value: Any) -> int | None:
  if isinstance(value, bool):
    return None

  if isinstance(value, (int, float)) and value >= 0:
    return int(value)

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


def _base64_urlsafe_encode(value: bytes) -> str:
  return base64.urlsafe_b64encode(value).decode("ascii")


def _base64_urlsafe_decode(value: str | None) -> bytes | None:
  if value is None or value.strip() == "":
    return None

  try:
    return base64.urlsafe_b64decode(value.encode("ascii"))
  except (ValueError, UnicodeDecodeError):
    return None


def _read_machine_id_text() -> str | None:
  for candidate in (
    Path("/etc/machine-id"),
    Path("/var/lib/dbus/machine-id"),
  ):
    try:
      value = candidate.read_text(encoding="utf-8").strip()
    except OSError:
      continue

    if value != "":
      return value

  return None


def _derive_secret_record_key(provider_key: str, salt: bytes) -> bytes:
  machine_id = _read_machine_id_text() or decky.DECKY_PLUGIN_SETTINGS_DIR
  seed = f"{SECRET_RECORD_SCHEME}:{provider_key}:{machine_id}".encode("utf-8")
  return hashlib.pbkdf2_hmac("sha256", seed, salt, 150_000, dklen=32)


def _xor_with_keystream(secret_key: bytes, nonce: bytes, payload: bytes) -> bytes:
  stream = bytearray()
  counter = 0

  while len(stream) < len(payload):
    stream.extend(
      hmac.new(secret_key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest(),
    )
    counter += 1

  return bytes(left ^ right for left, right in zip(payload, stream))


def _encode_protected_secret_record(provider_key: str, api_key: str) -> dict[str, Any]:
  salt = secrets.token_bytes(16)
  nonce = secrets.token_bytes(16)
  secret_key = _derive_secret_record_key(provider_key, salt)
  plaintext = api_key.encode("utf-8")
  ciphertext = _xor_with_keystream(secret_key, nonce, plaintext)
  tag = hmac.new(secret_key, nonce + ciphertext, hashlib.sha256).digest()[:16]

  return {
    "version": SECRET_RECORD_VERSION,
    "scheme": SECRET_RECORD_SCHEME,
    "salt": _base64_urlsafe_encode(salt),
    "nonce": _base64_urlsafe_encode(nonce),
    "ciphertext": _base64_urlsafe_encode(ciphertext),
    "tag": _base64_urlsafe_encode(tag),
  }


def _decode_legacy_secret_api_key(payload: str | None) -> str | None:
  if payload is None or payload.strip() == "":
    return None

  try:
    decoded = base64.urlsafe_b64decode(payload.encode("ascii"))
    parsed = json.loads(decoded.decode("utf-8"))
  except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
    return None

  if isinstance(parsed, dict):
    api_key = parsed.get("apiKey")
    if isinstance(api_key, str) and api_key.strip() != "":
      return api_key.strip()

  return None


def _decode_protected_secret_record(provider_key: str, provider_secret: Mapping[str, Any]) -> str | None:
  if provider_secret.get("version") != SECRET_RECORD_VERSION:
    return None

  if provider_secret.get("scheme") != SECRET_RECORD_SCHEME:
    return None

  salt = _base64_urlsafe_decode(provider_secret.get("salt") if isinstance(provider_secret.get("salt"), str) else None)
  nonce = _base64_urlsafe_decode(provider_secret.get("nonce") if isinstance(provider_secret.get("nonce"), str) else None)
  ciphertext = _base64_urlsafe_decode(
    provider_secret.get("ciphertext") if isinstance(provider_secret.get("ciphertext"), str) else None,
  )
  tag = _base64_urlsafe_decode(provider_secret.get("tag") if isinstance(provider_secret.get("tag"), str) else None)
  if salt is None or nonce is None or ciphertext is None or tag is None:
    return None

  secret_key = _derive_secret_record_key(provider_key, salt)
  expected_tag = hmac.new(secret_key, nonce + ciphertext, hashlib.sha256).digest()[:16]
  if not hmac.compare_digest(expected_tag, tag):
    return None

  try:
    plaintext = _xor_with_keystream(secret_key, nonce, ciphertext).decode("utf-8")
  except UnicodeDecodeError:
    return None

  return plaintext if plaintext.strip() != "" else None


def _load_provider_config_store() -> dict[str, Any]:
  store = _read_json_file(CONFIG_PATH, warn=_storage_warning)
  if store.get("version") != PLUGIN_CONFIG_VERSION:
    return {"version": PLUGIN_CONFIG_VERSION}
  return store


def _load_secret_store() -> dict[str, Any]:
  store = _read_json_file(SECRETS_PATH, warn=_storage_warning)
  if store.get("version") not in (1, SECRET_RECORD_VERSION):
    return {"version": SECRET_RECORD_VERSION}
  return store


def _load_secret_api_key(provider_key: str) -> str | None:
  secrets = _load_secret_store()
  provider_secret = secrets.get(provider_key)
  if not isinstance(provider_secret, dict):
    return None

  if provider_secret.get("version") == 1:
    legacy_secret = _decode_legacy_secret_api_key(
      provider_secret.get("payload") if isinstance(provider_secret.get("payload"), str) else None,
    )
    if legacy_secret is not None:
      _save_secret_api_key(provider_key, legacy_secret)
    return legacy_secret

  return _decode_protected_secret_record(provider_key, provider_secret)


def _save_secret_api_key(provider_key: str, api_key: str) -> None:
  secrets = _load_secret_store()
  secrets["version"] = SECRET_RECORD_VERSION
  secrets[provider_key] = _encode_protected_secret_record(provider_key, api_key)
  _write_json_file(SECRETS_PATH, secrets)


def _clear_secret_api_key(provider_key: str) -> None:
  secrets = _load_secret_store()
  if provider_key in secrets:
    secrets.pop(provider_key, None)
    if len(secrets) <= 1:
      try:
        SECRETS_PATH.unlink()
      except FileNotFoundError:
        pass
      except OSError as cause:
        decky.logger.warning(
          "Unable to remove provider secret file",
          extra={"path": str(SECRETS_PATH), "error": str(cause)},
        )
      return

    _write_json_file(SECRETS_PATH, secrets)


def _load_provider_config(provider_key: str) -> dict[str, Any] | None:
  store = _load_provider_config_store()
  provider_config = store.get(provider_key)
  if isinstance(provider_config, dict):
    return provider_config
  return None


def _save_provider_config(provider_key: str, config: dict[str, Any]) -> None:
  store = _load_provider_config_store()
  store["version"] = PLUGIN_CONFIG_VERSION
  store[provider_key] = config
  _write_json_file(CONFIG_PATH, store)


def _clear_provider_config(provider_key: str) -> None:
  store = _load_provider_config_store()
  if provider_key in store:
    store.pop(provider_key, None)
    if len(store) <= 1:
      try:
        CONFIG_PATH.unlink()
      except FileNotFoundError:
        pass
      except OSError as cause:
        decky.logger.warning(
          "Unable to remove provider config file",
          extra={"path": str(CONFIG_PATH), "error": str(cause)},
        )
      return

    _write_json_file(CONFIG_PATH, store)


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


def _coerce_string(value: Any) -> str | None:
  if isinstance(value, str):
    trimmed = value.strip()
    return trimmed if trimmed != "" else None
  return None


def _normalize_has_api_key(_value: Any, secret_present: bool) -> bool:
  return secret_present


def _build_retroachievements_config_view(store_value: dict[str, Any] | None, secret_present: bool) -> dict[str, Any] | None:
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


def _build_steam_config_view(store_value: dict[str, Any] | None, secret_present: bool) -> dict[str, Any] | None:
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
