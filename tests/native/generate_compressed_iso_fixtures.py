"""Generate copyright-free PSP ISO and CISO/ZISO regression images."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


SECTOR_SIZE = 2048


def _directory_record(extent: int, length: int, name: bytes, flags: int = 0) -> bytes:
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


def make_psp_iso(path: Path) -> None:
  """Write the two-file ISO9660 layout used by the rcheevos PSP hash."""
  sector_count = 64
  image = bytearray(sector_count * SECTOR_SIZE)
  param_sfo = b"\0PSF" + bytes((index * 7 + 3) % 256 for index in range(508))
  eboot = b"~PSP" + bytes((index * 19 + 5) % 256 for index in range(4092))

  pvd = 16 * SECTOR_SIZE
  image[pvd] = 1
  image[pvd + 1:pvd + 6] = b"CD001"
  image[pvd + 6] = 1
  image[pvd + 80:pvd + 84] = sector_count.to_bytes(4, "little")
  image[pvd + 84:pvd + 88] = sector_count.to_bytes(4, "big")
  image[pvd + 128:pvd + 130] = SECTOR_SIZE.to_bytes(2, "little")
  image[pvd + 130:pvd + 132] = SECTOR_SIZE.to_bytes(2, "big")
  image[pvd + 156:pvd + 190] = _directory_record(20, SECTOR_SIZE, b"\0", 2)
  image[17 * SECTOR_SIZE:17 * SECTOR_SIZE + 7] = b"\xffCD001\x01"

  root = b"".join((
    _directory_record(20, SECTOR_SIZE, b"\0", 2),
    _directory_record(20, SECTOR_SIZE, b"\1", 2),
    _directory_record(21, SECTOR_SIZE, b"PSP_GAME", 2),
  ))
  psp_game = b"".join((
    _directory_record(21, SECTOR_SIZE, b"\0", 2),
    _directory_record(20, SECTOR_SIZE, b"\1", 2),
    _directory_record(22, len(param_sfo), b"PARAM.SFO;1"),
    _directory_record(23, SECTOR_SIZE, b"SYSDIR", 2),
  ))
  sysdir = b"".join((
    _directory_record(23, SECTOR_SIZE, b"\0", 2),
    _directory_record(21, SECTOR_SIZE, b"\1", 2),
    _directory_record(24, len(eboot), b"EBOOT.BIN;1"),
  ))
  image[20 * SECTOR_SIZE:20 * SECTOR_SIZE + len(root)] = root
  image[21 * SECTOR_SIZE:21 * SECTOR_SIZE + len(psp_game)] = psp_game
  image[22 * SECTOR_SIZE:22 * SECTOR_SIZE + len(param_sfo)] = param_sfo
  image[23 * SECTOR_SIZE:23 * SECTOR_SIZE + len(sysdir)] = sysdir
  image[24 * SECTOR_SIZE:24 * SECTOR_SIZE + len(eboot)] = eboot
  path.write_bytes(image)


def _deflate_raw(block: bytes) -> bytes:
  compressor = zlib.compressobj(level=9, wbits=-15)
  return compressor.compress(block) + compressor.flush()


def _lz4_literal_block(block: bytes) -> bytes:
  encoded = bytearray((0xF0,))
  remaining = len(block) - 15
  while remaining >= 255:
    encoded.append(255)
    remaining -= 255
  encoded.append(remaining)
  encoded.extend(block)
  return bytes(encoded)


def make_compressed_iso(source: Path, destination: Path, *, zso: bool = False, align: int = 0) -> None:
  payload = source.read_bytes()
  blocks = [payload[offset:offset + SECTOR_SIZE] for offset in range(0, len(payload), SECTOR_SIZE)]
  header_size = 24
  data_offset = header_size + (len(blocks) + 1) * 4
  indexes: list[int] = []
  encoded_blocks = bytearray()
  position = data_offset
  alignment = 1 << align
  for block in blocks:
    padding = (-position) % alignment
    encoded_blocks.extend(b"X" * padding)
    position += padding
    encoded = _lz4_literal_block(block) if zso else _deflate_raw(block)
    indexes.append(position >> align)
    if not zso and len(encoded) >= len(block):
      encoded = block
      indexes[-1] |= 0x80000000
    encoded_blocks.extend(encoded)
    position += len(encoded)
  padding = (-position) % alignment
  encoded_blocks.extend(b"X" * padding)
  position += padding
  indexes.append(position >> align)
  header = struct.pack("<4sIQIBB2x", b"ZISO" if zso else b"CISO", header_size, len(payload), SECTOR_SIZE, 1, align)
  destination.write_bytes(header + b"".join(struct.pack("<I", value) for value in indexes) + encoded_blocks)
