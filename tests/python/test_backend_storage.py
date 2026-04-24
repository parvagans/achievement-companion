from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from backend import storage


class BackendStorageTests(unittest.TestCase):
  def test_write_json_file_creates_parent_dirs_and_sorts_keys(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "nested" / "provider-config.json"

      storage.write_json_file(path, {"b": 2, "a": 1})

      self.assertTrue(path.exists())
      self.assertEqual(path.parent, Path(temp_dir) / "nested")
      self.assertEqual(path.read_text(encoding="utf-8"), '{\n  "a": 1,\n  "b": 2\n}')

  def test_read_json_file_returns_empty_for_missing_and_reads_valid_json(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-config.json"
      warnings: list[tuple[str, dict[str, object]]] = []

      missing_result = storage.read_json_file(path, warn=lambda message, fields: warnings.append((message, dict(fields))))
      self.assertEqual(missing_result, {})
      self.assertEqual(warnings, [])

      storage.write_json_file(path, {"version": 1, "steam": {"steamId64": "123"}})
      read_result = storage.read_json_file(path, warn=lambda message, fields: warnings.append((message, dict(fields))))
      self.assertEqual(read_result["version"], 1)
      self.assertEqual(read_result["steam"]["steamId64"], "123")
      self.assertEqual(warnings, [])

  def test_read_json_file_quarantines_malformed_json_with_same_directory_backup(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-secrets.json"
      path.write_text('{"version":2,"steam":{"version":2,"scheme":"local-obfuscation-v1","salt":"oops"', encoding="utf-8")
      warnings: list[tuple[str, dict[str, object]]] = []

      result = storage.read_json_file(
        path,
        warn=lambda message, fields: warnings.append((message, dict(fields))),
        now=datetime(2026, 4, 25, 12, 34, 56, tzinfo=timezone.utc),
      )

      backup_path = Path(temp_dir) / "provider-secrets.json.corrupt-20260425-123456"
      self.assertEqual(result, {})
      self.assertFalse(path.exists())
      self.assertTrue(backup_path.exists())
      self.assertEqual(len(warnings), 1)
      self.assertEqual(warnings[0][0], "Recovered malformed plugin state file")
      self.assertEqual(warnings[0][1]["path"], str(path))
      self.assertEqual(warnings[0][1]["backupPath"], str(backup_path))

  def test_build_corrupt_backup_path_uses_same_directory_and_corrupt_suffix(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-config.json"
      backup_path = storage.build_corrupt_backup_path(
        path,
        now=datetime(2026, 4, 25, 12, 34, 56, tzinfo=timezone.utc),
      )

      self.assertEqual(backup_path.parent, path.parent)
      self.assertEqual(backup_path.name, "provider-config.json.corrupt-20260425-123456")

  def test_quarantine_failure_reports_warning_and_returns_false(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      path = Path(temp_dir) / "provider-config.json"
      path.write_text("{", encoding="utf-8")
      warnings: list[tuple[str, dict[str, object]]] = []

      with mock.patch.object(Path, "replace", side_effect=OSError("quarantine failed")):
        result = storage.quarantine_corrupt_json_file(
          path,
          warn=lambda message, fields: warnings.append((message, dict(fields))),
          now=datetime(2026, 4, 25, 12, 34, 56, tzinfo=timezone.utc),
        )

      self.assertFalse(result)
      self.assertTrue(path.exists())
      self.assertEqual(len(warnings), 1)
      self.assertEqual(warnings[0][0], "Unable to quarantine malformed plugin state file")
      self.assertEqual(warnings[0][1]["path"], str(path))
      self.assertEqual(warnings[0][1]["errorType"], "OSError")
