from __future__ import annotations

import base64
import json
import tempfile
import unittest
from pathlib import Path

from backend import secrets as secret_helpers


class BackendSecretTests(unittest.TestCase):
  def test_save_and_load_secret_round_trip_uses_protected_record(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-secrets.json"

      secret_helpers.save_secret_api_key(
        path,
        "steam",
        "steam-secret",
        settings_dir_text="test-settings",
      )

      saved_text = path.read_text(encoding="utf-8")
      saved_json = json.loads(saved_text)
      self.assertEqual(saved_json["version"], 2)
      self.assertEqual(saved_json["steam"]["version"], 2)
      self.assertEqual(saved_json["steam"]["scheme"], "local-obfuscation-v1")
      self.assertNotIn('"apiKey"', saved_text)
      self.assertNotIn("steam-secret", saved_text)
      self.assertEqual(
        secret_helpers.load_secret_api_key(path, "steam", settings_dir_text="test-settings"),
        "steam-secret",
      )

  def test_clear_secret_api_key_removes_one_provider_and_then_clears_last_file(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-secrets.json"

      secret_helpers.save_secret_api_key(path, "retroAchievements", "ra-secret", settings_dir_text="test-settings")
      secret_helpers.save_secret_api_key(path, "steam", "steam-secret", settings_dir_text="test-settings")

      secret_helpers.clear_secret_api_key(path, "steam")
      after_first_clear = json.loads(path.read_text(encoding="utf-8"))
      self.assertEqual(after_first_clear["version"], 2)
      self.assertIn("retroAchievements", after_first_clear)
      self.assertNotIn("steam", after_first_clear)

      secret_helpers.clear_secret_api_key(path, "retroAchievements")
      self.assertFalse(path.exists())

  def test_legacy_secret_migrates_to_version_two_on_read(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-secrets.json"
      legacy_payload = base64.urlsafe_b64encode(json.dumps({"apiKey": "ra-secret"}).encode("utf-8")).decode("ascii")
      path.write_text(
        json.dumps(
          {
            "version": 1,
            "retroAchievements": {
              "version": 1,
              "payload": legacy_payload,
            },
          },
        ),
        encoding="utf-8",
      )

      self.assertEqual(
        secret_helpers.load_secret_api_key(path, "retroAchievements", settings_dir_text="test-settings"),
        "ra-secret",
      )

      saved_json = json.loads(path.read_text(encoding="utf-8"))
      self.assertEqual(saved_json["version"], 2)
      self.assertEqual(saved_json["retroAchievements"]["version"], 2)
      self.assertEqual(saved_json["retroAchievements"]["scheme"], "local-obfuscation-v1")
      self.assertNotIn("payload", saved_json["retroAchievements"])
      self.assertNotIn("apiKey", path.read_text(encoding="utf-8"))

  def test_invalid_protected_secret_returns_none_without_warnings(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-secrets.json"
      path.write_text(
        json.dumps(
          {
            "version": 2,
            "steam": {
              "version": 2,
              "scheme": "local-obfuscation-v1",
              "salt": "bad",
              "nonce": "bad",
              "ciphertext": "bad",
              "tag": "bad",
            },
          },
        ),
        encoding="utf-8",
      )

      warnings: list[tuple[str, dict[str, object]]] = []
      self.assertIsNone(
        secret_helpers.load_secret_api_key(
          path,
          "steam",
          warn=lambda message, fields: warnings.append((message, dict(fields))),
          settings_dir_text="test-settings",
        ),
      )
      self.assertEqual(warnings, [])

  def test_secret_record_key_derivation_is_deterministic_with_seed_text(self) -> None:
    key_a = secret_helpers._derive_secret_record_key(  # type: ignore[attr-defined]
      "steam",
      b"0123456789abcdef",
      settings_dir_text="test-settings",
    )
    key_b = secret_helpers._derive_secret_record_key(  # type: ignore[attr-defined]
      "steam",
      b"0123456789abcdef",
      settings_dir_text="test-settings",
    )

    self.assertEqual(key_a, key_b)


if __name__ == "__main__":
  unittest.main()
