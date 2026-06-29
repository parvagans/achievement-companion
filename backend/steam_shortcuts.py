from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


_STEAM_USERDATA_ROOT_CANDIDATES: tuple[tuple[str, ...], ...] = (
  (".local", "share", "Steam", "userdata"),
  (".steam", "steam", "userdata"),
  (".steam", "root", "userdata"),
)

_BINARY_VDF_MAP = 0x00
_BINARY_VDF_STRING = 0x01
_BINARY_VDF_INTEGER = 0x02
_BINARY_VDF_END = 0x08


def _coerce_app_id(value: str | int) -> int | None:
  if isinstance(value, bool):
    return None
  if isinstance(value, int):
    return value if value > 0 else None
  trimmed = value.strip()
  if trimmed == "":
    return None
  try:
    parsed = int(trimmed, 10)
  except ValueError:
    return None
  return parsed if parsed > 0 else None


def _read_c_string(data: bytes, offset: int) -> tuple[str, int]:
  end = data.find(b"\x00", offset)
  if end < 0:
    raise ValueError("Binary VDF string terminator is missing.")
  return data[offset:end].decode("utf-8", errors="replace"), end + 1


def _parse_binary_vdf_map(data: bytes, offset: int) -> tuple[dict[str, Any], int]:
  result: dict[str, Any] = {}

  while offset < len(data):
    value_type = data[offset]
    offset += 1

    if value_type == _BINARY_VDF_END:
      return result, offset

    key, offset = _read_c_string(data, offset)

    if value_type == _BINARY_VDF_MAP:
      value, offset = _parse_binary_vdf_map(data, offset)
      result[key] = value
      continue

    if value_type == _BINARY_VDF_STRING:
      value, offset = _read_c_string(data, offset)
      result[key] = value
      continue

    if value_type == _BINARY_VDF_INTEGER:
      if offset + 4 > len(data):
        raise ValueError("Binary VDF integer field is truncated.")
      result[key] = int.from_bytes(data[offset:offset + 4], "little", signed=False)
      offset += 4
      continue

    raise ValueError(f"Unsupported binary VDF field type: 0x{value_type:02x}")

  raise ValueError("Binary VDF map is missing its end marker.")


def parse_steam_shortcuts_vdf(data: bytes) -> dict[str, dict[str, Any]]:
  if len(data) == 0 or data[0] != _BINARY_VDF_MAP:
    raise ValueError("Steam shortcuts.vdf is missing the root shortcuts map.")

  root_key, offset = _read_c_string(data, 1)
  if root_key != "shortcuts":
    raise ValueError("Steam shortcuts.vdf root key is not shortcuts.")

  shortcuts, offset = _parse_binary_vdf_map(data, offset)
  if offset < len(data) and data[offset:] not in (b"", bytes([_BINARY_VDF_END])):
    raise ValueError("Binary VDF file has unexpected trailing data.")

  normalized_shortcuts: dict[str, dict[str, Any]] = {}
  for key, value in shortcuts.items():
    if isinstance(value, dict):
      normalized_shortcuts[key] = value

  return normalized_shortcuts


def iter_steam_shortcuts_files(
  *,
  home: Path | None = None,
  extra_roots: Sequence[Path] | None = None,
) -> Iterable[Path]:
  resolved_home = home if home is not None else Path.home()
  seen_paths: set[Path] = set()

  root_candidates = [resolved_home.joinpath(*parts) for parts in _STEAM_USERDATA_ROOT_CANDIDATES]
  if extra_roots is not None:
    root_candidates.extend(extra_roots)

  for root in root_candidates:
    if not root.exists() or not root.is_dir():
      continue

    for shortcuts_path in root.glob("*/config/shortcuts.vdf"):
      resolved_path = shortcuts_path.resolve(strict=False)
      if resolved_path in seen_paths or not resolved_path.is_file():
        continue
      seen_paths.add(resolved_path)
      yield resolved_path


def load_steam_shortcut_metadata(
  app_id: str | int,
  *,
  home: Path | None = None,
  shortcuts_files: Sequence[Path] | None = None,
) -> Mapping[str, Any] | None:
  normalized_app_id = _coerce_app_id(app_id)
  if normalized_app_id is None:
    return None

  paths_to_scan = shortcuts_files or tuple(iter_steam_shortcuts_files(home=home))
  matched_titles: list[str] = []

  for shortcuts_path in paths_to_scan:
    try:
      shortcuts = parse_steam_shortcuts_vdf(shortcuts_path.read_bytes())
    except OSError:
      continue
    except ValueError:
      continue

    for shortcut in shortcuts.values():
      shortcut_app_id = shortcut.get("appid")
      if shortcut_app_id != normalized_app_id:
        continue

      app_name = (
        shortcut.get("appname")
        or shortcut.get("AppName")
        or shortcut.get("name")
        or shortcut.get("Name")
      )
      if isinstance(app_name, str):
        trimmed_title = app_name.strip()
        if trimmed_title != "":
          matched_titles.append(trimmed_title)

  unique_titles = list(dict.fromkeys(matched_titles))
  if len(unique_titles) != 1:
    return None

  return {
    "appId": str(normalized_app_id),
    "title": unique_titles[0],
  }
