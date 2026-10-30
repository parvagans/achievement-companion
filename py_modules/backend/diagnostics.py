from __future__ import annotations

from typing import Any, Mapping
import math


DIAGNOSTIC_EVENT_MESSAGES = {
  "cache_hit": "cache_hit",
  "resource_published": "resource_published",
  "request_joined": "request_joined",
  "dashboard_refresh_started": "Dashboard refresh started",
  "dashboard_refresh_completed": "Dashboard refresh completed",
  "dashboard_refresh_failed": "Dashboard refresh failed",
  "provider_opened": "Provider opened",
  "badge_opened": "Badge opened",
  "resource_refresh_started": "Resource refresh started",
  "resource_refresh_completed": "Resource refresh completed",
  "resource_refresh_failed": "Resource refresh failed",
  "steam_library_scan_started": "Steam library scan started",
  "steam_library_scan_progress": "Steam library scan progress",
  "steam_library_scan_completed": "Steam library scan completed",
  "steam_library_scan_failed": "Steam library scan failed",
}

DIAGNOSTIC_EVENT_ALLOWED_FIELDS = {
  "cache_hit": ("providerId", "resource", "entryPoint", "source", "correlationId"),
  "resource_published": ("providerId", "resource", "entryPoint", "subscribers", "correlationId"),
  "request_joined": ("providerId", "resource", "entryPoint", "correlationId"),
  "dashboard_refresh_started": ("providerId", "mode"),
  "dashboard_refresh_completed": ("providerId", "mode", "durationMs", "source"),
  "dashboard_refresh_failed": ("providerId", "mode", "durationMs", "errorKind"),
  "provider_opened": ("providerId", "entryPoint"),
  "badge_opened": ("providerId", "entryPoint", "appId", "gameId"),
  "resource_refresh_started": ("providerId", "resource", "entryPoint", "appId", "gameId", "forceRefresh"),
  "resource_refresh_completed": ("providerId", "resource", "entryPoint", "appId", "gameId", "forceRefresh", "durationMs", "source"),
  "resource_refresh_failed": ("providerId", "resource", "entryPoint", "appId", "gameId", "forceRefresh", "durationMs", "source", "errorKind"),
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
  "subscribers",
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

_DIAGNOSTIC_STRING_FIELDS = {"appId", "entryPoint", "errorKind", "gameId", "mode", "providerId", "resource", "source", "correlationId"}
_DIAGNOSTIC_BOOLEAN_FIELDS = {"forceRefresh"}

_PRESENCE_FIELDS = ("providerId", "correlationId", "trigger", "ageMs", "lastSuccessAt", "fresh", "cooldown", "duplicate",
                    "durationMs", "status", "gameId", "validActivityDate", "activeGameChanged", "subscribers", "presentationUpdated", "failed")
for _presence_event in ("presence_evaluated", "presence_skipped", "presence_joined", "presence_validated", "presence_published", "presence_failed"):
  DIAGNOSTIC_EVENT_MESSAGES[_presence_event] = _presence_event
  DIAGNOSTIC_EVENT_ALLOWED_FIELDS[_presence_event] = _PRESENCE_FIELDS
_DIAGNOSTIC_STRING_FIELDS.add("trigger")
_DIAGNOSTIC_NUMERIC_FIELDS.update(("ageMs", "lastSuccessAt", "status"))
_DIAGNOSTIC_BOOLEAN_FIELDS.update(("fresh", "cooldown", "duplicate", "validActivityDate", "activeGameChanged", "presentationUpdated", "failed"))

for _subset_event in ("subset_candidate", "subset_checkpoint", "subset_discovery_started", "subset_discovery_joined"):
  DIAGNOSTIC_EVENT_MESSAGES[_subset_event] = _subset_event
  DIAGNOSTIC_EVENT_ALLOWED_FIELDS[_subset_event] = ("providerId", "consoleId", "gameId", "previousStatus", "candidateStatus", "attempt", "outcome", "normalization", "retryEligible", "retryAt", "checkpointSaved", "verified", "total", "remaining", "complete")
_DIAGNOSTIC_STRING_FIELDS.update(("consoleId", "previousStatus", "candidateStatus", "outcome", "normalization"))
_DIAGNOSTIC_NUMERIC_FIELDS.update(("attempt", "retryAt", "verified", "total", "remaining"))
_DIAGNOSTIC_BOOLEAN_FIELDS.update(("retryEligible", "checkpointSaved", "complete"))


def _coerce_positive_int(value: Any) -> int | None:
  if isinstance(value, bool):
    return None

  if isinstance(value, (int, float)) and math.isfinite(value) and value >= 0:
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
        fields[field_name] = coerced_value[:64]
      continue

    if field_name in _DIAGNOSTIC_BOOLEAN_FIELDS and isinstance(raw_value, bool):
      fields[field_name] = raw_value

  return {
    "event": event,
    "message": DIAGNOSTIC_EVENT_MESSAGES[event],
    "fields": fields,
  }
