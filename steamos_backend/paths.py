from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


APP_DIR_NAME = "achievement-companion"
_CONFIG_FILENAME = "provider-config.json"
_SECRETS_FILENAME = "provider-secrets.json"
_STEAM_SCAN_OVERVIEW_FILENAME = "library-achievement-scan-overview.json"
_STEAM_SCAN_SUMMARY_FILENAME = "library-achievement-scan-summary.json"
_RUNTIME_METADATA_FILENAME = "backend.json"


@dataclass(frozen=True)
class BackendPaths:
  config_path: Path
  secrets_path: Path
  logs_dir: Path
  dashboard_cache_dir: Path
  steam_scan_overview_path: Path
  steam_scan_summary_path: Path
  runtime_metadata_path: Path | None


def _resolve_home(home: Path | None) -> Path:
  return home if home is not None else Path.home()


def _get_env_path(env: Mapping[str, str], key: str) -> Path | None:
  raw_value = env.get(key)
  if raw_value is None:
    return None

  trimmed = raw_value.strip()
  if trimmed == "":
    return None

  return Path(trimmed)


def resolve_steamos_xdg_root(
  xdg_root: str | Path,
  *,
  cwd: Path | None = None,
) -> Path:
  raw_value = str(xdg_root).strip()
  if raw_value == "":
    raise ValueError("XDG root must not be empty.")

  raw_path = Path(raw_value)
  if ".." in raw_path.parts:
    raise ValueError("XDG root must not contain '..' path traversal segments.")

  base_dir = cwd if cwd is not None else Path.cwd()
  resolved_path = raw_path if raw_path.is_absolute() else (base_dir / raw_path)
  return resolved_path.resolve(strict=False)


def derive_steamos_xdg_env(
  *,
  env: Mapping[str, str] | None = None,
  xdg_root: str | Path | None = None,
  cwd: Path | None = None,
) -> dict[str, str]:
  resolved_env = dict(env or {})
  if xdg_root is None:
    return resolved_env

  root = resolve_steamos_xdg_root(xdg_root, cwd=cwd)
  resolved_env.update({
    "XDG_CONFIG_HOME": str(root / "config"),
    "XDG_DATA_HOME": str(root / "data"),
    "XDG_STATE_HOME": str(root / "state"),
    "XDG_CACHE_HOME": str(root / "cache"),
    "XDG_RUNTIME_DIR": str(root / "runtime"),
  })
  return resolved_env


def resolve_steamos_backend_paths(
  *,
  env: Mapping[str, str] | None = None,
  home: Path | None = None,
) -> BackendPaths:
  resolved_env = env or {}
  resolved_home = _resolve_home(home)

  config_root = _get_env_path(resolved_env, "XDG_CONFIG_HOME") or (resolved_home / ".config")
  data_root = _get_env_path(resolved_env, "XDG_DATA_HOME") or (resolved_home / ".local" / "share")
  state_root = _get_env_path(resolved_env, "XDG_STATE_HOME") or (resolved_home / ".local" / "state")
  cache_root = _get_env_path(resolved_env, "XDG_CACHE_HOME") or (resolved_home / ".cache")
  runtime_root = _get_env_path(resolved_env, "XDG_RUNTIME_DIR")

  config_dir = config_root / APP_DIR_NAME
  data_dir = data_root / APP_DIR_NAME
  state_dir = state_root / APP_DIR_NAME
  cache_dir = cache_root / APP_DIR_NAME
  steam_cache_dir = cache_dir / "steam"

  runtime_metadata_path = None
  if runtime_root is not None:
    runtime_metadata_path = runtime_root / APP_DIR_NAME / _RUNTIME_METADATA_FILENAME

  return BackendPaths(
    config_path=config_dir / _CONFIG_FILENAME,
    secrets_path=data_dir / _SECRETS_FILENAME,
    logs_dir=state_dir / "logs",
    dashboard_cache_dir=cache_dir / "dashboard",
    steam_scan_overview_path=steam_cache_dir / _STEAM_SCAN_OVERVIEW_FILENAME,
    steam_scan_summary_path=steam_cache_dir / _STEAM_SCAN_SUMMARY_FILENAME,
    runtime_metadata_path=runtime_metadata_path,
  )


def ensure_backend_dirs(paths: BackendPaths) -> None:
  paths.config_path.parent.mkdir(parents=True, exist_ok=True)
  paths.secrets_path.parent.mkdir(parents=True, exist_ok=True)
  paths.logs_dir.mkdir(parents=True, exist_ok=True)
  paths.dashboard_cache_dir.mkdir(parents=True, exist_ok=True)
  paths.steam_scan_overview_path.parent.mkdir(parents=True, exist_ok=True)
  paths.steam_scan_summary_path.parent.mkdir(parents=True, exist_ok=True)
  if paths.runtime_metadata_path is not None:
    paths.runtime_metadata_path.parent.mkdir(parents=True, exist_ok=True)
