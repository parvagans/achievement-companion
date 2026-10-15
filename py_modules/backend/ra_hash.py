"""RetroAchievements ROM hashing through the bundled rcheevos helper."""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
import time
import zipfile
from pathlib import Path
from pathlib import PurePosixPath
from typing import Any, Mapping, Sequence

from .steam_shortcuts import load_steam_shortcut_rom_path


_HELPER_PATH = Path(__file__).resolve().parents[2] / "bin" / "ac-rhash"
_HASH_PATTERN = re.compile(r"[0-9a-f]{32}\Z")
_REASON_PATTERN = re.compile(r"[a-z0-9-]{1,80}\Z")
_HASH_TIMEOUT_SECONDS = 120
_REQUEST_BUDGET_SECONDS = 180
_MAX_ROM_CANDIDATES = 4
_MAX_ARCHIVE_ENTRIES = 128
_MAX_ARCHIVE_MEMBER_BYTES = 2 * 1024 * 1024 * 1024
_HASH_CACHE: dict[tuple[str, int, int, int], tuple[str, str | None, str | None, str | None]] = {}
_CACHE_LIMIT = 256
# A cue or playlist may reference other files whose changes cannot be detected
# from the descriptor's stat alone.
_UNCACHEABLE_EXTENSIONS = {".cue", ".gdi", ".m3u"}


def _native_hash(
  path: Path, console_id: int, *, helper_path: Path = _HELPER_PATH, timeout_seconds: float = _HASH_TIMEOUT_SECONDS,
  reader_info: dict[str, str] | None = None,
) -> tuple[str, str | None]:
  try:
    result = subprocess.run(
      [str(helper_path), str(console_id), str(path)],
      capture_output=True,
      text=True,
      timeout=timeout_seconds,
      check=False,
    )
  except FileNotFoundError:
    return "error", "native-helper-missing"
  except PermissionError:
    return "error", "native-helper-not-executable"
  except subprocess.TimeoutExpired:
    return "error", "native-helper-timeout"
  except OSError:
    return "error", "native-helper-execution-failed"

  if len(result.stdout) > 4096:
    return "error", "native-helper-malformed-response"
  try:
    response = json.loads(result.stdout)
  except (ValueError, TypeError):
    return "error", "native-helper-exited" if result.returncode != 0 else "native-helper-malformed-response"
  if not isinstance(response, dict):
    return "error", "native-helper-malformed-response"

  if reader_info is not None:
    if response.get("mediaReader") in {"direct", "nintendo-disc", "chd", "rar", "playlist", "compressed-iso", "archive"}:
      reader_info["mediaReader"] = response["mediaReader"]
    if response.get("mediaReaderStatus") in {"ready", "direct", "invalid", "unreadable", "read-failed", "not-implemented"}:
      reader_info["mediaReaderStatus"] = response["mediaReaderStatus"]

  status = response.get("status")
  reason = response.get("reason")
  if status == "resolved" and result.returncode == 0:
    rom_hash = response.get("hash")
    if (
      isinstance(rom_hash, str)
      and _HASH_PATTERN.fullmatch(rom_hash) is not None
      and type(response.get("consoleId")) is int
      and response.get("consoleId") == console_id
      and response.get("method") == "rcheevos"
    ):
      return "resolved", rom_hash
    return "error", "native-helper-malformed-response"

  if status == "unavailable" and result.returncode == 0 and isinstance(reason, str) and _REASON_PATTERN.fullmatch(reason):
    return "skipped", reason
  if status == "error" and isinstance(reason, str) and _REASON_PATTERN.fullmatch(reason):
    return "error", reason
  return "error", "native-helper-malformed-response" if result.returncode == 0 else "native-helper-exited"


def _archive_game_member(info: zipfile.ZipInfo) -> bool:
  if info.is_dir():
    return False
  path = PurePosixPath(info.filename)
  name = path.name.lower()
  if "__macosx" in (part.lower() for part in path.parts) or name.startswith("._"):
    return False
  if name in {".ds_store", "readme", "license", "manual"} or name.startswith(("readme.", "license.", "manual.")):
    return False
  return path.suffix.lower() not in {".txt", ".nfo", ".pdf", ".diz", ".png", ".jpg", ".jpeg", ".xml"}


