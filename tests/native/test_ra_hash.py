"""Smoke test for the packaged Linux hashing helper using synthetic ROM data."""

from __future__ import annotations

import hashlib
import gzip
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from generate_nintendo_disc_fixtures import make_gamecube, make_wii


helper = Path(sys.argv[1]).resolve()


def make_ps2_iso(path: Path, *, sparse_size: int | None = None) -> None:
  """Write a minimal, copyright-free ISO9660 PS2 boot layout."""
  sector_size = 2048
  image = bytearray(64 * sector_size)
  system_cnf = b"BOOT2 = cdrom0:\\SLUS_123.45;1\nVER = 1.00\n"
  boot_elf = b"\x7fELF" + bytes((index * 13) % 256 for index in range(4092))

  def record(extent: int, length: int, name: bytes, flags: int = 0) -> bytes:
    size = 33 + len(name) + (0 if len(name) & 1 else 1)
    entry = bytearray(size)
    entry[0] = size
    entry[2:6] = extent.to_bytes(4, "little")
    entry[6:10] = extent.to_bytes(4, "big")
    entry[10:14] = length.to_bytes(4, "little")
    entry[14:18] = length.to_bytes(4, "big")
    entry[25] = flags
    entry[28:30] = (1).to_bytes(2, "little")
    entry[30:32] = (1).to_bytes(2, "big")
    entry[32] = len(name)
    entry[33:33 + len(name)] = name
    return bytes(entry)

  pvd = 16 * sector_size
  image[pvd] = 1
  image[pvd + 1:pvd + 6] = b"CD001"
  image[pvd + 6] = 1
  image[pvd + 80:pvd + 84] = (64).to_bytes(4, "little")
  image[pvd + 84:pvd + 88] = (64).to_bytes(4, "big")
  image[pvd + 128:pvd + 130] = sector_size.to_bytes(2, "little")
  image[pvd + 130:pvd + 132] = sector_size.to_bytes(2, "big")
  image[pvd + 156:pvd + 190] = record(20, sector_size, b"\0", 2)
  image[17 * sector_size:17 * sector_size + 7] = b"\xffCD001\x01"
  directory = b"".join((
    record(20, sector_size, b"\0", 2),
    record(20, sector_size, b"\1", 2),
    record(21, len(system_cnf), b"SYSTEM.CNF;1"),
    record(22, len(boot_elf), b"SLUS_123.45;1"),
  ))
  image[20 * sector_size:20 * sector_size + len(directory)] = directory
  image[21 * sector_size:21 * sector_size + len(system_cnf)] = system_cnf
  image[22 * sector_size:22 * sector_size + len(boot_elf)] = boot_elf
  path.write_bytes(image)
  if sparse_size is not None:
    with path.open("r+b") as output:
      output.truncate(sparse_size)


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
  assert invoke(21, unsupported) == {"status": "unavailable", "reason": "chd-reader-not-implemented", "mediaReader": "chd", "mediaReaderStatus": "not-implemented"}
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

  compressed = Path(__file__).resolve().parent / "fixtures"
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
