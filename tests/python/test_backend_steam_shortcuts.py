from __future__ import annotations

import hashlib
import tempfile
import zipfile
import unittest
from pathlib import Path

import backend.steam_shortcuts as steam_shortcuts
from backend.steam_shortcuts import (
  load_steam_shortcut_metadata,
  load_steam_shortcut_rom_hash,
  parse_steam_shortcuts_vdf,
)


def _encode_c_string(value: str) -> bytes:
  return value.encode("utf-8") + b"\x00"


def _build_shortcuts_vdf() -> bytes:
  app_id = 2217040867
  return b"".join([
    bytes([0x00]),
    _encode_c_string("shortcuts"),
    bytes([0x00]),
    _encode_c_string("0"),
    bytes([0x02]),
    _encode_c_string("appid"),
    app_id.to_bytes(4, "little", signed=False),
    bytes([0x01]),
    _encode_c_string("appname"),
    _encode_c_string("StarCraft 64"),
    bytes([0x01]),
    _encode_c_string("exe"),
    _encode_c_string('"/usr/bin/retroarch"'),
    bytes([0x01]),
    _encode_c_string("StartDir"),
    _encode_c_string("/home/deck/Emulation/tools"),
    bytes([0x01]),
    _encode_c_string("LaunchOptions"),
    _encode_c_string('"/home/deck/Emulation/roms/n64/StarCraft 64.z64"'),
    bytes([0x00]),
    _encode_c_string("tags"),
    bytes([0x01]),
    _encode_c_string("0"),
    _encode_c_string("Sony Nintendo 64"),
    bytes([0x08]),
    bytes([0x08]),
    bytes([0x08]),
  ])


def _build_uppercase_shortcuts_vdf() -> bytes:
  app_id = 2874315920
  return b"".join([
    bytes([0x00]),
    _encode_c_string("shortcuts"),
    bytes([0x00]),
    _encode_c_string("0"),
    bytes([0x02]),
    _encode_c_string("appid"),
    app_id.to_bytes(4, "little", signed=False),
    bytes([0x01]),
    _encode_c_string("AppName"),
    _encode_c_string("Final Fantasy X International"),
    bytes([0x01]),
    _encode_c_string("Exe"),
    _encode_c_string('"/usr/bin/pcsx2"'),
    bytes([0x01]),
    _encode_c_string("StartDir"),
    _encode_c_string("/home/deck/Emulation/roms/ps2"),
    bytes([0x00]),
    _encode_c_string("tags"),
    bytes([0x01]),
    _encode_c_string("0"),
    _encode_c_string("Sony PlayStation 2"),
    bytes([0x08]),
    bytes([0x08]),
    bytes([0x08]),
  ])


def _build_shortcuts_vdf_with_command_fields(
  *,
  app_id: int = 2493414760,
  app_name: str = "Pyoro64",
  exe: str = '"/usr/bin/retroarch"',
  launch_options: str | None = None,
  start_dir: str = "/home/deck/Emulation/roms/n64",
  tag: str = "Nintendo 64",
) -> bytes:
  parts = [
    bytes([0x00]),
    _encode_c_string("shortcuts"),
    bytes([0x00]),
    _encode_c_string("0"),
    bytes([0x02]),
    _encode_c_string("appid"),
    app_id.to_bytes(4, "little", signed=False),
    bytes([0x01]),
    _encode_c_string("appname"),
    _encode_c_string(app_name),
    bytes([0x01]),
    _encode_c_string("exe"),
    _encode_c_string(exe),
    bytes([0x01]),
    _encode_c_string("StartDir"),
    _encode_c_string(start_dir),
    bytes([0x00]),
    _encode_c_string("tags"),
    bytes([0x01]),
    _encode_c_string("0"),
    _encode_c_string(tag),
    bytes([0x08]),
    bytes([0x08]),
    bytes([0x08]),
  ]
  if launch_options is not None:
    parts[16:16] = [
      bytes([0x01]),
      _encode_c_string("LaunchOptions"),
      _encode_c_string(launch_options),
    ]
  return b"".join(parts)


