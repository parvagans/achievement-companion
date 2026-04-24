from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from backend import provider_config


class BackendProviderConfigTests(unittest.TestCase):
  def test_load_provider_config_store_uses_default_version_for_missing_and_invalid_version(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-config.json"

      self.assertEqual(provider_config.load_provider_config_store(path), {"version": 1})

      path.write_text(json.dumps({"version": 1, "steam": {"steamId64": "123"}}), encoding="utf-8")
      self.assertEqual(
        provider_config.load_provider_config_store(path),
        {"version": 1, "steam": {"steamId64": "123"}},
      )
      self.assertEqual(provider_config.load_provider_config(path, "steam"), {"steamId64": "123"})

      path.write_text(json.dumps({"version": 2, "steam": {"steamId64": "123"}}), encoding="utf-8")
      self.assertEqual(provider_config.load_provider_config_store(path), {"version": 1})
      self.assertIsNone(provider_config.load_provider_config(path, "steam"))

  def test_build_retroachievements_config_view_preserves_counts_when_present(self) -> None:
    view = provider_config.build_retroachievements_config_view(
      {
        "username": "alice",
        "hasApiKey": False,
        "recentAchievementsCount": 10,
        "recentlyPlayedCount": 7,
      },
      True,
    )

    self.assertEqual(
      view,
      {
        "username": "alice",
        "hasApiKey": True,
        "recentAchievementsCount": 10,
        "recentlyPlayedCount": 7,
      },
    )

  def test_build_retroachievements_config_view_omits_optional_counts_when_absent(self) -> None:
    view = provider_config.build_retroachievements_config_view(
      {
        "username": "alice",
        "hasApiKey": True,
      },
      False,
    )

    self.assertEqual(
      view,
      {
        "username": "alice",
        "hasApiKey": False,
      },
    )

  def test_build_steam_config_view_includes_expected_defaults_and_counts(self) -> None:
    view = provider_config.build_steam_config_view(
      {
        "steamId64": "1234567890",
        "hasApiKey": False,
        "language": "",
        "recentAchievementsCount": 3,
        "recentlyPlayedCount": 4,
        "includePlayedFreeGames": True,
      },
      True,
    )

    self.assertEqual(
      view,
      {
        "steamId64": "1234567890",
        "hasApiKey": True,
        "language": "english",
        "recentAchievementsCount": 3,
        "recentlyPlayedCount": 4,
        "includePlayedFreeGames": True,
      },
    )

  def test_save_provider_config_writes_non_secret_fields_only(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-config.json"

      provider_config.save_provider_config(
        path,
        "steam",
        {
          "steamId64": "1234567890",
          "hasApiKey": True,
          "language": "english",
          "recentAchievementsCount": 5,
          "recentlyPlayedCount": 6,
          "includePlayedFreeGames": False,
          "apiKey": "secret",
          "apiKeyDraft": "draft",
          "token": "token",
          "password": "password",
          "secret": "secret",
        },
      )

      saved = json.loads(path.read_text(encoding="utf-8"))
      self.assertEqual(saved["version"], 1)
      self.assertEqual(saved["steam"]["steamId64"], "1234567890")
      self.assertEqual(saved["steam"]["hasApiKey"], True)
      self.assertEqual(saved["steam"]["language"], "english")
      self.assertEqual(saved["steam"]["recentAchievementsCount"], 5)
      self.assertEqual(saved["steam"]["recentlyPlayedCount"], 6)
      self.assertEqual(saved["steam"]["includePlayedFreeGames"], False)
      self.assertNotIn("apiKey", saved["steam"])
      self.assertNotIn("apiKeyDraft", saved["steam"])
      self.assertNotIn("token", saved["steam"])
      self.assertNotIn("password", saved["steam"])
      self.assertNotIn("secret", saved["steam"])

  def test_clear_provider_config_removes_selected_provider_only(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-config.json"
      path.write_text(
        json.dumps(
          {
            "version": 1,
            "retroAchievements": {"username": "alice", "hasApiKey": True},
            "steam": {"steamId64": "123", "hasApiKey": True},
          },
        ),
        encoding="utf-8",
      )

      provider_config.clear_provider_config(path, "steam")

      saved = json.loads(path.read_text(encoding="utf-8"))
      self.assertEqual(saved["version"], 1)
      self.assertIn("retroAchievements", saved)
      self.assertNotIn("steam", saved)


if __name__ == "__main__":
  unittest.main()
