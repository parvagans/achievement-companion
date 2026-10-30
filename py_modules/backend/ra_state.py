"""Transactional RA state; no credentials or authenticated URLs are stored."""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Any


class RaStateStore:
  def __init__(self, path: Path) -> None:
    self.path = path

  def _connect(self) -> sqlite3.Connection:
    self.path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(self.path, timeout=2)
    try:
      return self._initialize(connection)
    except sqlite3.DatabaseError as error:
      connection.close()
      if getattr(error, "sqlite_errorcode", None) not in (sqlite3.SQLITE_CORRUPT, sqlite3.SQLITE_NOTADB):
        raise
      # Recover only this cache database; leave settings and secrets untouched.
      backup = self.path.with_name(f"{self.path.name}.corrupt-{time.time_ns()}")
      self.path.replace(backup)
      for old in sorted(self.path.parent.glob(f"{self.path.name}.corrupt-*"))[:-2]:
        try:
          old.unlink()
        except OSError:
          pass
      connection = self._initialize(sqlite3.connect(self.path, timeout=2))
      # A damaged cooldown record must not accidentally authorize an immediate burst.
      with connection:
        connection.execute("INSERT OR REPLACE INTO state VALUES (?,?)", (
          "ra-cooldown", json.dumps({"until": time.time() + 60, "strikes": 1})))
      return connection

  def _initialize(self, connection: sqlite3.Connection) -> sqlite3.Connection:
    if connection.execute("PRAGMA user_version").fetchone()[0] > 1:
      connection.close()
      raise sqlite3.DatabaseError("Unsupported RA cache schema; original database preserved")
    connection.execute("CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    connection.execute("""CREATE TABLE IF NOT EXISTS resources (
      key TEXT PRIMARY KEY, scope TEXT NOT NULL, kind TEXT NOT NULL, schema_version INTEGER NOT NULL,
      payload TEXT NOT NULL, fetched_at REAL NOT NULL, fresh_until REAL NOT NULL,
      last_attempt_at REAL NOT NULL, next_eligible_at REAL NOT NULL DEFAULT 0,
      validation_state TEXT NOT NULL DEFAULT 'valid', last_error TEXT,
      generation INTEGER NOT NULL DEFAULT 0, size INTEGER NOT NULL)""")
    connection.execute("PRAGMA user_version=1")
    connection.execute("CREATE TABLE IF NOT EXISTS history_sync (scope TEXT PRIMARY KEY, metadata TEXT NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS history_events (scope TEXT NOT NULL,event_key TEXT NOT NULL,game_id TEXT,payload TEXT NOT NULL,size INTEGER NOT NULL,PRIMARY KEY(scope,event_key))")
    if "game_id" not in {row[1] for row in connection.execute("PRAGMA table_info(history_events)")}:
      connection.execute("ALTER TABLE history_events ADD COLUMN game_id TEXT")
      for scope, identity, payload in connection.execute("SELECT scope,event_key,payload FROM history_events").fetchall():
        try:
          event = json.loads(payload)
          connection.execute("UPDATE history_events SET game_id=? WHERE scope=? AND event_key=?", (str(event.get("GameID", event.get("gameId"))), scope, identity))
        except (ValueError, TypeError):
          pass
    connection.execute("CREATE INDEX IF NOT EXISTS history_game_idx ON history_events(scope,game_id)")
    connection.execute("CREATE TABLE IF NOT EXISTS history_game_proofs (scope TEXT NOT NULL,game_id TEXT NOT NULL,verified_at REAL NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(scope,game_id))")
    connection.commit()
    try:
      self.path.chmod(0o600)
    except OSError:
      pass
    return connection

  def resource(self, key: str) -> dict | None:
    try:
      with closing(self._connect()) as connection, connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute("SELECT * FROM resources WHERE key=?", (key,)).fetchone()
        if row is None:
          return None
        result = dict(row)
        try:
          result["payload"] = json.loads(result["payload"])
        except ValueError:
          # Preserve the original row for diagnosis; only this resource is rebuilt.
          result["payload"] = None
          result["validation_state"] = "corrupt"
        return result
    except (OSError, sqlite3.Error, ValueError):
      return None

  def save_resource(self, record: dict, *, max_bytes: int = 64 * 1024 * 1024, max_records: int = 2048) -> bool:
    try:
      payload = json.dumps(record["payload"], allow_nan=False, separators=(",", ":"))
      size = len(payload.encode("utf-8"))
      if size > max_bytes // 2:
        return False
      with closing(self._connect()) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        current = connection.execute("SELECT generation FROM resources WHERE key=?", (record["key"],)).fetchone()
        fence = connection.execute("SELECT value FROM state WHERE key=?", ("generation:" + record["key"],)).fetchone()
        if (current and current[0] > record["generation"]) or (fence and json.loads(fence[0]) > record["generation"]):
          return False
        connection.execute("""INSERT OR REPLACE INTO resources
          (key,scope,kind,schema_version,payload,fetched_at,fresh_until,last_attempt_at,
           next_eligible_at,validation_state,last_error,generation,size)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
          record["key"], record["scope"], record["kind"], record["schema_version"], payload,
          record["fetched_at"], record["fresh_until"], record["last_attempt_at"],
          record.get("next_eligible_at", 0), record.get("validation_state", "valid"),
          record.get("last_error"), record["generation"], size))
        count, total = connection.execute("SELECT count(*),coalesce(sum(size),0) FROM resources").fetchone()
        while count > max_records or total > max_bytes:
          oldest = connection.execute("SELECT key,size FROM resources ORDER BY fetched_at,key LIMIT 1").fetchone()
          connection.execute("DELETE FROM resources WHERE key=?", (oldest[0],))
          count -= 1
          total -= oldest[1]
      return True
    except (OSError, sqlite3.Error, ValueError, TypeError):
      return False

  def invalidate(self, *, scope: str, kind: str | None = None, exclude=()) -> None:
    try:
      with closing(self._connect()) as connection:
        keys = [row[0] for row in connection.execute("SELECT key FROM resources WHERE scope=?" +
          (" AND kind=?" if kind else ""), (scope, kind) if kind else (scope,)) if row[0] not in exclude]
      for key in keys:
        self.invalidate_key(key)
    except (OSError, sqlite3.Error):
      raise

  def failed_attempt(self, key: str, attempted_at: float, category: str, next_eligible_at: float = 0) -> bool:
    try:
      with closing(self._connect()) as connection, connection:
        connection.execute("UPDATE resources SET last_attempt_at=?,last_error=?,next_eligible_at=? WHERE key=?",
                           (attempted_at, category[:64], next_eligible_at, key))
      return True
    except (OSError, sqlite3.Error):
      return False

  def invalidate_key(self, key: str) -> None:
    try:
      with closing(self._connect()) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        old = connection.execute("SELECT value FROM state WHERE key=?", ("generation:" + key,)).fetchone()
        row = connection.execute("SELECT generation FROM resources WHERE key=?", (key,)).fetchone()
        generation = max(json.loads(old[0]) if old else 0, row[0] if row else 0) + 1
        connection.execute("INSERT OR REPLACE INTO state VALUES (?,?)", ("generation:" + key, json.dumps(generation)))
        connection.execute("UPDATE resources SET fresh_until=0,generation=? WHERE key=?", (generation, key))
    except (OSError, sqlite3.Error):
      raise

  def diagnostics(self) -> dict:
    try:
      with closing(self._connect()) as connection:
        count, size, success = connection.execute("SELECT count(*),coalesce(sum(size),0),max(fetched_at) FROM resources").fetchone()
        events, history_size = connection.execute("SELECT count(*),coalesce(sum(size),0) FROM history_events").fetchone()
        proofs = connection.execute("SELECT count(*) FROM history_game_proofs").fetchone()[0]
      return {"resources": count, "payloadBytes": size, "lastSuccessAt": success,
              "historyEvents": events, "historyBytes": history_size, "historyGameProofs": proofs,
              "databaseBytes": self.path.stat().st_size, "storage": "Decky plugin settings/retroachievements.sqlite3", "healthy": True}
    except (OSError, sqlite3.Error):
      return {"storage": "retroachievements.sqlite3", "healthy": False}

  def rebuild_history_checkpoint(self, scope: str) -> bool:
    """Reprove coverage while retaining all verified events and reset proofs."""
    try:
      with closing(self._connect()) as connection, connection:
        connection.execute("DELETE FROM history_sync WHERE scope=?", (scope,))
        from backend.ra_history import event_identity
        for identity, raw in connection.execute("SELECT event_key,payload FROM history_events WHERE scope=?", (scope,)).fetchall():
          try:
            if event_identity(json.loads(raw)) != identity:
              raise ValueError("Invalid history row")
          except (ValueError, TypeError, KeyError, OverflowError):
            connection.execute("DELETE FROM history_events WHERE scope=? AND event_key=?", (scope, identity))
      return True
    except (OSError, sqlite3.Error):
      return False

  def history(self, scope: str) -> dict | None:
    try:
      with closing(self._connect()) as connection:
        row = connection.execute("SELECT metadata FROM history_sync WHERE scope=?", (scope,)).fetchone()
        if row is None:
          return None
        try:
          metadata = json.loads(row[0])
          if not isinstance(metadata, dict):
            raise ValueError("Invalid checkpoint")
        except (ValueError, TypeError):
          metadata = {"version": 0}
        entries = []
        from backend.ra_history import event_identity
        for identity, raw in connection.execute("SELECT event_key,payload FROM history_events WHERE scope=? ORDER BY event_key", (scope,)):
          try:
            event = json.loads(raw)
            if event_identity(event) != identity:
              raise ValueError("Invalid history row")
            entries.append(event)
          except (ValueError, TypeError, KeyError, OverflowError):
            metadata["version"] = 0
      return {**metadata, "entries": entries}
    except (OSError, sqlite3.Error, ValueError, TypeError):
      return None

  def calendar(self, scope: str, since: int) -> dict | None:
    """Cache-only projection; a limited recent feed cannot prove quiet days."""
    try:
      with closing(self._connect()) as connection:
        row = connection.execute("SELECT metadata FROM history_sync WHERE scope=?", (scope,)).fetchone()
        metadata = json.loads(row[0]) if row else None
        if not isinstance(metadata, dict) or metadata.get("version") != 1 or metadata.get("complete") is not True or metadata.get("through", 0) < since:
          return None
        rows = connection.execute("SELECT payload FROM history_events WHERE scope=? AND CAST(strftime('%s',coalesce(json_extract(payload,'$.Date'),json_extract(payload,'$.date'))) AS INTEGER)>=?", (scope, since)).fetchall()
        entries = [json.loads(item[0]) for item in rows]
      return {"entries": entries, "through": metadata["through"], "lastSuccessAt": metadata.get("lastSuccessAt")}
    except (OSError, sqlite3.Error, ValueError, TypeError):
      return None

  def commit_history_batch(self, scope: str, metadata: dict, entries: list[tuple[str, dict]]) -> bool:
    """Commit validated events and the next cursor in the same transaction."""
    try:
      with closing(self._connect()) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        for identity, event in entries:
          game_id = str(event.get("GameID", event.get("gameId")))
          proof_row = connection.execute("SELECT verified_at,payload FROM history_game_proofs WHERE scope=? AND game_id=?", (scope, game_id)).fetchone()
          if proof_row:
            from backend.ra_history import event_timestamp
            proof = json.loads(proof_row[1])
            achievement_id = str(event.get("AchievementID", event.get("achievementId")))
            if event_timestamp(event) <= proof_row[0] and achievement_id in proof["achievementIds"] and identity not in proof["allowedEvents"]:
              continue
          payload = json.dumps(event, allow_nan=False, separators=(",", ":"))
          connection.execute("INSERT OR REPLACE INTO history_events (scope,event_key,game_id,payload,size) VALUES (?,?,?,?,?)", (scope, identity, game_id, payload, len(payload.encode())))
        count, total = connection.execute("SELECT count(*),coalesce(sum(size),0) FROM history_events").fetchone()
        if count > 250000 or total > 64 * 1024 * 1024:
          connection.rollback()
          return False
        connection.execute("INSERT OR REPLACE INTO history_sync VALUES (?,?)", (scope, json.dumps(metadata, allow_nan=False)))
      return True
    except (OSError, sqlite3.Error, ValueError, TypeError):
      return False

  def reconcile_history_game(self, scope: str, game_id: str, proof: dict, verified_at: float, resource_key: str, generation: int) -> bool:
    try:
      from backend.ra_history import event_timestamp
      with closing(self._connect()) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        current = connection.execute("SELECT generation FROM resources WHERE key=?", (resource_key,)).fetchone()
        fence = connection.execute("SELECT value FROM state WHERE key=?", ("generation:" + resource_key,)).fetchone()
        if (current and current[0] > generation) or (fence and json.loads(fence[0]) > generation):
          return False
        previous = connection.execute("SELECT verified_at FROM history_game_proofs WHERE scope=? AND game_id=?", (scope, game_id)).fetchone()
        if previous and previous[0] > verified_at:
          return False
        connection.execute("INSERT OR REPLACE INTO history_game_proofs VALUES (?,?,?,?)", (scope, game_id, verified_at, json.dumps(proof)))
        proof_size = connection.execute("SELECT coalesce(sum(length(payload)),0) FROM history_game_proofs").fetchone()[0]
        if proof_size > 16 * 1024 * 1024:
          connection.rollback()
          return False
        known = set(proof["achievementIds"])
        allowed = set(proof["allowedEvents"])
        rows = connection.execute("SELECT event_key,payload FROM history_events WHERE scope=? AND game_id=?", (scope, game_id)).fetchall()
        for identity, raw in rows:
          event = json.loads(raw)
          achievement_id = str(event.get("AchievementID", event.get("achievementId")))
          if achievement_id in known and identity not in allowed and event_timestamp(event) <= verified_at:
            connection.execute("DELETE FROM history_events WHERE scope=? AND event_key=?", (scope, identity))
      return True
    except (OSError, sqlite3.Error, ValueError, TypeError):
      return False

  def read(self, key: str) -> Any:
    try:
      with closing(self._connect()) as connection, connection:
        row = connection.execute("SELECT value FROM state WHERE key=?", (key,)).fetchone()
      return json.loads(row[0]) if row else None
    except (OSError, sqlite3.Error, ValueError):
      return None

  def write_resource_state(self, resource_key: str, generation: int, key: str, value: Any) -> bool:
    try:
      with closing(self._connect()) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        fence = connection.execute("SELECT value FROM state WHERE key=?", ("generation:" + resource_key,)).fetchone()
        current = connection.execute("SELECT generation FROM resources WHERE key=?", (resource_key,)).fetchone()
        if (fence and json.loads(fence[0]) > generation) or (current and current[0] > generation):
          return False
        connection.execute("INSERT OR REPLACE INTO state VALUES (?,?)", (key, json.dumps(value)))
      return True
    except (OSError, sqlite3.Error, ValueError, TypeError):
      return False

  def write(self, key: str, value: Any) -> bool:
    try:
      serialized = json.dumps(value, allow_nan=False)
      with closing(self._connect()) as connection, connection:
        connection.execute("INSERT OR REPLACE INTO state VALUES (?,?)", (key, serialized))
        if key.startswith("failure:"):
          connection.execute("DELETE FROM state WHERE key IN (SELECT key FROM state WHERE key LIKE 'failure:%' ORDER BY rowid DESC LIMIT -1 OFFSET 128)")
      return True
    except (OSError, sqlite3.Error, ValueError, TypeError):
      return False
