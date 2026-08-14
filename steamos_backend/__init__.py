from __future__ import annotations

import sys
from pathlib import Path


_REPO_ROOT = Path(__file__).resolve().parents[1]
_PY_MODULES_DIR = _REPO_ROOT / "py_modules"
_PY_MODULES_DIR_TEXT = str(_PY_MODULES_DIR)
if _PY_MODULES_DIR_TEXT not in sys.path:
  sys.path.insert(0, _PY_MODULES_DIR_TEXT)
