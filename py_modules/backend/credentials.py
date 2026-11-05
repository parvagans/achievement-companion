"""Recoverable updates of the existing config/secret files.

The journal holds their previous encoded contents, never plaintext API keys.
A crash before journal removal rolls back both files before any pair is read.
One Decky backend process owns these files; its worker threads share this lock.
"""
from contextlib import contextmanager
from pathlib import Path
from threading import RLock
import json
import os

from backend.storage import write_json_file, quarantine_corrupt_json_file


def sync_directory(path):
  if os.name != "nt":
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
      os.fsync(fd)
    finally:
      os.close(fd)


def read_store(path, versions):
  try:
    value = json.loads(path.read_text(encoding="utf-8"))
  except FileNotFoundError:
    return None
  except json.JSONDecodeError:
    # Keep corruption recovery, retaining every byte in a same-directory backup.
    # A failed quarantine must refuse the mutation.
    if not quarantine_corrupt_json_file(path):
      raise
    return None
  if not isinstance(value, dict) or value.get("version") not in versions:
    raise ValueError("Unsupported credential store. Existing data retained.")
  return value


class CredentialTransaction:
  def __init__(self, config_path: Path, secrets_path: Path):
    self.paths = (config_path, secrets_path)
    self.journal = config_path.with_name("provider-credentials.pending.json")
    self.lock = RLock()

  def _recover(self):
    try:
      pending = json.loads(self.journal.read_text(encoding="utf-8"))
    except FileNotFoundError:
      return
    if not isinstance(pending, dict) or pending.get("version") != 1:
      raise ValueError("Invalid credential recovery journal.")
    previous = pending.get("previous")
    if not isinstance(previous, list) or len(previous) != 2:
      raise ValueError("Invalid credential recovery journal.")
    # Validate the entire journal before touching either file.
    for value, versions in zip(previous, ((1,), (1, 2))):
      if value is not None and (not isinstance(value, dict) or value.get("version") not in versions):
        raise ValueError("Invalid credential recovery journal.")
    for path, value in zip(self.paths, previous):
      if value is None:
        path.unlink(missing_ok=True)
      else:
        write_json_file(path, value)
    sync_directory(self.journal.parent)
    self.journal.unlink()
    sync_directory(self.journal.parent)

  @contextmanager
  def read(self):
    with self.lock:
      self._recover()
      yield

  @contextmanager
  def mutation(self):
    with self.lock:
      self._recover()
      previous = [read_store(path, versions) for path, versions in zip(self.paths, ((1,), (1, 2)))]
      write_json_file(self.journal, {"version": 1, "previous": previous})
      sync_directory(self.journal.parent)
      try:
        yield
        sync_directory(self.journal.parent)
        self.journal.unlink()
        sync_directory(self.journal.parent)
      except BaseException:
        self._recover()
        raise