def _hash_zip_member(
  path: Path, console_id: int, *, helper_path: Path, deadline: float, reader_info: dict[str, str] | None = None,
) -> tuple[str, str | None, str | None, bool]:
  """Stream one unambiguous ZIP member to a temporary file for rcheevos."""
  try:
    with zipfile.ZipFile(path) as archive:
      infos = archive.infolist()
      if len(infos) > _MAX_ARCHIVE_ENTRIES:
        return "skipped", "archive-too-many-entries", None, False
      members = [info for info in infos if _archive_game_member(info)]
      if len(members) != 1:
        return "skipped", "archive-no-game-file" if not members else "archive-ambiguous", None, False
      member = members[0]
      if member.flag_bits & 1:
        return "skipped", "archive-encrypted", None, False
      extension = PurePosixPath(member.filename).suffix.lower()
      if member.file_size > _MAX_ARCHIVE_MEMBER_BYTES:
        return "skipped", "archive-member-too-large", extension, False
      with tempfile.TemporaryDirectory(prefix="ac-rhash-") as directory:
        extracted = Path(directory) / f"game{extension}"
        extracted_bytes = 0
        with archive.open(member) as source, extracted.open("wb") as target:
          while True:
            if time.monotonic() >= deadline:
              return "error", "archive-extraction-timeout", extension, False
            chunk = source.read(1024 * 1024)
            if not chunk:
              break
            extracted_bytes += len(chunk)
            if extracted_bytes > _MAX_ARCHIVE_MEMBER_BYTES:
              return "skipped", "archive-member-too-large", extension, False
            target.write(chunk)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
          return "error", "hash-budget-exceeded", extension, False
        status, value = _native_hash(
          extracted, console_id, helper_path=helper_path, timeout_seconds=min(_HASH_TIMEOUT_SECONDS, remaining), reader_info=reader_info,
        )
        if reader_info is not None:
          reader_info["mediaReader"] = "zip-member"
          reader_info["mediaReaderStatus"] = "ready" if status == "resolved" else "failed"
        return status, value, extension, True
  except (zipfile.BadZipFile, EOFError, NotImplementedError):
    return "skipped", "archive-invalid", None, False
  except RuntimeError:
    return "skipped", "archive-unreadable", None, False
  except OSError:
    return "error", "archive-unreadable", None, False


def _hash_candidate(
  path: Path, console_id: int, *, helper_path: Path, deadline: float, reader_info: dict[str, str] | None = None,
) -> tuple[str, str | None, str | None, bool]:
  # rcheevos hashes Arcade archives by name and MS-DOS ZIPs by their contents.
  # Other ZIPs contain a ROM that must be supplied to its console-specific API.
  if path.suffix.lower() == ".zip" and console_id not in {26, 27}:
    return _hash_zip_member(path, console_id, helper_path=helper_path, deadline=deadline, reader_info=reader_info)
  remaining = deadline - time.monotonic()
  if remaining <= 0:
    return "error", "hash-budget-exceeded", None, False
  status, value = _native_hash(path, console_id, helper_path=helper_path, timeout_seconds=min(_HASH_TIMEOUT_SECONDS, remaining), reader_info=reader_info)
  return status, value, None, True


