from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.paths import ensure_backend_dirs, resolve_steamos_backend_paths


class BackendPathsTests(unittest.TestCase):
  def test_resolve_steamos_backend_paths_respects_full_xdg_environment(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      env = {
        "XDG_CONFIG_HOME": str(root / "cfg"),
        "XDG_DATA_HOME": str(root / "data"),
        "XDG_STATE_HOME": str(root / "state"),
        "XDG_CACHE_HOME": str(root / "cache"),
        "XDG_RUNTIME_DIR": str(root / "runtime"),
      }

      paths = resolve_steamos_backend_paths(env=env, home=root / "home")

      self.assertEqual(paths.config_path, root / "cfg" / "achievement-companion" / "provider-config.json")
      self.assertEqual(paths.secrets_path, root / "data" / "achievement-companion" / "provider-secrets.json")
      self.assertEqual(paths.logs_dir, root / "state" / "achievement-companion" / "logs")
      self.assertEqual(paths.dashboard_cache_dir, root / "cache" / "achievement-companion" / "dashboard")
      self.assertEqual(
        paths.steam_scan_overview_path,
        root / "cache" / "achievement-companion" / "steam" / "library-achievement-scan-overview.json",
      )
      self.assertEqual(
        paths.steam_scan_summary_path,
        root / "cache" / "achievement-companion" / "steam" / "library-achievement-scan-summary.json",
      )
      self.assertEqual(
        paths.runtime_metadata_path,
        root / "runtime" / "achievement-companion" / "backend.json",
      )

  def test_resolve_steamos_backend_paths_falls_back_to_home_when_xdg_is_missing(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      home = Path(temp_dir) / "home"

      paths = resolve_steamos_backend_paths(env={}, home=home)

      self.assertEqual(paths.config_path, home / ".config" / "achievement-companion" / "provider-config.json")
      self.assertEqual(paths.secrets_path, home / ".local" / "share" / "achievement-companion" / "provider-secrets.json")
      self.assertEqual(paths.logs_dir, home / ".local" / "state" / "achievement-companion" / "logs")
      self.assertEqual(paths.dashboard_cache_dir, home / ".cache" / "achievement-companion" / "dashboard")
      self.assertEqual(
        paths.steam_scan_overview_path,
        home / ".cache" / "achievement-companion" / "steam" / "library-achievement-scan-overview.json",
      )
      self.assertEqual(
        paths.steam_scan_summary_path,
        home / ".cache" / "achievement-companion" / "steam" / "library-achievement-scan-summary.json",
      )
      self.assertIsNone(paths.runtime_metadata_path)

  def test_runtime_metadata_path_requires_xdg_runtime_dir(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      home = Path(temp_dir) / "home"
      paths = resolve_steamos_backend_paths(
        env={"XDG_RUNTIME_DIR": "   "},
        home=home,
      )

      self.assertIsNone(paths.runtime_metadata_path)

  def test_resolution_does_not_create_directories(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      home = Path(temp_dir) / "home"

      paths = resolve_steamos_backend_paths(env={}, home=home)

      self.assertFalse(paths.config_path.parent.exists())
      self.assertFalse(paths.secrets_path.parent.exists())
      self.assertFalse(paths.logs_dir.exists())
      self.assertFalse(paths.dashboard_cache_dir.exists())
      self.assertFalse(paths.steam_scan_overview_path.parent.exists())
      self.assertFalse(paths.steam_scan_summary_path.parent.exists())

  def test_ensure_backend_dirs_creates_only_expected_directories(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      root = Path(temp_dir)
      env = {
        "XDG_CONFIG_HOME": str(root / "cfg"),
        "XDG_DATA_HOME": str(root / "data"),
        "XDG_STATE_HOME": str(root / "state"),
        "XDG_CACHE_HOME": str(root / "cache"),
        "XDG_RUNTIME_DIR": str(root / "runtime"),
      }
      paths = resolve_steamos_backend_paths(env=env, home=root / "home")

      ensure_backend_dirs(paths)

      self.assertTrue(paths.config_path.parent.is_dir())
      self.assertTrue(paths.secrets_path.parent.is_dir())
      self.assertTrue(paths.logs_dir.is_dir())
      self.assertTrue(paths.dashboard_cache_dir.is_dir())
      self.assertTrue(paths.steam_scan_overview_path.parent.is_dir())
      self.assertTrue(paths.steam_scan_summary_path.parent.is_dir())
      self.assertIsNotNone(paths.runtime_metadata_path)
      self.assertTrue(paths.runtime_metadata_path is not None and paths.runtime_metadata_path.parent.is_dir())
      self.assertFalse(paths.config_path.exists())
      self.assertFalse(paths.secrets_path.exists())
      self.assertFalse(paths.steam_scan_overview_path.exists())
      self.assertFalse(paths.steam_scan_summary_path.exists())

  def test_paths_do_not_point_to_decky_homebrew_or_onedrive_locations(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      home = Path(temp_dir) / "home"
      paths = resolve_steamos_backend_paths(env={}, home=home)
      rendered = "\n".join(
        str(path)
        for path in (
          paths.config_path,
          paths.secrets_path,
          paths.logs_dir,
          paths.dashboard_cache_dir,
          paths.steam_scan_overview_path,
          paths.steam_scan_summary_path,
        )
      )

      self.assertNotIn("/home/deck/homebrew", rendered)
      self.assertNotIn("OneDrive", rendered)


if __name__ == "__main__":
  unittest.main()
