from __future__ import annotations

import unittest

from backend import redaction


class BackendRedactionTests(unittest.TestCase):
  def test_secret_like_keys_and_secret_urls_are_redacted(self) -> None:
    rendered = redaction.redact_text(
      "Credentials apiKeyDraft=alpha Authorization: Bearer theta "
      "https://example.invalid/path?key=abc123&y=def456&token=ghi789",
    )

    self.assertNotIn("alpha", rendered)
    self.assertNotIn("theta", rendered)
    self.assertNotIn("abc123", rendered)
    self.assertNotIn("def456", rendered)
    self.assertNotIn("ghi789", rendered)
    self.assertIn("[redacted]", rendered)
    self.assertIn("[redacted url]", rendered)

  def test_nested_payload_redaction_preserves_safe_fields(self) -> None:
    payload = {
      "providerId": "steam",
      "path": "IPlayerService/GetOwnedGames/v1/",
      "status": 403,
      "durationMs": 123,
      "apiKey": "secret",
      "token": "secret-token",
      "nested": [
        {"Authorization": "Bearer theta", "label": "visible"},
        ("safe", {"y": "delta", "count": 3}),
      ],
    }

    redacted = redaction.redact_value(payload)

    self.assertEqual(redacted["providerId"], "steam")
    self.assertEqual(redacted["path"], "IPlayerService/GetOwnedGames/v1/")
    self.assertEqual(redacted["status"], 403)
    self.assertEqual(redacted["durationMs"], 123)
    self.assertEqual(redacted["apiKey"], "[redacted]")
    self.assertEqual(redacted["token"], "[redacted]")
    self.assertEqual(redacted["nested"][0]["Authorization"], "[redacted]")
    self.assertEqual(redacted["nested"][0]["label"], "visible")
    self.assertEqual(redacted["nested"][1][0], "safe")
    self.assertEqual(redacted["nested"][1][1]["y"], "[redacted]")
    self.assertEqual(redacted["nested"][1][1]["count"], 3)

  def test_secret_key_classification_includes_authorization_and_y(self) -> None:
    self.assertTrue(redaction.is_secret_key("Authorization"))
    self.assertTrue(redaction.is_secret_key("apiKeyDraft"))
    self.assertTrue(redaction.is_secret_key("y"))
    self.assertFalse(redaction.is_secret_key("providerId"))

