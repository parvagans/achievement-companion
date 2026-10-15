from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import _test_support  # noqa: F401
from backend import ra_hash


VALID_HASH = "0123456789abcdef0123456789abcdef"


class RetroAchievementsHashTests(unittest.TestCase):
  def setUp(self) -> None:
    ra_hash._HASH_CACHE.clear()

  def test_native_result_is_validated(self) -> None:
    with patch.object(ra_hash.subprocess, "run", return_value=subprocess.CompletedProcess(
      args=[], returncode=0, stdout=json.dumps({"status": "resolved", "hash": VALID_HASH, "consoleId": 18, "method": "rcheevos"}), stderr="",
    )) as run:
      self.assertEqual(ra_hash._native_hash(Path("game.nds"), 18), ("resolved", VALID_HASH))
      self.assertEqual(run.call_args.args[0][1:], ["18", "game.nds"])
      self.assertFalse(run.call_args.kwargs["shell"] if "shell" in run.call_args.kwargs else False)

  def test_native_media_reader_diagnostics_are_path_redacted(self) -> None:
    response = {"status": "unavailable", "reason": "container-reader-invalid", "mediaReader": "nintendo-disc", "mediaReaderStatus": "invalid"}
    reader_info: dict[str, str] = {}
    with patch.object(ra_hash.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(response), "/private/game.rvz")):
      self.assertEqual(ra_hash._native_hash(Path("game.rvz"), 16, reader_info=reader_info), ("skipped", "container-reader-invalid"))
    self.assertEqual(reader_info, {"mediaReader": "nintendo-disc", "mediaReaderStatus": "invalid"})


  def test_native_errors_are_distinct(self) -> None:
    examples = [
      (FileNotFoundError(), "native-helper-missing"),
      (PermissionError(), "native-helper-not-executable"),
      (subprocess.TimeoutExpired("helper", 120), "native-helper-timeout"),
    ]
    for exception, reason in examples:
      with self.subTest(reason=reason), patch.object(ra_hash.subprocess, "run", side_effect=exception):
        self.assertEqual(ra_hash._native_hash(Path("game.nds"), 18), ("error", reason))

  def test_malformed_and_nonzero_helper_results(self) -> None:
    for stdout, code, expected in [
      ("invalid", 0, "native-helper-malformed-response"),
      (json.dumps({"status": "resolved", "hash": VALID_HASH, "consoleId": 21, "method": "rcheevos"}), 0, "native-helper-malformed-response"),
      ("", 1, "native-helper-exited"),
      (json.dumps({"status": "error", "reason": "rom-unreadable"}), 1, "rom-unreadable"),
    ]:
      with self.subTest(stdout=stdout), patch.object(ra_hash.subprocess, "run", return_value=subprocess.CompletedProcess([], code, stdout, "")):
        self.assertEqual(ra_hash._native_hash(Path("game.nds"), 18), ("error", expected))

  def test_cache_uses_file_identity_and_console_not_title(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "game.nds"
      rom_path.write_bytes(b"first")
      discovery = {"appId": "123", "romPath": rom_path, "shortcutRomPathDetected": True}
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash", return_value=("resolved", VALID_HASH),
      ) as native:
        first = ra_hash.load_steam_shortcut_rom_hash("123", 18)
        second = ra_hash.load_steam_shortcut_rom_hash("456", 18)
        self.assertEqual(first["romHash"], second["romHash"])
        self.assertEqual(native.call_count, 1)
        rom_path.write_bytes(b"changed size")
        ra_hash.load_steam_shortcut_rom_hash("123", 18)
        current = rom_path.stat()
        os.utime(rom_path, ns=(current.st_atime_ns, current.st_mtime_ns + 1_000_000_000))
        ra_hash.load_steam_shortcut_rom_hash("123", 18)
        ra_hash.load_steam_shortcut_rom_hash("123", 21)
        self.assertEqual(native.call_count, 4)

  def test_large_disc_has_no_size_limit(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "game.iso"
      with rom_path.open("wb") as file:
        file.truncate(513 * 1024 * 1024)
      discovery = {"appId": "123", "romPath": rom_path, "shortcutRomPathDetected": True}
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash", return_value=("resolved", VALID_HASH),
      ) as native:
        result = ra_hash.load_steam_shortcut_rom_hash("123", 21)
      self.assertEqual(result["romHashStatus"], "resolved")
      native.assert_called_once()

  def test_unavailable_path_and_failed_hash_are_not_cached(self) -> None:
    discovery = {"appId": "123", "romPath": None, "shortcutRomPathDetected": False, "reason": "rom-path-unavailable"}
    with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery):
      result = ra_hash.load_steam_shortcut_rom_hash("123", 18)
      self.assertEqual(result["romHashStatus"], "skipped")
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "game.nds"
      rom_path.write_bytes(b"fixture")
      discovery = {"appId": "123", "romPath": rom_path, "shortcutRomPathDetected": True}
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash", return_value=("skipped", "unsupported-format"),
      ) as native:
        ra_hash.load_steam_shortcut_rom_hash("123", 18)
        ra_hash.load_steam_shortcut_rom_hash("123", 18)
        self.assertEqual(native.call_count, 2)

  def test_single_member_nes_zip_reaches_rcheevos_with_member_suffix(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      archive_path = Path(temp_dir) / "Tetris.zip"
      with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("README.txt", "notes")
        archive.writestr("Tetris.nes", b"NES\x1a" + bytes(32))
      discovery = {"appId": "123", "romCandidates": [{"path": archive_path, "source": "exe"}], "shortcutRomPathDetected": True}
      def inspect(path: Path, _console_id: int, **_kwargs: object) -> tuple[str, str]:
        self.assertEqual(path.suffix, ".nes")
        self.assertEqual(path.read_bytes()[:4], b"NES\x1a")
        return "resolved", VALID_HASH
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash", side_effect=inspect,
      ) as native:
        result = ra_hash.load_steam_shortcut_rom_hash("123", 7)
      self.assertEqual(result["romHash"], VALID_HASH)
      self.assertEqual(result["archiveMemberExtension"], ".nes")
      self.assertEqual(result["candidateResults"][0]["mediaReader"], "zip-member")
      self.assertEqual(result["candidateResults"][0]["mediaReaderStatus"], "ready")
      native.assert_called_once()

  def test_multiple_candidates_choose_one_valid_hash_and_fail_closed_on_distinct_hashes(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      first = Path(temp_dir) / "notes.hex"
      second = Path(temp_dir) / "game.nes"
      first.write_bytes(b"notes")
      second.write_bytes(b"game")
      discovery = {"appId": "123", "romCandidates": [
        {"path": first, "source": "launchoptions"}, {"path": second, "source": "launchoptions"},
      ], "shortcutRomPathDetected": True}
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash", side_effect=[("skipped", "invalid-file"), ("resolved", VALID_HASH)],
      ):
        result = ra_hash.load_steam_shortcut_rom_hash("123", 7)
      self.assertEqual(result["romHash"], VALID_HASH)
      self.assertEqual(result["candidateExtension"], ".nes")
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash", side_effect=[("resolved", VALID_HASH), ("resolved", "abcdef0123456789abcdef0123456789")],
      ):
        result = ra_hash.load_steam_shortcut_rom_hash("123", 8)
      self.assertEqual(result["romHashStatus"], "ambiguous")
      self.assertNotIn("romHash", result)

  def test_ambiguous_archive_is_not_hashed(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      archive_path = Path(temp_dir) / "games.zip"
      with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("one.nes", b"one")
        archive.writestr("two.nes", b"two")
      discovery = {"appId": "123", "romCandidates": [{"path": archive_path, "source": "exe"}], "shortcutRomPathDetected": True}
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash",
      ) as native:
        result = ra_hash.load_steam_shortcut_rom_hash("123", 7)
      self.assertEqual(result["hashResolverSkippedReason"], "archive-ambiguous")
      native.assert_not_called()

  def test_oversize_archive_member_is_rejected_before_extraction(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      archive_path = Path(temp_dir) / "oversize.zip"
      with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("game.nes", b"fixture")
      with patch.object(ra_hash, "_MAX_ARCHIVE_MEMBER_BYTES", 4), patch.object(ra_hash, "_native_hash") as native:
        result = ra_hash._hash_candidate(archive_path, 7, helper_path=Path("helper"), deadline=ra_hash.time.monotonic() + 10)
      self.assertEqual(result[:2], ("skipped", "archive-member-too-large"))
      native.assert_not_called()

  def test_gdi_descriptor_hash_is_not_cached_when_tracks_can_change(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      descriptor = Path(temp_dir) / "disc.gdi"
      descriptor.write_text("track metadata", encoding="utf-8")
      discovery = {"appId": "123", "romPath": descriptor, "shortcutRomPathDetected": True}
      with patch.object(ra_hash, "load_steam_shortcut_rom_path", return_value=discovery), patch.object(
        ra_hash, "_native_hash", return_value=("resolved", VALID_HASH),
      ) as native:
        ra_hash.load_steam_shortcut_rom_hash("123", 40)
        ra_hash.load_steam_shortcut_rom_hash("123", 40)
      self.assertEqual(native.call_count, 2)


if __name__ == "__main__":
  unittest.main()
