from __future__ import annotations

import unittest

from backend import diagnostics


class BackendDiagnosticsTests(unittest.TestCase):
  def test_sanitize_known_event_preserves_safe_fields_and_drops_unsafe_fields(self) -> None:
    result = diagnostics.sanitize_diagnostic_event(
      {
        "event": " dashboard_refresh_completed ",
        "providerId": " steam ",
        "mode": " manual ",
        "durationMs": 12.9,
        "source": " live ",
        "apiKey": "secret",
        "apiKeyDraft": "draft",
        "token": "token",
        "password": "password",
        "secret": "secret",
        "Authorization": "Bearer theta",
        "url": "https://example.invalid/path?key=secret",
      },
    )

    self.assertIsNotNone(result)
    assert result is not None
    self.assertEqual(result["event"], "dashboard_refresh_completed")
    self.assertEqual(result["message"], "Dashboard refresh completed")
    self.assertEqual(
      result["fields"],
      {
        "providerId": "steam",
        "mode": "manual",
        "durationMs": 12,
        "source": "live",
      },
    )

  def test_unknown_event_returns_none(self) -> None:
    self.assertIsNone(diagnostics.sanitize_diagnostic_event({"event": "something_else"}))


if __name__ == "__main__":
  unittest.main()
