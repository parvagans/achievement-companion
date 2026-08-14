from __future__ import annotations

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping


WarningCallback = Callable[[str, Mapping[str, Any]], None]


def _ensure_parent_directory(path: Path) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)


def _ensure_file_permissions(path: Path) -> None:
  try:
    path.chmod(0o600)
  except OSError:
    pass


def write_json_file(path: Path, value: object) -> None:
  _ensure_parent_directory(path)

  serialized = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
  with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=str(path.parent)) as handle:
    temp_path = Path(handle.name)
    handle.write(serialized)

  try:
    _ensure_file_permissions(temp_path)
    temp_path.replace(path)
    _ensure_file_permissions(path)
  finally:
    if temp_path.exists():
      try:
        temp_path.unlink()
      except OSError:
        pass


def build_corrupt_backup_path(path: Path, *, now: datetime | None = None) -> Path:
  timestamp = (now or datetime.now(timezone.utc)).strftime("%Y%m%d-%H%M%S")
  backup_path = path.with_name(f"{path.name}.corrupt-{timestamp}")
  suffix = 1
  while backup_path.exists():
    backup_path = path.with_name(f"{path.name}.corrupt-{timestamp}-{suffix}")
    suffix += 1
  return backup_path


def quarantine_corrupt_json_file(
  path: Path,
  *,
  warn: WarningCallback | None = None,
  now: datetime | None = None,
) -> bool:
  if not path.exists():
    return False

  backup_path = build_corrupt_backup_path(path, now=now)
  try:
    path.replace(backup_path)
  except OSError as cause:
    if warn is not None:
      warn(
        "Unable to quarantine malformed plugin state file",
        {
          "path": str(path),
          "errorType": type(cause).__name__,
          "error": str(cause),
        },
      )
    return False

  if warn is not None:
    warn(
      "Recovered malformed plugin state file",
      {
        "path": str(path),
        "backupPath": str(backup_path),
      },
    )
  return True


def read_json_file(
  path: Path,
  *,
  warn: WarningCallback | None = None,
  now: datetime | None = None,
) -> dict[str, Any]:
  try:
    raw_text = path.read_text(encoding="utf-8")
  except FileNotFoundError:
    return {}
  except OSError as cause:
    if warn is not None:
      warn("Unable to read plugin state file", {"path": str(path), "error": str(cause)})
    return {}

  if raw_text.strip() == "":
    return {}

  try:
    parsed = json.loads(raw_text)
  except json.JSONDecodeError:
    quarantine_corrupt_json_file(path, warn=warn, now=now)
    return {}

  return parsed if isinstance(parsed, dict) else {}
