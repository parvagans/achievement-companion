from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import types
import unittest
import uuid
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
MAIN_PATH = ROOT_DIR / "main.py"


class FakeDeckyLogger:
  def info(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    return

  def warning(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    return

  def error(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    return


def _path_entry_points_to_root(entry: str, cwd: Path) -> bool:
  if entry == "":
    return cwd.resolve() == ROOT_DIR

  try:
    return Path(entry).resolve() == ROOT_DIR
  except OSError:
    return False


class MainImportPathTests(unittest.TestCase):
  def test_main_bootstraps_plugin_dir_when_cwd_is_not_plugin_root(self) -> None:
    original_cwd = Path.cwd()
    original_sys_path = list(sys.path)
    original_decky = sys.modules.get("decky")
    original_backend_modules = {
      name: module
      for name, module in sys.modules.items()
      if name == "backend" or name.startswith("backend.")
    }
    module_name = f"achievement_companion_main_import_path_{uuid.uuid4().hex}"

    with tempfile.TemporaryDirectory() as settings_dir, tempfile.TemporaryDirectory() as other_cwd:
      decky_module = types.ModuleType("decky")
      decky_module.DECKY_PLUGIN_SETTINGS_DIR = settings_dir
      decky_module.logger = FakeDeckyLogger()

      try:
        os.chdir(other_cwd)
        sys.path = [
          entry
          for entry in original_sys_path
          if not _path_entry_points_to_root(entry, Path(other_cwd))
        ]

        for name in list(sys.modules):
          if name == "backend" or name.startswith("backend."):
            sys.modules.pop(name, None)
        sys.modules["decky"] = decky_module

        spec = importlib.util.spec_from_file_location(module_name, MAIN_PATH)
        if spec is None or spec.loader is None:
          self.fail("Unable to load main.py for import-path regression test.")

        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)

        self.assertEqual(module.SETTINGS_PATH, Path(settings_dir))
        self.assertEqual(module._PLUGIN_DIR, ROOT_DIR)  # type: ignore[attr-defined]
        self.assertIsNotNone(sys.modules.get("backend"))
      finally:
        os.chdir(original_cwd)
        sys.path = original_sys_path
        sys.modules.pop(module_name, None)
        sys.modules.pop("decky", None)
        for name in list(sys.modules):
          if name == "backend" or name.startswith("backend."):
            sys.modules.pop(name, None)
        if original_decky is not None:
          sys.modules["decky"] = original_decky
        for name, module in original_backend_modules.items():
          sys.modules[name] = module


if __name__ == "__main__":
  unittest.main()
