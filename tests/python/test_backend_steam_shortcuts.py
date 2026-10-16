from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import _test_support  # noqa: F401
from backend.steam_shortcuts import (
  load_steam_shortcut_metadata,
  load_steam_shortcut_rom_path,
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

  def test_nds_discovery_is_independent_of_shortcut_title(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Plants vs Zombies.nds"
      rom_path.write_bytes(b"synthetic fixture")
      paths = []
      for title in ("Plants vs. Zombies", "Plants vs. Zombies DLC", "PvZ DS", "My Zombie Game"):
        shortcuts_path = Path(temp_dir) / f"{len(paths)}.vdf"
        shortcuts_path.write_bytes(_build_shortcuts_vdf_with_command_fields(
          app_name=title, launch_options=f'"{rom_path}"', tag="Nintendo DS",
        ))
        paths.append(shortcuts_path)
      for shortcuts_path in paths:
        discovery = load_steam_shortcut_rom_path("2493414760", shortcuts_files=[shortcuts_path])
        self.assertEqual(discovery["romPath"], rom_path.resolve())

  def test_metadata_survives_conflicting_display_names_and_missing_name(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      first = root / "first.vdf"
      second = root / "second.vdf"
      first.write_bytes(_build_shortcuts_vdf_with_command_fields(app_name="Original Name", tag="Nintendo Game Boy Advance"))
      second.write_bytes(_build_shortcuts_vdf_with_command_fields(app_name="Renamed Shortcut", tag="Nintendo Game Boy Advance"))
      metadata = load_steam_shortcut_metadata("2493414760", shortcuts_files=[first, second])
      self.assertIsNotNone(metadata)
      self.assertEqual(metadata["platformTag"], "Nintendo Game Boy Advance")
      self.assertEqual(metadata["title"], "Original Name")
      unnamed = root / "unnamed.vdf"
      unnamed.write_bytes(_build_shortcuts_vdf_with_command_fields(app_name="", tag="Nintendo Game Boy Advance"))
      self.assertEqual(load_steam_shortcut_metadata("2493414760", shortcuts_files=[unnamed])["platformTag"], "Nintendo Game Boy Advance")

  def test_disc_and_archive_paths_are_discovered_without_hashing(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      for suffix in (".iso", ".gcm", ".cue", ".gdi", ".m3u", ".zip", ".7z", ".chd", ".pbp", ".cso", ".zso", ".rvz", ".wia", ".gcz", ".ciso", ".wbfs", ".wad"):
        rom_path = Path(temp_dir) / f"game{suffix}"
        rom_path.write_bytes(b"synthetic fixture")
        shortcut_path = Path(temp_dir) / "shortcuts.vdf"
        shortcut_path.write_bytes(_build_shortcuts_vdf_with_launch_options(f'"{rom_path}"'))
        discovery = load_steam_shortcut_rom_path("2493414760", shortcuts_files=[shortcut_path])
        self.assertEqual(discovery["romPath"], rom_path.resolve())

  def test_multiple_rom_paths_are_ambiguous(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      first = Path(temp_dir) / "first.nds"
      second = Path(temp_dir) / "second.nds"
      first.write_bytes(b"first")
      second.write_bytes(b"second")
      shortcut_path = Path(temp_dir) / "shortcuts.vdf"
      shortcut_path.write_bytes(_build_shortcuts_vdf_with_launch_options(f'"{first}" "{second}"'))
      discovery = load_steam_shortcut_rom_path("2493414760", shortcuts_files=[shortcut_path])
      self.assertIsNone(discovery["romPath"])
      self.assertNotIn("reason", discovery)
      self.assertEqual(discovery["candidateCount"], 2)

  def test_unknown_extension_and_unicode_quoted_path_are_discovered(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      rom_path = Path(temp_dir) / "Tétris custom.cart"
      rom_path.write_bytes(b"fixture")
      shortcut_path = Path(temp_dir) / "shortcuts.vdf"
      shortcut_path.write_bytes(_build_shortcuts_vdf_with_command_fields(
        launch_options=f'--game="{rom_path}"', tag="Nintendo Entertainment System",
      ))
      discovery = load_steam_shortcut_rom_path("2493414760", shortcuts_files=[shortcut_path])
      self.assertEqual(discovery["romPath"], rom_path.resolve())
      self.assertEqual(discovery["romCandidates"][0]["extension"], ".cart")

  def test_relative_path_uses_quoted_start_dir_and_rejects_core(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      rom_path = root / "game with spaces.a26"
      core_path = root / "core.so"
      rom_path.write_bytes(b"fixture")
      core_path.write_bytes(b"core")
      shortcut_path = root / "shortcuts.vdf"
      shortcut_path.write_bytes(_build_shortcuts_vdf_with_command_fields(
        exe='"/usr/bin/retroarch"', launch_options='-L core.so "game with spaces.a26"', start_dir=f'"{root}"',
      ))
      discovery = load_steam_shortcut_rom_path("2493414760", shortcuts_files=[shortcut_path])
      self.assertEqual(discovery["romPath"], rom_path.resolve())
      self.assertIn("non-game-argument", [item["reason"] for item in discovery["candidateRejections"]])

  def test_executable_config_and_bios_are_not_game_candidates(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      launcher = root / "retroarch.sh"
      config = root / "settings.cfg"
      bios = root / "bios" / "firmware.bin"
      bios.parent.mkdir()
      rom = root / "game.hex"
      for path in (launcher, config, bios, rom):
        path.write_bytes(b"fixture")
      shortcut_path = root / "shortcuts.vdf"
      shortcut_path.write_bytes(_build_shortcuts_vdf_with_command_fields(
        exe=f'"{launcher}"', launch_options=f'"{config}" "{bios}" "{rom}"',
      ))
      discovery = load_steam_shortcut_rom_path("2493414760", shortcuts_files=[shortcut_path])
      self.assertEqual(discovery["romPath"], rom.resolve())
      self.assertEqual(discovery["candidateCount"], 1)

  def test_missing_rom_is_reported(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      shortcut_path = Path(temp_dir) / "shortcuts.vdf"
      shortcut_path.write_bytes(_build_shortcuts_vdf_with_launch_options(f'"{Path(temp_dir) / "missing.nds"}"'))
      discovery = load_steam_shortcut_rom_path("2493414760", shortcuts_files=[shortcut_path])
      self.assertIsNone(discovery["romPath"])
      self.assertEqual(discovery["reason"], "rom-file-unreadable")


if __name__ == "__main__":
  unittest.main()
