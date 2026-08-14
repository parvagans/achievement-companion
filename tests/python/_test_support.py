from __future__ import annotations

import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
PY_MODULES_DIR = ROOT_DIR / "py_modules"
PY_MODULES_DIR_TEXT = str(PY_MODULES_DIR)
if PY_MODULES_DIR_TEXT not in sys.path:
  sys.path.insert(0, PY_MODULES_DIR_TEXT)
