from __future__ import annotations

from typing import Any, Mapping


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

_DIAGNOSTIC_NUMERIC_FIELDS = {
  "completionPercent",
  "durationMs",
  "failedGameCount",
  "gamesWithAchievements",
  "ownedGameCount",
  "perfectGames",
  "scannedGameCount",
  "skippedGameCount",
  "totalAchievements",
  "unlockedAchievements",
}

_DIAGNOSTIC_STRING_FIELDS = {"errorKind", "mode", "providerId", "source"}


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


def sanitize_diagnostic_event(payload: Mapping[str, Any]) -> dict[str, Any] | None:
  event = _coerce_string(payload.get("event"))
  if event is None or event not in DIAGNOSTIC_EVENT_MESSAGES:
    return None

  allowed_fields = DIAGNOSTIC_EVENT_ALLOWED_FIELDS[event]
  fields: dict[str, Any] = {}

  for field_name in allowed_fields:
    raw_value = payload.get(field_name)
    if field_name in _DIAGNOSTIC_NUMERIC_FIELDS:
      numeric_value = _coerce_positive_int(raw_value)
      if numeric_value is not None:
        fields[field_name] = numeric_value
      continue

    if field_name in _DIAGNOSTIC_STRING_FIELDS:
      coerced_value = _coerce_string(raw_value)
      if coerced_value is not None:
        fields[field_name] = coerced_value

  return {
    "event": event,
    "message": DIAGNOSTIC_EVENT_MESSAGES[event],
    "fields": fields,
  }
