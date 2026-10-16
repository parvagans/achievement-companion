"""Generate copyright-free CHD fixtures used by the native hash smoke test."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path


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


def generate(output_dir: Path) -> None:
  output_dir.mkdir(parents=True, exist_ok=True)
  with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    image = root / "synthetic-ps2.iso"
    cue = root / "synthetic-ps2.cue"
    make_ps2_iso(image)
    cue.write_text(
      'FILE "synthetic-ps2.iso" BINARY\n'
      '  TRACK 01 MODE1/2048\n'
      '    INDEX 01 00:00:00\n',
      encoding="ascii",
    )
    subprocess.run(
      ["chdman", "createcd", "-f", "-i", str(cue), "-o", str(output_dir / "synthetic-ps2-cd.chd")],
      check=True,
    )
    subprocess.run(
      [
        "chdman", "createraw", "-f", "-i", str(image),
        "-o", str(output_dir / "synthetic-ps2-dvd.chd"),
        "-hs", "32768", "-us", "2048", "-c", "none",
      ],
      check=True,
    )


if __name__ == "__main__":
  generate(Path(__file__).resolve().parent / "fixtures")
