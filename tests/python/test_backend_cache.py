from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from backend import cache
from backend.paths import BackendPaths


ROOT_DIR = Path(__file__).resolve().parents[2]


def _build_test_backend_paths(root: Path) -> BackendPaths:
  return BackendPaths(
    config_path=root / "config" / "achievement-companion" / "provider-config.json",
    secrets_path=root / "data" / "achievement-companion" / "provider-secrets.json",
    logs_dir=root / "state" / "achievement-companion" / "logs",
    dashboard_cache_dir=root / "cache" / "achievement-companion" / "dashboard",
    steam_scan_overview_path=root / "cache" / "achievement-companion" / "steam" / "library-achievement-scan-overview.json",
    steam_scan_summary_path=root / "cache" / "achievement-companion" / "steam" / "library-achievement-scan-summary.json",
    runtime_metadata_path=root / "runtime" / "achievement-companion" / "backend.json",
  )


class BackendCacheTests(unittest.TestCase):
  def test_dashboard_cache_write_read_and_clear_support_provider_and_global_invalidation(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      steam_value = {
        "status": "success",
        "profile": {
          "providerId": "steam",
          "metrics": [
            {
              "key": "games-beaten",
              "label": "Perfect Games",
              "value": "3",
            },
          ],
        },
      }
      retro_value = {"status": "success", "profile": {"providerId": "retroachievements"}}

      cache.write_dashboard_cache(paths, "steam", steam_value)
      cache.write_dashboard_cache(paths, "retroachievements", retro_value)

      self.assertEqual(cache.read_dashboard_cache(paths, "steam"), {"hit": True, "value": steam_value})
      self.assertEqual(cache.read_dashboard_cache(paths, "retroachievements"), {"hit": True, "value": retro_value})
      self.assertEqual(cache.clear_dashboard_cache(paths, "steam"), True)
      self.assertEqual(cache.read_dashboard_cache(paths, "steam"), {"hit": False})
      self.assertEqual(cache.read_dashboard_cache(paths, "retroachievements"), {"hit": True, "value": retro_value})
      self.assertEqual(cache.clear_dashboard_cache(paths), True)
      self.assertEqual(cache.read_dashboard_cache(paths, "retroachievements"), {"hit": False})
      self.assertEqual(cache.clear_dashboard_cache(paths), False)

  def test_dashboard_cache_missing_and_corrupt_files_return_miss_and_quarantine(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      warnings: list[tuple[str, dict[str, object]]] = []

      self.assertEqual(cache.read_dashboard_cache(paths, "steam", warn=lambda message, fields: warnings.append((message, dict(fields)))), {"hit": False})

      cache_path = cache.get_dashboard_cache_path(paths, "steam")
      cache_path.parent.mkdir(parents=True, exist_ok=True)
      cache_path.write_text('{"status":"success"', encoding="utf-8")

      result = cache.read_dashboard_cache(
        paths,
        "steam",
        warn=lambda message, fields: warnings.append((message, dict(fields))),
      )

      self.assertEqual(result, {"hit": False})
      self.assertFalse(cache_path.exists())
      self.assertEqual(len(list(cache_path.parent.glob("steam.json.corrupt-*"))), 1)
      self.assertEqual(warnings[-1][0], "Recovered malformed plugin state file")

  def test_dashboard_cache_rejects_invalid_provider_ids_and_secret_like_fields(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))

      for invalid_provider_id in ("", "steam/../../secret", "steam\\..\\..\\secret", "https://example.invalid", "localhost", "decky"):
        with self.assertRaises(ValueError):
          cache.get_dashboard_cache_path(paths, invalid_provider_id)

      with self.assertRaises(ValueError):
        cache.write_dashboard_cache(paths, "steam", {"profile": {"apiKey": "raw-secret"}})

      cache_path = cache.get_dashboard_cache_path(paths, "steam")
      self.assertFalse(cache_path.exists())

  def test_steam_scan_cache_keeps_overview_and_summary_separate_and_rejects_secret_like_fields(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      overview = {"ownedGameCount": 3, "scannedGameCount": 3}
      summary = {"games": [{"appid": 10, "title": "Half-Life"}], "scannedAt": "2026-04-25T00:00:00+00:00"}

      cache.write_steam_scan_overview(paths, overview)
      cache.write_steam_scan_summary(paths, summary)

      self.assertEqual(cache.read_steam_scan_overview(paths), {"hit": True, "value": overview})
      self.assertEqual(cache.read_steam_scan_summary(paths), {"hit": True, "value": summary})
      self.assertEqual(json.loads(paths.steam_scan_overview_path.read_text(encoding="utf-8")), overview)
      self.assertEqual(json.loads(paths.steam_scan_summary_path.read_text(encoding="utf-8")), summary)

      with self.assertRaises(ValueError):
        cache.write_steam_scan_overview(paths, {"apiKey": "should-not-write"})
      with self.assertRaises(ValueError):
        cache.write_steam_scan_summary(paths, {"Authorization": "Bearer nope"})

      self.assertNotIn("should-not-write", paths.steam_scan_overview_path.read_text(encoding="utf-8"))
      self.assertNotIn("Bearer nope", paths.steam_scan_summary_path.read_text(encoding="utf-8"))

  def test_steam_scan_cache_missing_corrupt_and_clear_behaviors_are_idempotent(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      paths = _build_test_backend_paths(Path(temp_dir))
      warnings: list[tuple[str, dict[str, object]]] = []

      self.assertEqual(cache.read_steam_scan_overview(paths, warn=lambda message, fields: warnings.append((message, dict(fields)))), {"hit": False})
      self.assertEqual(cache.read_steam_scan_summary(paths, warn=lambda message, fields: warnings.append((message, dict(fields)))), {"hit": False})

      paths.steam_scan_overview_path.parent.mkdir(parents=True, exist_ok=True)
      paths.steam_scan_overview_path.write_text('{"ownedGameCount":', encoding="utf-8")
      paths.steam_scan_summary_path.parent.mkdir(parents=True, exist_ok=True)
      paths.steam_scan_summary_path.write_text('{"games":[', encoding="utf-8")

      self.assertEqual(
        cache.read_steam_scan_overview(paths, warn=lambda message, fields: warnings.append((message, dict(fields)))),
        {"hit": False},
      )
      self.assertEqual(
        cache.read_steam_scan_summary(paths, warn=lambda message, fields: warnings.append((message, dict(fields)))),
        {"hit": False},
      )
      self.assertEqual(len(list(paths.steam_scan_overview_path.parent.glob("library-achievement-scan-overview.json.corrupt-*"))), 1)
      self.assertEqual(len(list(paths.steam_scan_summary_path.parent.glob("library-achievement-scan-summary.json.corrupt-*"))), 1)

      cache.write_steam_scan_overview(paths, {"ownedGameCount": 1})
      cache.write_steam_scan_summary(paths, {"games": []})
      self.assertEqual(cache.clear_steam_scan_cache(paths), True)
      self.assertEqual(cache.clear_steam_scan_cache(paths), False)
      self.assertEqual(cache.read_steam_scan_overview(paths), {"hit": False})
      self.assertEqual(cache.read_steam_scan_summary(paths), {"hit": False})

  def test_cache_module_stays_out_of_decky_boundaries_and_release_payload(self) -> None:
    source = (ROOT_DIR / "backend" / "cache.py").read_text(encoding="utf-8")
    package_release = (ROOT_DIR / "scripts" / "package_release.py").read_text(encoding="utf-8")
    check_release = (ROOT_DIR / "scripts" / "check_release_artifact.py").read_text(encoding="utf-8")

    self.assertNotIn("import decky", source)
    self.assertNotIn("from decky", source)
    self.assertNotIn("import main", source)
    self.assertNotIn("from main import", source)
    self.assertNotIn("OneDrive", source)
    self.assertNotIn("backend/cache.py", package_release)
    self.assertNotIn("backend/cache.py", check_release)
    self.assertNotIn("backend/local_server.py", package_release)
    self.assertNotIn("backend/local_server.py", check_release)
    self.assertNotIn("backend/paths.py", package_release)
    self.assertNotIn("backend/paths.py", check_release)


if __name__ == "__main__":
  unittest.main()
