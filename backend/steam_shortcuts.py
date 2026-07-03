from __future__ import annotations

import hashlib
import shlex
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

_ROM_FILE_EXTENSIONS = {
  ".bin",
  ".chd",
  ".gb",
  ".gba",
  ".gbc",
  ".gen",
  ".gg",
  ".img",
  ".iso",
  ".md",
  ".nes",
  ".n64",
  ".pbp",
  ".pce",
  ".sfc",
  ".smc",
  ".sms",
  ".v64",
  ".z64",
}


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


def _pick_shortcut_string(shortcut: Mapping[str, Any], *keys: str) -> str | None:
  for key in keys:
    value = shortcut.get(key)
    if isinstance(value, str):
      trimmed = value.strip()
      if trimmed != "":
        return trimmed
  return None


def _iter_shortcut_tags(shortcut: Mapping[str, Any]) -> list[str]:
  tags_value = shortcut.get("tags")
  if not isinstance(tags_value, Mapping):
    tags_value = shortcut.get("Tags")

  if not isinstance(tags_value, Mapping):
    return []

  def sort_key(key: Any) -> tuple[int, int | str]:
    if isinstance(key, str) and key.isdigit():
      return (0, int(key))
    return (1, str(key))

  tags: list[str] = []
  for key in sorted(tags_value.keys(), key=sort_key):
    value = tags_value.get(key)
    if isinstance(value, str):
      trimmed = value.strip()
      if trimmed != "":
        tags.append(trimmed)

  return list(dict.fromkeys(tags))


def _collect_matching_shortcuts(
  app_id: str | int,
  *,
  home: Path | None = None,
  shortcuts_files: Sequence[Path] | None = None,
) -> tuple[int | None, list[Mapping[str, Any]]]:
  normalized_app_id = _coerce_app_id(app_id)
  if normalized_app_id is None:
    return None, []

  paths_to_scan = shortcuts_files or tuple(iter_steam_shortcuts_files(home=home))
  matched_shortcuts: list[Mapping[str, Any]] = []

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
      matched_shortcuts.append(shortcut)

  return normalized_app_id, matched_shortcuts


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
  normalized_app_id, matched_shortcuts = _collect_matching_shortcuts(
    app_id,
    home=home,
    shortcuts_files=shortcuts_files,
  )
  if normalized_app_id is None:
    return None

  matched_titles: list[str] = []
  for shortcut in matched_shortcuts:
    app_name = _pick_shortcut_string(shortcut, "appname", "AppName", "name", "Name")
    if isinstance(app_name, str):
      matched_titles.append(app_name)

  unique_titles = list(dict.fromkeys(matched_titles))
  if len(unique_titles) != 1:
    return None

  platform_tags: list[str] = []
  exe_value: str | None = None
  start_dir_value: str | None = None
  for shortcut in matched_shortcuts:
    for tag_value in _iter_shortcut_tags(shortcut):
      if tag_value not in platform_tags:
        platform_tags.append(tag_value)

    if exe_value is None:
      exe_value = _pick_shortcut_string(shortcut, "exe", "Exe")

    if start_dir_value is None:
      start_dir_value = _pick_shortcut_string(shortcut, "startdir", "StartDir")

  platform_tag = platform_tags[0] if len(platform_tags) > 0 else None

  metadata: dict[str, Any] = {
    "appId": str(normalized_app_id),
    "title": unique_titles[0],
  }
  if platform_tag is not None:
    metadata["platformTag"] = platform_tag
    metadata["platformLabel"] = platform_tag
  if len(platform_tags) > 0:
    metadata["tags"] = platform_tags
  if exe_value is not None:
    metadata["exe"] = exe_value
  if start_dir_value is not None:
    metadata["startDir"] = start_dir_value

  return metadata


def _is_ambiguous_rom_path(path: Path) -> bool:
  return path.suffix.lower() in {".zip", ".7z", ".rar", ".cue", ".m3u", ".pls"}


def _is_known_rom_file_path(path: Path) -> bool:
  return path.suffix.lower() in _ROM_FILE_EXTENSIONS


def _looks_like_path_token(token: str) -> bool:
  if token.startswith("-") or token == "%command%":
    return False

  return (
    "/" in token
    or "\\" in token
    or token.startswith("~")
    or (len(token) > 1 and token[1] == ":" and token[0].isalpha())
    or Path(token).suffix != ""
  )


