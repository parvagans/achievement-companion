from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

from backend.paths import BackendPaths
from backend.storage import WarningCallback, read_json_file, write_json_file


_ALLOWED_DASHBOARD_PROVIDER_IDS = frozenset({"retroachievements", "steam"})
_SECRET_FIELD_NAMES = frozenset({"apikey", "apikeydraft", "authorization", "key", "password", "secret", "token", "y"})


def _coerce_provider_id(value: Any) -> str | None:
  if not isinstance(value, str):
    return None

  trimmed = value.strip().lower()
  if trimmed in _ALLOWED_DASHBOARD_PROVIDER_IDS:
    return trimmed
  return None


def _contains_secret_like_fields(value: Any) -> bool:
  if isinstance(value, Mapping):
    for key, nested_value in value.items():
      if isinstance(key, str) and key.strip().lower() in _SECRET_FIELD_NAMES:
        return True
      if _contains_secret_like_fields(nested_value):
        return True
    return False

  if isinstance(value, list):
    return any(_contains_secret_like_fields(item) for item in value)

  return False


def _read_cache_file(path: Path, *, warn: WarningCallback | None = None) -> dict[str, Any]:
  existed_before_read = path.exists()
  value = read_json_file(path, warn=warn)
  if not existed_before_read or not path.exists():
    return {"hit": False}
  return {"hit": True, "value": value}


def _write_cache_file(path: Path, value: Mapping[str, Any]) -> None:
  if _contains_secret_like_fields(value):
    raise ValueError("secret-like fields are not allowed in cache payloads")
  write_json_file(path, dict(value))


def _clear_file(path: Path) -> bool:
  if not path.exists():
    return False
  path.unlink()
  return True


def get_dashboard_cache_path(paths: BackendPaths, provider_id: Any) -> Path:
  resolved_provider_id = _coerce_provider_id(provider_id)
  if resolved_provider_id is None:
    raise ValueError("invalid provider id")
  return paths.dashboard_cache_dir / f"{resolved_provider_id}.json"


def read_dashboard_cache(
  paths: BackendPaths,
  provider_id: Any,
  *,
  warn: WarningCallback | None = None,
) -> dict[str, Any]:
  return _read_cache_file(get_dashboard_cache_path(paths, provider_id), warn=warn)


def write_dashboard_cache(paths: BackendPaths, provider_id: Any, value: Any) -> None:
  if not isinstance(value, Mapping):
    raise TypeError("dashboard cache payload must be an object")
  _write_cache_file(get_dashboard_cache_path(paths, provider_id), value)


def clear_dashboard_cache(paths: BackendPaths, provider_id: Any | None = None) -> bool:
  if provider_id is None:
    if not paths.dashboard_cache_dir.exists():
      return False
    removed_any = False
    for path in paths.dashboard_cache_dir.glob("*.json"):
      if path.is_file():
        path.unlink()
        removed_any = True
    return removed_any

  return _clear_file(get_dashboard_cache_path(paths, provider_id))


def read_steam_scan_overview(
  paths: BackendPaths,
  *,
  warn: WarningCallback | None = None,
) -> dict[str, Any]:
  return _read_cache_file(paths.steam_scan_overview_path, warn=warn)


def write_steam_scan_overview(paths: BackendPaths, value: Any) -> None:
  if not isinstance(value, Mapping):
    raise TypeError("steam scan overview payload must be an object")
  _write_cache_file(paths.steam_scan_overview_path, value)


def read_steam_scan_summary(
  paths: BackendPaths,
  *,
  warn: WarningCallback | None = None,
) -> dict[str, Any]:
  return _read_cache_file(paths.steam_scan_summary_path, warn=warn)


def write_steam_scan_summary(paths: BackendPaths, value: Any) -> None:
  if not isinstance(value, Mapping):
    raise TypeError("steam scan summary payload must be an object")
  _write_cache_file(paths.steam_scan_summary_path, value)


def clear_steam_scan_cache(paths: BackendPaths) -> bool:
  removed_overview = _clear_file(paths.steam_scan_overview_path)
  removed_summary = _clear_file(paths.steam_scan_summary_path)
  return removed_overview or removed_summary
