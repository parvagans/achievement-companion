from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.steam_shortcuts import load_steam_shortcut_metadata, parse_steam_shortcuts_vdf


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


if __name__ == "__main__":
  unittest.main()
