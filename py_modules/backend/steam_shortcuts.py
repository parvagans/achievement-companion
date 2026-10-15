from __future__ import annotations

import os
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

# Discovery hints only. This is not a list of formats supported by rcheevos.
# Existing regular files with other extensions are also considered below.
_GAME_PATH_HINT_EXTENSIONS = {
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
  ".nds",
  ".nes",
  ".n64",
  ".pbp",
  ".pce",
  ".sfc",
  ".smc",
  ".sms",
  ".v64",
  ".z64",
  ".cue",
  ".m3u",
  ".zip",
  ".7z",
  ".rar",
}
_NON_GAME_ARGUMENT_EXTENSIONS = {
  ".appimage", ".bat", ".cfg", ".cmd", ".conf", ".desktop", ".dll",
  ".exe", ".ini", ".json", ".log", ".pdf", ".py", ".sh", ".so",
  ".txt", ".xml",
}
_MAX_COMMAND_TOKENS = 64
_MAX_REJECTION_DIAGNOSTICS = 8


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

  if len(matched_shortcuts) == 0:
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
  }
  if matched_titles:
    metadata["title"] = matched_titles[0]
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


def _command_path_token(token: str) -> str | None:
  if token == "%command%":
    return None
  if token.startswith("-"):
    # --game=/path/file is a file argument; --core=/path/core.so is rejected
    # by the non-game filter below.
    token = token.partition("=")[2]
  return token if token not in {"", "%command%"} else None


def _start_dir_path(shortcut: Mapping[str, Any]) -> Path | None:
  value = _pick_shortcut_string(shortcut, "startdir", "StartDir")
  if value is None:
    return None
  if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
    value = value[1:-1]
  return Path(value).expanduser()


def _candidate_rejection(path: Path, source: str, reason: str) -> dict[str, str]:
  return {"source": source, "extension": path.suffix.lower(), "reason": reason}


def _resolve_shortcut_rom_path_from_command(
  command_text: str | None,
  *,
  source: str,
  start_dir: Path | None,
) -> tuple[list[dict[str, Any]], list[dict[str, str]], bool]:
  if command_text is None:
    return [], [], False

  try:
    tokens = shlex.split(command_text, posix=True)
  except ValueError:
    tokens = command_text.split()

  candidates: list[dict[str, Any]] = []
  rejections: list[dict[str, str]] = []
  saw_missing_hint = False

  for raw_token in tokens[:_MAX_COMMAND_TOKENS]:
    token = _command_path_token(raw_token)
    if token is None:
      continue

    candidate = Path(token).expanduser()
    if not candidate.is_absolute():
      if start_dir is None:
        continue
      candidate = start_dir / candidate

    extension = candidate.suffix.lower()
    if extension in _NON_GAME_ARGUMENT_EXTENSIONS or candidate.stem.lower() in {"bios", "firmware"} or any(
      part.lower() in {"bios", "firmware"} for part in candidate.parts
    ):
      rejections.append(_candidate_rejection(candidate, source, "non-game-argument"))
      continue

    if candidate.is_file():
      # Executable helper arguments are launch infrastructure, not game data.
      # A recognized game suffix remains a hint for direct-ROM shortcuts.
      if extension not in _GAME_PATH_HINT_EXTENSIONS and os.name != "nt" and os.access(candidate, os.X_OK):
        rejections.append(_candidate_rejection(candidate, source, "launcher-executable"))
        continue
      candidates.append({"path": candidate.resolve(), "source": source, "extension": extension})
    elif extension in _GAME_PATH_HINT_EXTENSIONS:
      saw_missing_hint = True
      rejections.append(_candidate_rejection(candidate, source, "file-unreadable"))

  return candidates, rejections[:_MAX_REJECTION_DIAGNOSTICS], saw_missing_hint


def _resolve_shortcut_rom_path(
  shortcut: Mapping[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, str]], str | None, bool]:
  start_dir = _start_dir_path(shortcut)

  launch_options = _pick_shortcut_string(shortcut, "LaunchOptions", "launchoptions", "launchOptions")
  launch_candidates, launch_rejections, launch_missing = _resolve_shortcut_rom_path_from_command(
    launch_options,
    source="launchoptions",
    start_dir=start_dir,
  )
  exe_value = _pick_shortcut_string(shortcut, "exe", "Exe")
  exe_candidates, exe_rejections, exe_missing = _resolve_shortcut_rom_path_from_command(
    exe_value,
    source="exe",
    start_dir=start_dir,
  )
  unique: dict[Path, dict[str, Any]] = {}
  for candidate in (*launch_candidates, *exe_candidates):
    unique.setdefault(candidate["path"], candidate)
  candidates = list(unique.values())
  rejections = (launch_rejections + exe_rejections)[:_MAX_REJECTION_DIAGNOSTICS]
  if len(candidates) > 1:
    return candidates, rejections, None, True
  if candidates:
    return candidates, rejections, None, True
  if launch_missing or exe_missing:
    return [], rejections, "rom-file-unreadable", True
  return [], rejections, "rom-path-unavailable", False


def load_steam_shortcut_rom_path(
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
  candidates, rejections, skip_reason, shortcut_rom_path_detected = _resolve_shortcut_rom_path(shortcut)
  first_candidate = candidates[0] if candidates else None
  rom_path = first_candidate["path"] if len(candidates) == 1 else None
  rom_path_source = first_candidate["source"] if first_candidate is not None else (
    next((rejection["source"] for rejection in rejections if rejection["reason"] == "file-unreadable"), None)
  )
  return {
    "appId": str(normalized_app_id),
    "shortcutRomPathDetected": shortcut_rom_path_detected,
    **({"shortcutRomPathSource": rom_path_source} if rom_path_source is not None else {}),
    "romPath": rom_path,
    "romCandidates": candidates,
    "candidateCount": len(candidates),
    "candidateRejections": rejections,
    **({"reason": skip_reason} if skip_reason is not None else {}),
  }
