from __future__ import annotations

import json
import os
import secrets
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Iterable

from backend.diagnostics import sanitize_diagnostic_event
from backend.paths import resolve_steamos_backend_paths


LOCAL_BACKEND_HOST = "127.0.0.1"
SERVICE_NAME = "achievement-companion"
LOCAL_BACKEND_CAPABILITIES = ("health", "diagnostics")


def create_session_token() -> str:
  return secrets.token_urlsafe(32)


def resolve_runtime_metadata_path() -> Path | None:
  return resolve_steamos_backend_paths(env=os.environ).runtime_metadata_path


def write_runtime_metadata(
  path: Path,
  *,
  host: str,
  port: int,
  token: str,
  pid: int | None = None,
  started_at: str | None = None,
) -> None:
  metadata = {
    "host": host,
    "pid": os.getpid() if pid is None else pid,
    "port": port,
    "startedAt": started_at or datetime.now(timezone.utc).isoformat(),
    "token": token,
  }

  path.parent.mkdir(parents=True, exist_ok=True)
  payload = json.dumps(metadata, indent=2, sort_keys=True) + "\n"
  with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temp_file:
    temp_path = Path(temp_file.name)
    temp_file.write(payload)

  try:
    os.chmod(temp_path, 0o600)
  except OSError:
    pass

  temp_path.replace(path)
  try:
    os.chmod(path, 0o600)
  except OSError:
    pass


class LocalBackendHTTPServer(HTTPServer):
  def __init__(
    self,
    server_address: tuple[str, int],
    token: str,
    allowed_origins: Iterable[str] = (),
  ) -> None:
    super().__init__(server_address, LocalBackendRequestHandler)
    self.session_token = token
    self.allowed_origins = frozenset(allowed_origins)
    self.diagnostic_events: list[dict[str, Any]] = []


class LocalBackendRequestHandler(BaseHTTPRequestHandler):
  server: LocalBackendHTTPServer

  def log_message(self, format: str, *args: Any) -> None:
    del format, args

  def do_GET(self) -> None:
    path = self._path_without_query()
    if path == "/health":
      self._send_json(
        200,
        {
          "ok": True,
          "service": SERVICE_NAME,
          "capabilities": list(LOCAL_BACKEND_CAPABILITIES),
        },
      )
      return

    if not self._authorize_request():
      return

    self._send_json(404, {"ok": False, "error": "not_found"})

  def do_POST(self) -> None:
    if not self._authorize_request():
      return

    path = self._path_without_query()
    if path == "/record_diagnostic_event":
      self._handle_record_diagnostic_event()
      return

    self._send_json(404, {"ok": False, "error": "not_found"})

  def _handle_record_diagnostic_event(self) -> None:
    payload = self._read_json_body()
    if payload is None:
      self._send_json(400, {"ok": False, "error": "invalid_json"})
      return

    sanitized_event = sanitize_diagnostic_event(payload)
    recorded = sanitized_event is not None
    if sanitized_event is not None:
      self.server.diagnostic_events.append(sanitized_event)

    self._send_json(200, {"ok": True, "recorded": recorded})

  def _authorize_request(self) -> bool:
    origin = self.headers.get("Origin")
    if origin is not None and origin not in self.server.allowed_origins:
      self._send_json(403, {"ok": False, "error": "origin_forbidden"})
      return False

    expected_header = f"Bearer {self.server.session_token}"
    if self.headers.get("Authorization") != expected_header:
      self._send_json(401, {"ok": False, "error": "unauthorized"})
      return False

    return True

  def _read_json_body(self) -> dict[str, Any] | None:
    raw_length = self.headers.get("Content-Length", "0")
    try:
      length = max(0, int(raw_length))
    except ValueError:
      return None

    try:
      raw_body = self.rfile.read(length)
      payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
      return None

    return payload if isinstance(payload, dict) else None

  def _send_json(self, status: int, payload: dict[str, Any]) -> None:
    response = json.dumps(payload, sort_keys=True).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(response)))
    self.send_header("Cache-Control", "no-store")
    origin = self.headers.get("Origin")
    if origin is not None and origin in self.server.allowed_origins:
      self.send_header("Access-Control-Allow-Origin", origin)
      self.send_header("Vary", "Origin")
    self.end_headers()
    self.wfile.write(response)

  def _path_without_query(self) -> str:
    return self.path.split("?", 1)[0]


def create_local_backend_server(
  *,
  host: str = LOCAL_BACKEND_HOST,
  port: int = 0,
  token: str | None = None,
  allowed_origins: Iterable[str] = (),
) -> LocalBackendHTTPServer:
  if host != LOCAL_BACKEND_HOST:
    raise ValueError("Local backend server must bind to 127.0.0.1.")

  return LocalBackendHTTPServer((host, port), token or create_session_token(), allowed_origins)