def load_steam_shortcut_rom_hash(
  app_id: str | int,
  console_id: int,
  *,
  home: Path | None = None,
  shortcuts_files: Sequence[Path] | None = None,
  helper_path: Path = _HELPER_PATH,
) -> Mapping[str, Any] | None:
  if isinstance(console_id, bool) or not isinstance(console_id, int) or not 1 <= console_id <= 65535:
    return None

  discovery = load_steam_shortcut_rom_path(app_id, home=home, shortcuts_files=shortcuts_files)
  if discovery is None:
    return None

  candidates = discovery.get("romCandidates")
  if not isinstance(candidates, list):
    path = discovery.get("romPath")
    candidates = [{"path": path, "source": discovery.get("shortcutRomPathSource")}] if isinstance(path, Path) else []
  base: dict[str, Any] = {
    "appId": discovery["appId"],
    "shortcutRomPathDetected": discovery["shortcutRomPathDetected"],
    **({"shortcutRomPathSource": discovery["shortcutRomPathSource"]} if "shortcutRomPathSource" in discovery else {}),
    "candidateCount": discovery.get("candidateCount", len(candidates)),
    "candidateRejections": discovery.get("candidateRejections", []),
  }
  if not candidates:
    return {
      **base,
      "romHashAttempted": False,
      "romHashStatus": "skipped",
      "hashResolverSkippedReason": discovery.get("reason", "rom-path-unavailable"),
    }

  if len(candidates) > _MAX_ROM_CANDIDATES:
    return {**base, "romHashAttempted": False, "romHashStatus": "ambiguous", "hashResolverSkippedReason": "too-many-game-path-candidates"}

  deadline = time.monotonic() + _REQUEST_BUDGET_SECONDS
  results: list[dict[str, Any]] = []
  resolved: dict[str, dict[str, Any]] = {}
  hash_attempted = False
  for candidate in candidates:
    path = candidate.get("path") if isinstance(candidate, dict) else None
    if not isinstance(path, Path):
      continue
    source = candidate.get("source")
    extension = path.suffix.lower()
    try:
      file_stat = path.stat()
    except OSError:
      results.append({"source": source, "extension": extension, "status": "skipped", "reason": "rom-file-unreadable"})
      continue

    cache_key = (str(path), file_stat.st_size, file_stat.st_mtime_ns, console_id)
    cacheable = extension not in _UNCACHEABLE_EXTENSIONS
    cached_hash = _HASH_CACHE.get(cache_key) if cacheable else None
    reader_info: dict[str, str] = {}
    if cached_hash is not None:
      status, value, member_extension, attempted = "resolved", cached_hash[0], cached_hash[1], False
      if cached_hash[2] is not None:
        reader_info["mediaReader"] = cached_hash[2]
      if cached_hash[3] is not None:
        reader_info["mediaReaderStatus"] = cached_hash[3]
    else:
      status, value, member_extension, attempted = _hash_candidate(
        path, console_id, helper_path=helper_path, deadline=deadline, reader_info=reader_info,
      )
      if status == "resolved" and value is not None and cacheable:
        if len(_HASH_CACHE) >= _CACHE_LIMIT:
          _HASH_CACHE.pop(next(iter(_HASH_CACHE)))
        _HASH_CACHE[cache_key] = (value, member_extension, reader_info.get("mediaReader"), reader_info.get("mediaReaderStatus"))
    hash_attempted = hash_attempted or attempted
    result = {"source": source, "extension": extension, "status": status}
    result.update(reader_info)
    if member_extension is not None:
      result["memberExtension"] = member_extension
    if status == "resolved" and value is not None:
      resolved.setdefault(value, result)
    else:
      result["reason"] = value or "rom-hash-unavailable"
    results.append(result)

  shared = {**base, "romHashAttempted": hash_attempted, "candidateResults": results}
  if len(resolved) > 1:
    return {**shared, "candidateExtension": results[0]["extension"], "romHashStatus": "ambiguous", "hashResolverSkippedReason": "ambiguous-rom-hash-candidates"}
  if resolved:
    rom_hash, selected = next(iter(resolved.items()))
    return {
      **shared,
      "shortcutRomPathSource": selected["source"],
      "candidateExtension": selected["extension"],
      **({"archiveMemberExtension": selected["memberExtension"]} if "memberExtension" in selected else {}),
      "romHashStatus": "resolved", "romHashAlgorithm": "rcheevos", "romHash": rom_hash,
    }
  preferred = next((result for result in results if result["status"] == "error"), results[0] if results else None)
  if preferred is None:
    return {**shared, "romHashStatus": "skipped", "hashResolverSkippedReason": "rom-path-unavailable"}
  return {
    **shared,
    "romHashStatus": "error" if preferred["status"] == "error" else "skipped",
    "candidateExtension": preferred["extension"],
    "shortcutRomPathSource": preferred["source"],
    "hashResolverSkippedReason": preferred["reason"],
  }