def _resolve_shortcut_rom_path_from_command(
  command_text: str | None,
  *,
  source: str,
  start_dir: Path | None,
) -> tuple[Path | None, str | None, str | None, bool, bool]:
  if command_text is None:
    return None, None, "rom-path-unavailable", False, False

  try:
    tokens = shlex.split(command_text, posix=True)
  except ValueError:
    tokens = command_text.split()

  selected_candidate: Path | None = None
  saw_rom_candidate = False
  saw_ambiguous_container = False

  for token in tokens:
    if not _looks_like_path_token(token):
      continue

    candidate = Path(token)
    if not candidate.is_absolute():
      if start_dir is None:
        continue
      candidate = start_dir / candidate

    if _is_ambiguous_rom_path(candidate):
      saw_ambiguous_container = True
      continue

    if not _is_known_rom_file_path(candidate):
      continue

    saw_rom_candidate = True
    if candidate.is_file():
      selected_candidate = candidate

  if selected_candidate is not None:
    return selected_candidate, source, None, True, True

  if saw_ambiguous_container:
    return None, source, "rom-path-ambiguous-container", False, True

  if saw_rom_candidate:
    return None, source, "rom-file-unreadable", True, True

  return None, None, "rom-path-unavailable", False, False


def _resolve_shortcut_rom_path(
  shortcut: Mapping[str, Any],
) -> tuple[Path | None, str | None, str | None, bool, bool]:
  start_dir_value = _pick_shortcut_string(shortcut, "startdir", "StartDir")
  start_dir = Path(start_dir_value) if start_dir_value is not None else None

  launch_options = _pick_shortcut_string(shortcut, "LaunchOptions", "launchoptions", "launchOptions")
  launch_resolution = _resolve_shortcut_rom_path_from_command(
    launch_options,
    source="launchoptions",
    start_dir=start_dir,
  )
  if launch_resolution[0] is not None or launch_resolution[2] == "rom-path-ambiguous-container":
    return launch_resolution

  exe_value = _pick_shortcut_string(shortcut, "exe", "Exe")
  exe_resolution = _resolve_shortcut_rom_path_from_command(
    exe_value,
    source="exe",
    start_dir=start_dir,
  )
  if exe_resolution[0] is not None or exe_resolution[2] == "rom-path-ambiguous-container":
    return exe_resolution

  if launch_resolution[4]:
    return launch_resolution
  if exe_resolution[4]:
    return exe_resolution

  return None, None, "rom-path-unavailable", False, False


def _hash_file_md5(path: Path) -> str:
  digest = hashlib.md5()
  with path.open("rb") as file_handle:
    while True:
      chunk = file_handle.read(1024 * 1024)
      if not chunk:
        break
      digest.update(chunk)
  return digest.hexdigest()


def load_steam_shortcut_rom_hash(
  app_id: str | int,
  *,
  home: Path | None = None,
  shortcuts_files: Sequence[Path] | None = None,
) -> Mapping[str, Any] | None:
  normalized_app_id, matched_shortcuts = _collect_matching_shortcuts(
    app_id,
    home=home,
    shortcuts_files=shortcuts_files,
  )
  if normalized_app_id is None:
    return None

  if len(matched_shortcuts) == 0:
    return None

  shortcut = matched_shortcuts[0]
  rom_path, rom_path_source, skip_reason, rom_path_attempted, shortcut_rom_path_detected = _resolve_shortcut_rom_path(shortcut)
  if skip_reason == "rom-path-ambiguous-container":
    return {
      "appId": str(normalized_app_id),
      "shortcutRomPathDetected": shortcut_rom_path_detected,
      **({"shortcutRomPathSource": rom_path_source} if rom_path_source is not None else {}),
      "romHashAttempted": False,
      "romHashStatus": "skipped",
      "hashResolverSkippedReason": skip_reason,
    }
  if rom_path is None:
    return {
      "appId": str(normalized_app_id),
      "shortcutRomPathDetected": shortcut_rom_path_detected,
      **({"shortcutRomPathSource": rom_path_source} if rom_path_source is not None else {}),
      "romHashAttempted": rom_path_attempted,
      "romHashStatus": "skipped",
      **({"hashResolverSkippedReason": skip_reason} if skip_reason is not None else {}),
    }

  try:
    rom_hash = _hash_file_md5(rom_path)
  except OSError:
    return {
      "appId": str(normalized_app_id),
      "shortcutRomPathDetected": True,
      **({"shortcutRomPathSource": rom_path_source} if rom_path_source is not None else {}),
      "romHashAttempted": True,
      "romHashStatus": "skipped",
      "hashResolverSkippedReason": "rom-file-unreadable",
    }

  return {
    "appId": str(normalized_app_id),
    "shortcutRomPathDetected": True,
    **({"shortcutRomPathSource": rom_path_source} if rom_path_source is not None else {}),
    "romHashAttempted": True,
    "romHashStatus": "resolved",
    "romHashAlgorithm": "md5",
    "romHash": rom_hash,
  }
