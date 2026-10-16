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
  for suffix in (".rar", ".m3u"):
    unsupported_path = root / f"unsupported{suffix}"
    unsupported_path.write_bytes(b"synthetic fixture")
    assert invoke(18, unsupported_path) == {
      "status": "unavailable", "reason": "container-reader-not-implemented",
      "mediaReader": "rar" if suffix == ".rar" else "playlist", "mediaReaderStatus": "not-implemented",
    }
  for suffix in (".cso", ".zso"):
    unsupported_path = root / f"unsupported{suffix}"
    unsupported_path.write_bytes(b"synthetic fixture")
    assert invoke(38, unsupported_path) == {
      "status": "unavailable", "reason": "compressed-iso-reader-not-implemented",
      "mediaReader": "compressed-iso", "mediaReaderStatus": "not-implemented",
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

print("Native rcheevos helper smoke tests passed.")
