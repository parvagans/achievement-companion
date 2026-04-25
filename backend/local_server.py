from __future__ import annotations

import json
import os
import secrets
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Iterable, Mapping

from backend.diagnostics import sanitize_diagnostic_event
from backend.paths import resolve_steamos_backend_paths


LOCAL_BACKEND_HOST = "127.0.0.1"
SERVICE_NAME = "achievement-companion"
LOCAL_BACKEND_CAPABILITIES = ("health", "diagnostics")
MAX_JSON_BODY_BYTES = 1024 * 1024


def create_session_token() -> str:
  return secrets.token_urlsafe(32)


def resolve_runtime_metadata_path(
  *,
  env: Mapping[str, str] | None = None,
) -> Path | None:
  return resolve_steamos_backend_paths(env=env or os.environ).runtime_metadata_path


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
  try:
    os.chmod(path.parent, 0o700)
  except OSError:
    pass
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

    if path == "/record_diagnostic_event":
      self._send_method_not_allowed(("POST", "OPTIONS"))
      return

    if not self._authorize_request():
      return

    self._send_json(404, {"ok": False, "error": "not_found"})

  def do_POST(self) -> None:
    path = self._path_without_query()
    if path == "/health":
      self._send_method_not_allowed(("GET",))
      return

    if not self._authorize_request():
      return

    if path == "/record_diagnostic_event":
      self._handle_record_diagnostic_event()
      return

    self._send_json(404, {"ok": False, "error": "not_found"})

  def do_OPTIONS(self) -> None:
    path = self._path_without_query()
    if path not in {"/health", "/record_diagnostic_event"}:
      self._send_json(404, {"ok": False, "error": "not_found"})
      return

    origin = self.headers.get("Origin")
    if origin is None or origin not in self.server.allowed_origins:
      self._send_json(403, {"ok": False, "error": "origin_forbidden"})
      return

    allowed_methods = ("GET", "OPTIONS") if path == "/health" else ("POST", "OPTIONS")
    self.send_response(204)
    self.send_header("Content-Length", "0")
    self.send_header("Cache-Control", "no-store")
    self.send_header("Access-Control-Allow-Origin", origin)
    self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
    self.send_header("Access-Control-Allow-Methods", ", ".join(allowed_methods))
    self.send_header("Vary", "Origin")
    self.end_headers()

  def do_DELETE(self) -> None:
    self._handle_unsupported_method()

  def do_PUT(self) -> None:
    self._handle_unsupported_method()

  def _handle_record_diagnostic_event(self) -> None:
    status, payload = self._read_json_body()
    if payload is None:
      self._send_json(status, {"ok": False, "error": self._json_error_code(status)})
      return

    sanitized_event = sanitize_diagnostic_event(payload)
    recorded = sanitized_event is not None
    if sanitized_event is not None:
      self.server.diagnostic_events.append(sanitized_event)

    self._send_json(200, {"ok": True, "recorded": recorded})

  def _authorize_request(self) -> bool:
    origin = self.headers.get("Origin")
    if origin is not None and origin not in self.server.allowed_origins:
      self._discard_announced_request_body()
      self._send_json(403, {"ok": False, "error": "origin_forbidden"})
      return False

    provided_token = self._parse_bearer_token(self.headers.get("Authorization"))
    if provided_token != self.server.session_token:
      self._discard_announced_request_body()
      self._send_json(401, {"ok": False, "error": "unauthorized"})
      return False

    return True

  def _read_json_body(self) -> tuple[int, dict[str, Any] | None]:
    content_type = self.headers.get("Content-Type")
    if content_type is None:
      return 415, None
    normalized_content_type = content_type.split(";", 1)[0].strip().lower()
    if normalized_content_type != "application/json":
      return 415, None

    raw_length = self.headers.get("Content-Length", "0")
    try:
      length = int(raw_length)
    except ValueError:
      return 400, None
    if length <= 0:
      return 400, None
    if length > MAX_JSON_BODY_BYTES:
      self._discard_request_body(length)
      return 413, None

    try:
      raw_body = self.rfile.read(length)
      payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
      return 400, None

    return (200, payload) if isinstance(payload, dict) else (400, None)

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

  def _discard_request_body(self, length: int) -> None:
    remaining = length
    while remaining > 0:
      chunk = self.rfile.read(min(remaining, 65536))
      if not chunk:
        break
      remaining -= len(chunk)

  def _discard_announced_request_body(self) -> None:
    raw_length = self.headers.get("Content-Length")
    if raw_length is None:
      return
    try:
      length = int(raw_length)
    except ValueError:
      return
    if length > 0:
      self._discard_request_body(length)

  def _handle_unsupported_method(self) -> None:
    path = self._path_without_query()
    if path == "/health":
      self._send_method_not_allowed(("GET", "OPTIONS"))
      return
    if path == "/record_diagnostic_event":
      self._send_method_not_allowed(("POST", "OPTIONS"))
      return
    self._send_json(404, {"ok": False, "error": "not_found"})

  def _send_method_not_allowed(self, allowed_methods: Iterable[str]) -> None:
    self.send_response(405)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Cache-Control", "no-store")
    self.send_header("Allow", ", ".join(allowed_methods))
    self.end_headers()
    self.wfile.write(json.dumps({"ok": False, "error": "method_not_allowed"}, sort_keys=True).encode("utf-8"))

  @staticmethod
  def _parse_bearer_token(authorization_header: str | None) -> str | None:
    if authorization_header is None:
      return None
    if authorization_header.count(" ") != 1:
      return None
    scheme, token = authorization_header.split(" ", 1)
    if scheme != "Bearer" or token == "":
      return None
    return token

  @staticmethod
  def _json_error_code(status: int) -> str:
    if status == 413:
      return "payload_too_large"
    if status == 415:
      return "unsupported_media_type"
    return "invalid_json"


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