def _build_shortcuts_vdf_with_launch_options(launch_options: str) -> bytes:
  return _build_shortcuts_vdf_with_command_fields(launch_options=launch_options)


def _build_shortcuts_vdf_with_exe(exe: str, *, launch_options: str | None = None) -> bytes:
  return _build_shortcuts_vdf_with_command_fields(exe=exe, launch_options=launch_options)


def _write_zip_entries(zip_path: Path, entries: dict[str, bytes]) -> None:
  with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
    for entry_name, entry_bytes in entries.items():
      archive.writestr(entry_name, entry_bytes)


class SteamShortcutsTests(unittest.TestCase):
  def test_parse_steam_shortcuts_vdf_reads_unsigned_shortcut_app_ids(self) -> None:
    shortcuts = parse_steam_shortcuts_vdf(_build_shortcuts_vdf())

    self.assertEqual(shortcuts["0"]["appid"], 2217040867)
    self.assertEqual(shortcuts["0"]["appname"], "StarCraft 64")
    self.assertEqual(shortcuts["0"]["tags"]["0"], "Sony Nintendo 64")

  def test_load_steam_shortcut_metadata_returns_platform_and_path_metadata_for_matching_app_id(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(_build_uppercase_shortcuts_vdf())

      metadata = load_steam_shortcut_metadata("2874315920", shortcuts_files=[shortcuts_path])

      self.assertEqual(metadata, {
        "appId": "2874315920",
        "title": "Final Fantasy X International",
        "platformTag": "Sony PlayStation 2",
        "platformLabel": "Sony PlayStation 2",
        "tags": ["Sony PlayStation 2"],
        "exe": '"/usr/bin/pcsx2"',
        "startDir": "/home/deck/Emulation/roms/ps2",
      })

  def test_load_steam_shortcut_metadata_handles_lowercase_metadata_fields(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(_build_shortcuts_vdf())

      metadata = load_steam_shortcut_metadata("2217040867", shortcuts_files=[shortcuts_path])

      self.assertEqual(metadata, {
        "appId": "2217040867",
        "title": "StarCraft 64",
        "platformTag": "Sony Nintendo 64",
        "platformLabel": "Sony Nintendo 64",
        "tags": ["Sony Nintendo 64"],
        "exe": '"/usr/bin/retroarch"',
        "startDir": "/home/deck/Emulation/tools",
      })

  def test_load_steam_shortcut_rom_hash_hashes_launch_options_path_with_md5(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Pyoro 64.z64"
      rom_bytes = b"pyoro-64-test-rom"
      rom_path.write_bytes(rom_bytes)

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{rom_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_hashes_small_sfc_files(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Supercooked!.sfc"
      rom_bytes = b"sfc-test-rom"
      rom_path.write_bytes(rom_bytes)

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{rom_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_hashes_small_smc_files(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Supercooked!.smc"
      rom_bytes = b"smc-test-rom"
      rom_path.write_bytes(rom_bytes)

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{rom_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_hashes_exe_rom_path_when_launch_options_are_empty(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Pyoro64 NTSC.n64"
      rom_bytes = b"pyoro-64-ntsc-test-rom"
      rom_path.write_bytes(rom_bytes)

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_exe(
          f'"/run/media/deck/FF4Y7/Emulation/tools/launchers/retroarch.sh" -L /mupen64plus_next_libretro.so "{rom_path}"',
        ),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "exe",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_reports_unsupported_extensions_as_skipped(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Supercooked!.xyz"
      rom_path.write_bytes(b"unsupported-extension-test")

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{rom_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(metadata["appId"], "2493414760")
      self.assertEqual(metadata["romHashStatus"], "skipped")
      self.assertIsInstance(metadata.get("hashResolverSkippedReason"), str)
      self.assertNotEqual(metadata.get("hashResolverSkippedReason"), "")

  def test_load_steam_shortcut_rom_hash_hashes_single_sfc_zip_entries(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      zip_path = Path(temp_dir) / "Supercooked!.zip"
      rom_bytes = b"zip-sfc-test-rom"
      _write_zip_entries(zip_path, {"Supercooked!.sfc": rom_bytes})

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{zip_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_hashes_single_smc_zip_entries(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      zip_path = Path(temp_dir) / "Supercooked!.zip"
      rom_bytes = b"zip-smc-test-rom"
      _write_zip_entries(zip_path, {"Supercooked!.smc": rom_bytes})

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{zip_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_skips_zip_with_multiple_supported_rom_entries(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      zip_path = Path(temp_dir) / "Supercooked!.zip"
      _write_zip_entries(
        zip_path,
        {
          "Supercooked!.sfc": b"zip-sfc-test-rom",
          "Another Game.smc": b"zip-smc-test-rom",
        },
      )

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{zip_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(metadata["appId"], "2493414760")
      self.assertEqual(metadata["shortcutRomPathDetected"], True)
      self.assertEqual(metadata["shortcutRomPathSource"], "launchoptions")
      self.assertEqual(metadata["romHashAttempted"], True)
      self.assertEqual(metadata["romHashStatus"], "skipped")
      self.assertEqual(metadata["hashResolverSkippedReason"], "rom-path-ambiguous-container")

  def test_load_steam_shortcut_rom_hash_skips_zip_without_supported_rom_entries(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      zip_path = Path(temp_dir) / "Supercooked!.zip"
      _write_zip_entries(
        zip_path,
        {
          "README.txt": b"no-rom-entry-here",
          "docs/manual.md": b"still-no-rom-entry",
        },
      )

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{zip_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(metadata["appId"], "2493414760")
      self.assertEqual(metadata["shortcutRomPathDetected"], True)
      self.assertEqual(metadata["shortcutRomPathSource"], "launchoptions")
      self.assertEqual(metadata["romHashAttempted"], True)
      self.assertEqual(metadata["romHashStatus"], "skipped")
      self.assertEqual(metadata["hashResolverSkippedReason"], "zip-no-supported-rom")

  def test_load_steam_shortcut_rom_hash_skips_oversized_zip_rom_entries_before_hashing(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      zip_path = Path(temp_dir) / "Supercooked!.zip"
      rom_bytes = b"zip-large-rom-test"
      _write_zip_entries(zip_path, {"Supercooked!.sfc": rom_bytes})

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{zip_path}"'),
      )

      original_limit = steam_shortcuts.STEAM_SHORTCUT_ROM_HASH_MAX_BYTES
      steam_shortcuts.STEAM_SHORTCUT_ROM_HASH_MAX_BYTES = 4
      try:
        metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])
      finally:
        steam_shortcuts.STEAM_SHORTCUT_ROM_HASH_MAX_BYTES = original_limit

      self.assertEqual(metadata["appId"], "2493414760")
      self.assertEqual(metadata["shortcutRomPathDetected"], True)
      self.assertEqual(metadata["shortcutRomPathSource"], "launchoptions")
      self.assertEqual(metadata["romHashAttempted"], True)
      self.assertEqual(metadata["romHashStatus"], "skipped")
      self.assertEqual(metadata["hashResolverSkippedReason"], "rom-file-too-large")

  def test_load_steam_shortcut_rom_hash_prefers_launch_options_over_exe_paths(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      launch_rom_path = Path(temp_dir) / "LaunchOptions First.z64"
      exe_rom_path = Path(temp_dir) / "Exe Second.n64"
      launch_rom_bytes = b"launch-options-rom"
      exe_rom_bytes = b"exe-rom"
      launch_rom_path.write_bytes(launch_rom_bytes)
      exe_rom_path.write_bytes(exe_rom_bytes)

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_exe(
          f'"/run/media/deck/FF4Y7/Emulation/tools/launchers/retroarch.sh" -L /mupen64plus_next_libretro.so "{exe_rom_path}"',
          launch_options=f'"{launch_rom_path}"',
        ),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(launch_rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_ignores_launcher_and_core_files_without_rom_path(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_exe(
          '"/run/media/deck/FF4Y7/Emulation/tools/launchers/retroarch.sh" -L /mupen64plus_next_libretro.so',
        ),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": False,
          "romHashAttempted": False,
          "romHashStatus": "skipped",
          "hashResolverSkippedReason": "rom-path-unavailable",
        },
      )

  def test_load_steam_shortcut_rom_hash_skips_ambiguous_container_paths(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_exe('"/run/media/deck/FF4Y7/Emulation/tools/launchers/retroarch.sh" -L /mupen64plus_next_libretro.so "/home/deck/Emulation/roms/n64/Pyoro 64.cue"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "exe",
          "romHashAttempted": False,
          "romHashStatus": "skipped",
          "hashResolverSkippedReason": "rom-path-ambiguous-container",
        },
      )

  def test_load_steam_shortcut_rom_hash_skips_unsupported_archive_formats_as_ambiguous(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_exe('"/run/media/deck/FF4Y7/Emulation/tools/launchers/retroarch.sh" -L /mupen64plus_next_libretro.so "/home/deck/Emulation/roms/n64/Pyoro 64.7z"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "exe",
          "romHashAttempted": False,
          "romHashStatus": "skipped",
          "hashResolverSkippedReason": "rom-path-ambiguous-container",
        },
      )

  def test_load_steam_shortcut_rom_hash_skips_large_rom_files_before_hashing(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Large PS2 Disc.iso"
      rom_path.write_bytes(b"too-large-test")

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{rom_path}"'),
      )

      original_limit = steam_shortcuts.STEAM_SHORTCUT_ROM_HASH_MAX_BYTES
      steam_shortcuts.STEAM_SHORTCUT_ROM_HASH_MAX_BYTES = 4
      try:
        metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])
      finally:
        steam_shortcuts.STEAM_SHORTCUT_ROM_HASH_MAX_BYTES = original_limit

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": False,
          "romHashStatus": "skipped",
          "hashResolverSkippedReason": "rom-file-too-large",
        },
      )

  def test_load_steam_shortcut_rom_hash_hashes_small_pbp_files(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Minicraft PSP.PBP"
      rom_bytes = b"pbp-test-rom"
      rom_path.write_bytes(rom_bytes)

      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options(f'"{rom_path}"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "resolved",
          "romHashAlgorithm": "md5",
          "romHash": hashlib.md5(rom_bytes).hexdigest(),
        },
      )

  def test_load_steam_shortcut_rom_hash_reports_missing_launch_options_as_unavailable(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(_build_uppercase_shortcuts_vdf())

      metadata = load_steam_shortcut_rom_hash("2874315920", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2874315920",
          "shortcutRomPathDetected": False,
          "romHashAttempted": False,
          "romHashStatus": "skipped",
          "hashResolverSkippedReason": "rom-path-unavailable",
        },
      )

  def test_load_steam_shortcut_rom_hash_reports_unreadable_rom_files_as_skipped(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcuts_path = Path(temp_dir) / "shortcuts.vdf"
      shortcuts_path.write_bytes(
        _build_shortcuts_vdf_with_launch_options('"/home/deck/Emulation/roms/n64/Missing Pyoro 64.z64"'),
      )

      metadata = load_steam_shortcut_rom_hash("2493414760", shortcuts_files=[shortcuts_path])

      self.assertEqual(
        metadata,
        {
          "appId": "2493414760",
          "shortcutRomPathDetected": True,
          "shortcutRomPathSource": "launchoptions",
          "romHashAttempted": True,
          "romHashStatus": "skipped",
          "hashResolverSkippedReason": "rom-file-unreadable",
        },
      )


if __name__ == "__main__":
  unittest.main()
