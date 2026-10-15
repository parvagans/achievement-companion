"""Generate copyright-free raw disc images for container hash equivalence tests."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path


def _put32(image: bytearray, offset: int, value: int) -> None:
  image[offset:offset + 4] = value.to_bytes(4, "big")


def make_gamecube(path: Path) -> None:
  image = bytearray(2 * 1024 * 1024)
  image[:6] = b"GACT01"
  image[0x1C:0x20] = bytes.fromhex("c2339f3d")
  title = b"Achievement Companion Test"
  image[0x20:0x20 + len(title)] = title
  _put32(image, 0x420, 0x3000)
  _put32(image, 0x424, 0x5000)
  _put32(image, 0x428, 12)
  _put32(image, 0x42C, 12)
  image[0x2440:0x244A] = b"2026/10/14"
  _put32(image, 0x2454, 0)
  _put32(image, 0x2458, 0)
  _put32(image, 0x3000, 0x4000)
  _put32(image, 0x3090, 16)
  image[0x4000:0x4010] = b"AC synthetic DOL"
  image[0x5000:0x500C] = bytes.fromhex("010000000000000000000001")
  path.write_bytes(image)


def make_wii(path: Path) -> None:
  image = bytearray(4 * 1024 * 1024)
  image[:6] = b"RACY01"
  image[0x18:0x1C] = bytes.fromhex("5d1c9ea3")
  image[0x60] = 1  # No partition hash blocks in this synthetic disc.
  image[0x61] = 1  # Decrypted partition data.
  image[0x4E000:0x4E004] = b"USA\0"
  _put32(image, 0x40000, 1)
  _put32(image, 0x40004, 0x40020 // 4)
  _put32(image, 0x40020, 0x50000 // 4)
  _put32(image, 0x40024, 0)
  issuer = b"Root-CA00000001-XS00000003"
  image[0x50140:0x50140 + len(issuer)] = issuer
  _put32(image, 0x502A4, 0x1E4)
  _put32(image, 0x502A8, 0x400 // 4)
  _put32(image, 0x502B8, 0x20000 // 4)
  _put32(image, 0x502BC, 0x200000 // 4)
  image[0x50400:0x505E4] = b"Synthetic Wii TMD".ljust(0x1E4, b"\0")

  for base in (0x20000, 0x70000):
    image[base:base + 6] = b"RACY01"
    image[base + 0x18:base + 0x1C] = bytes.fromhex("5d1c9ea3")
    _put32(image, base + 0x420, 0x3000 // 4)
    _put32(image, base + 0x424, 0x5000 // 4)
    _put32(image, base + 0x428, 12 // 4)
    _put32(image, base + 0x42C, 12 // 4)
    image[base + 0x2440:base + 0x244A] = b"2026/10/14"
    _put32(image, base + 0x2454, 0)
    _put32(image, base + 0x2458, 0)
    _put32(image, base + 0x3000, 0x4000 // 4)
    _put32(image, base + 0x3090, 16 // 4)
    image[base + 0x4000:base + 0x4010] = b"AC Wii test DOL!"
    image[base + 0x5000:base + 0x500C] = bytes.fromhex("010000000000000000000001")
  path.write_bytes(image)


def make_wii_hashed(path: Path) -> None:
  """Create decrypted Wii sectors with canonical H0/H1/H2/H3 hash blocks."""
  make_wii(path)
  image = bytearray(path.read_bytes())
  logical_data = bytes(image[0x70000:0x70000 + 64 * 0x7C00])
  image[0x60] = 0  # Hash blocks are present.
  image[0x61] = 1  # The source partition is decrypted.
  _put32(image, 0x502B4, 0x8000 // 4)
  image[0x70000:0x270000] = bytes(0x200000)

  h1_hashes: list[bytes] = []
  for sector in range(64):
    physical = 0x70000 + sector * 0x8000
    payload = logical_data[sector * 0x7C00:(sector + 1) * 0x7C00]
    image[physical + 0x400:physical + 0x8000] = payload
    h0 = b"".join(hashlib.sha1(payload[index:index + 0x400]).digest() for index in range(0, 0x7C00, 0x400))
    image[physical:physical + 0x26C] = h0
    h1_hashes.append(hashlib.sha1(h0).digest())

  h2_hashes = [hashlib.sha1(b"".join(h1_hashes[index:index + 8])).digest() for index in range(0, 64, 8)]
  for sector in range(64):
    physical = 0x70000 + sector * 0x8000
    subgroup = sector & ~7
    image[physical + 0x280:physical + 0x320] = b"".join(h1_hashes[subgroup:subgroup + 8])
    image[physical + 0x340:physical + 0x3E0] = b"".join(h2_hashes)
  image[0x58000:0x58014] = hashlib.sha1(b"".join(h2_hashes)).digest()
  path.write_bytes(image)


if __name__ == "__main__":
  output = Path(sys.argv[1])
  output.mkdir(parents=True, exist_ok=True)
  make_gamecube(output / "synthetic-gc.iso")
  make_wii(output / "synthetic-wii.iso")
