from __future__ import annotations

import shutil
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"


def main() -> int:
  if DIST_DIR.exists():
    shutil.rmtree(DIST_DIR)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
