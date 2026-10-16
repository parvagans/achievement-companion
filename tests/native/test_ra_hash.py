"""Smoke test for the packaged Linux hashing helper using synthetic ROM data."""

from __future__ import annotations

import hashlib
import gzip
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from generate_chd_fixtures import make_ps2_iso
from generate_compressed_iso_fixtures import make_compressed_iso, make_psp_iso
from generate_nintendo_disc_fixtures import make_gamecube, make_wii


helper = Path(sys.argv[1]).resolve()


def invoke(console_id: int, path: Path) -> dict[str, object]:
  result = subprocess.run([str(helper), str(console_id), str(path)], capture_output=True, text=True, timeout=15)
  response = json.loads(result.stdout)
  if response["status"] == "error":
    assert result.returncode != 0, response
  else:
    assert result.returncode == 0, response
  return response


with tempfile.TemporaryDirectory() as directory:
  root = Path(directory)
  nes_payload = bytes((index * 29) % 256 for index in range(16 * 1024))
  nes = root / "Synthetic NES.nes"
  nes.write_bytes(b"NES\x1a" + bytes(12) + nes_payload)
  nes_result = invoke(7, nes)
  assert nes_result["status"] == "resolved", nes_result
  assert nes_result["hash"] == hashlib.md5(nes_payload).hexdigest(), nes_result

  ps2 = root / "Synthetic PS2.iso"
  make_ps2_iso(ps2)
  ps2_hash = invoke(21, ps2)
  assert ps2_hash["status"] == "resolved", ps2_hash
  compressed = Path(__file__).resolve().parent / "fixtures"
  for fixture_name in ("synthetic-ps2-cd.chd", "synthetic-ps2-dvd.chd"):
    fixture = compressed / fixture_name
    chd_hash = invoke(21, fixture)
    assert chd_hash["status"] == "resolved", (fixture_name, chd_hash)
    assert chd_hash["hash"] == ps2_hash["hash"], (fixture_name, ps2_hash, chd_hash)
    assert chd_hash["mediaReader"] == "chd", chd_hash

  renamed_chd = root / "Synthetic PS2 container.unknown"
  renamed_chd.write_bytes((compressed / "synthetic-ps2-cd.chd").read_bytes())
  assert invoke(21, renamed_chd)["hash"] == ps2_hash["hash"], "CHD probing must not depend on file suffix"

  large_ps2 = root / "Synthetic large PS2.iso"
  make_ps2_iso(large_ps2, sparse_size=4 * 1024 * 1024 * 1024 + 64 * 2048)
  assert invoke(21, large_ps2)["hash"] == ps2_hash["hash"], "large PS2 image must have no file-size cutoff"

  image = bytearray((index * 17) % 256 for index in range(1024 * 1024))
  image[0x20:0x24] = (0x1000).to_bytes(4, "little")
  image[0x2C:0x30] = (0x100).to_bytes(4, "little")
  image[0x30:0x34] = (0x2000).to_bytes(4, "little")
  image[0x3C:0x40] = (0x100).to_bytes(4, "little")
  image[0x68:0x6C] = (0x3000).to_bytes(4, "little")
  nds = root / "Synthetic DS.nds"
  nds.write_bytes(image)
  response = invoke(18, nds)
  assert response["status"] == "resolved", response
  assert response["consoleId"] == 18, response
  assert response["method"] == "rcheevos", response
  assert response["hash"] != hashlib.md5(image).hexdigest(), "NDS must use platform-specific hashing"

  duplicate = root / "Renamed shortcut.nds"
  duplicate.write_bytes(image)
  assert invoke(18, duplicate)["hash"] == response["hash"]

  unknown_suffix = root / "Unlisted format.cci"
  unknown_suffix.write_bytes(image)
  assert invoke(18, unknown_suffix)["hash"] == response["hash"], "helper must not gate by a local extension list"

  # These cartridge families use the ROM's full-file MD5. This is a test
  # oracle only; production identification still goes through rcheevos.
  for console_id, suffix in ((5, ".gba"), (6, ".gbc"), (1, ".md")):
    payload = bytes((index * (console_id + 11)) % 256 for index in range(128 * 1024))
    direct = root / f"Synthetic cartridge {console_id}{suffix}"
    direct.write_bytes(payload)
    hashed = invoke(console_id, direct)
    assert hashed["status"] == "resolved", (console_id, hashed)
    assert hashed["hash"] == hashlib.md5(payload).hexdigest(), (console_id, hashed)

  empty = root / "empty.nds"
  empty.write_bytes(b"")
  assert invoke(18, empty) == {"status": "unavailable", "reason": "invalid-file", "mediaReader": "direct", "mediaReaderStatus": "invalid"}

  unsupported = root / "disc.chd"
  unsupported.write_bytes(b"not a CHD")
  assert invoke(21, unsupported) == {"status": "unavailable", "reason": "container-reader-invalid", "mediaReader": "chd", "mediaReaderStatus": "invalid"}
  archive = root / "archive.zip"
  archive.write_bytes(b"not a ZIP")
  assert invoke(18, archive) == {"status": "unavailable", "reason": "unsupported-archive-console", "mediaReader": "archive", "mediaReaderStatus": "not-implemented"}
  for suffix in (".rar",):
    unsupported_path = root / f"unsupported{suffix}"
    unsupported_path.write_bytes(b"synthetic fixture")
    assert invoke(18, unsupported_path) == {
      "status": "unavailable", "reason": "container-reader-not-implemented",
      "mediaReader": "rar", "mediaReaderStatus": "not-implemented",
    }
  empty_playlist = root / "empty.m3u"
  empty_playlist.write_text("#EXTM3U\n\n", encoding="utf-8")
  assert invoke(21, empty_playlist) == {
    "status": "unavailable", "reason": "playlist-invalid",
    "mediaReader": "playlist", "mediaReaderStatus": "invalid",
  }
  missing_playlist = root / "missing.m3u"
  missing_playlist.write_text("missing.iso\n", encoding="utf-8")
  assert invoke(21, missing_playlist) == {
    "status": "error", "reason": "rom-unreadable",
    "mediaReader": "playlist", "mediaReaderStatus": "unreadable",
  }
  playlist_rar = root / "playlist.rar"
  playlist_rar.write_bytes(b"synthetic fixture")
  unsupported_playlist = root / "unsupported.m3u"
  unsupported_playlist.write_text("playlist.rar\n", encoding="utf-8")
  assert invoke(21, unsupported_playlist) == {
    "status": "unavailable", "reason": "container-reader-not-implemented",
    "mediaReader": "playlist", "mediaReaderStatus": "not-implemented",
  }
  assert invoke(18, root / "missing.nds") == {"status": "error", "reason": "rom-unreadable", "mediaReader": "direct", "mediaReaderStatus": "unreadable"}

  expected_raw_hashes = {
    "gc": "a52044325b45b9690b04ccaa876874af",
    "wii": "741e1d5e77c4fa126bc0dc8bb61d022d",
  }
  for label, console_id, make_image in (("gc", 16, make_gamecube), ("wii", 19, make_wii)):
    raw = root / f"synthetic-{label}.iso"
    make_image(raw)
    reference = invoke(console_id, raw)
    assert reference["status"] == "resolved", reference
    assert reference["hash"] == expected_raw_hashes[label], reference
    for format_name in ("rvz", "wia", "gcz"):
      container = compressed / f"synthetic-{label}.{format_name}"
      response = invoke(console_id, container)
      assert response["status"] == "resolved", (label, format_name, response)
      assert response["hash"] == reference["hash"], (label, format_name, reference, response)
      assert response["mediaReader"] == "nintendo-disc", response

    renamed = root / f"synthetic-{label}.unknown"
    renamed.write_bytes((compressed / f"synthetic-{label}.rvz").read_bytes())
    assert invoke(console_id, renamed)["hash"] == reference["hash"], "Reader probing must not depend on file suffix"

    playlist = root / f"synthetic-{label}.m3u"
    playlist.write_text(f"#EXTM3U\n{compressed / f'synthetic-{label}.rvz'}\n", encoding="utf-8")
    playlist_response = invoke(console_id, playlist)
    assert playlist_response["status"] == "resolved", playlist_response
    assert playlist_response["hash"] == reference["hash"], playlist_response
    assert playlist_response["mediaReader"] == "playlist", playlist_response

    for format_name in (("ciso",) if label == "gc" else ("ciso", "wbfs")):
      container = root / f"synthetic-{label}.{format_name}"
      with gzip.open(compressed / f"synthetic-{label}.{format_name}.gz", "rb") as source:
        container.write_bytes(source.read())
      response = invoke(console_id, container)
      assert response["status"] == "resolved", (label, format_name, response)
      assert response["hash"] == reference["hash"], (label, format_name, reference, response)

  encrypted_wii = root / "synthetic-wii-encrypted.iso"
  with gzip.open(compressed / "synthetic-wii-encrypted.iso.gz", "rb") as source:
    encrypted_wii.write_bytes(source.read())
  with encrypted_wii.open("rb") as source:
    source.seek(0x61)
    assert source.read(1) == b"\0", "fixture must exercise rcheevos' encrypted Wii branch"
  encrypted_reference = invoke(19, encrypted_wii)
  assert encrypted_reference["status"] == "resolved", encrypted_reference
  assert encrypted_reference["hash"] == "d031ee339c2c0d7d7f79fc91815781c5", encrypted_reference
  for format_name in ("rvz", "wia"):
    encrypted_container = compressed / f"synthetic-wii-encrypted.{format_name}"
    encrypted_response = invoke(19, encrypted_container)
    assert encrypted_response["status"] == "resolved", encrypted_response
    assert encrypted_response["hash"] == encrypted_reference["hash"], (format_name, encrypted_reference, encrypted_response)
    assert encrypted_response["mediaReader"] == "nintendo-disc", encrypted_response

  wad = bytearray(0x300)
  wad[4:8] = b"Is\0\0"
  wad[0x14:0x18] = (0x200).to_bytes(4, "big")
  wad[0x40 + 0x1DE:0x40 + 0x1E0] = (1).to_bytes(2, "big")
  wad[0x40 + 0x1E4 + 12:0x40 + 0x1E4 + 16] = (16).to_bytes(4, "big")
  wad[0x240:0x250] = b"AC WAD content!!"
  wad_path = root / "synthetic-wiiware.wad"
  wad_path.write_bytes(wad)
  wad_hash = invoke(19, wad_path)
  assert wad_hash["status"] == "resolved", wad_hash
  assert wad_hash["mediaReader"] == "direct", wad_hash

  invalid_rvz = root / "invalid.rvz"
  invalid_rvz.write_bytes(b"invalid RVZ")
  assert invoke(16, invalid_rvz) == {
    "status": "unavailable", "reason": "container-reader-invalid", "mediaReader": "nintendo-disc", "mediaReaderStatus": "invalid",
  }

  ps2_playlist = root / "Synthetic PS2.m3u"
  ps2_playlist.write_bytes(b"\xef\xbb\xbf#EXTM3U\r\n  \r\n\"Synthetic PS2.iso\"\r\nmissing.iso\r\n")
  ps2_playlist_hash = invoke(21, ps2_playlist)
  assert ps2_playlist_hash["status"] == "resolved", ps2_playlist_hash
  assert ps2_playlist_hash["hash"] == ps2_hash["hash"], ps2_playlist_hash
  assert ps2_playlist_hash["mediaReader"] == "playlist", ps2_playlist_hash

  ps2_chd_playlist = root / "Synthetic PS2 CHD.m3u"
  ps2_chd_playlist.write_text(f"{compressed / 'synthetic-ps2-cd.chd'}\n", encoding="utf-8")
  ps2_chd_playlist_hash = invoke(21, ps2_chd_playlist)
  assert ps2_chd_playlist_hash["hash"] == ps2_hash["hash"], ps2_chd_playlist_hash
  assert ps2_chd_playlist_hash["mediaReader"] == "playlist", ps2_chd_playlist_hash

  for suffix, zso in ((".cso", False), (".zso", True)):
    compressed_ps2 = root / f"Synthetic PS2{suffix}"
    make_compressed_iso(ps2, compressed_ps2, zso=zso, align=6 if zso else 4)
    compressed_ps2_response = invoke(21, compressed_ps2)
    assert compressed_ps2_response["status"] == "resolved", compressed_ps2_response
    assert compressed_ps2_response["hash"] == ps2_hash["hash"], compressed_ps2_response
    assert compressed_ps2_response["mediaReader"] == "compressed-iso", compressed_ps2_response

  psp_iso = root / "Synthetic PSP.iso"
  make_psp_iso(psp_iso)
  psp_reference = invoke(41, psp_iso)
  assert psp_reference["status"] == "resolved", psp_reference
  for suffix, zso in ((".cso", False), (".zso", True)):
    compressed_psp = root / f"Synthetic PSP{suffix}"
    make_compressed_iso(psp_iso, compressed_psp, zso=zso, align=6 if zso else 4)
    compressed_response = invoke(41, compressed_psp)
    assert compressed_response["status"] == "resolved", compressed_response
    assert compressed_response["hash"] == psp_reference["hash"], compressed_response
    assert compressed_response["mediaReader"] == "compressed-iso", compressed_response
    renamed_compressed = root / f"Synthetic PSP {suffix[1:]}.unknown"
    renamed_compressed.write_bytes(compressed_psp.read_bytes())
    assert invoke(41, renamed_compressed)["hash"] == psp_reference["hash"], "Compressed ISO probing must use content"

  invalid_cso = root / "invalid.cso"
  invalid_cso.write_bytes(b"CISO" + bytes(20))
  assert invoke(41, invalid_cso) == {
    "status": "unavailable", "reason": "container-reader-invalid",
    "mediaReader": "compressed-iso", "mediaReaderStatus": "invalid",
  }

print("Native rcheevos helper smoke tests passed.")
