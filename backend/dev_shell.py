from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from dataclasses import dataclass
from html import escape
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Mapping, Sequence, TextIO
from urllib.parse import unquote, urlsplit

from backend.local_launcher import LocalBackendRuntime, start_local_backend
from backend.local_server import LOCAL_BACKEND_HOST, LocalBackendContext
from backend.paths import BackendPaths, resolve_steamos_backend_paths


_THREAD_JOIN_TIMEOUT_SECONDS = 5.0
_RUNTIME_METADATA_PATH = "/__achievement_companion__/runtime"
_BOOTSTRAP_ASSET_PATH = "/assets/steamos-bootstrap.js"
_SHELL_MARKER = "Achievement Companion SteamOS dev shell"
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BOOTSTRAP_ASSET_BODY = (
  "\"use strict\";\n"
  "// Placeholder dev-shell bootstrap asset until a dedicated SteamOS bundle exists.\n"
  "window.__ACHIEVEMENT_COMPANION_STEAMOS_DEV_SHELL__ = true;\n"
)


class SteamOSDevShellHTTPServer(HTTPServer):
  def __init__(
    self,
    server_address: tuple[str, int],
    *,
    backend_runtime: LocalBackendRuntime | None = None,
    asset_root: Path | None = None,
  ) -> None:
    super().__init__(server_address, SteamOSDevShellRequestHandler)
    self.backend_runtime = backend_runtime
    self.asset_root = asset_root or _REPO_ROOT


@dataclass
class SteamOSDevShellRuntime:
  backend_runtime: LocalBackendRuntime
  shell_server: SteamOSDevShellHTTPServer
  shell_thread: threading.Thread

  @property
  def shell_host(self) -> str:
    return str(self.shell_server.server_address[0])

  @property
  def shell_port(self) -> int:
    return int(self.shell_server.server_address[1])

  @property
  def shell_url(self) -> str:
    return f"http://{self.shell_host}:{self.shell_port}"

  @property
  def backend_url(self) -> str:
    return self.backend_runtime.base_url

  def shutdown(self) -> None:
    self.shell_server.shutdown()
    self.shell_server.server_close()
    self.shell_thread.join(timeout=_THREAD_JOIN_TIMEOUT_SECONDS)
    self.backend_runtime.shutdown()

  def wait_forever(self) -> None:
    self.backend_runtime.wait_forever()


class SteamOSDevShellRequestHandler(BaseHTTPRequestHandler):
  server: SteamOSDevShellHTTPServer

  def log_message(self, format: str, *args: Any) -> None:
    del format, args

  def do_GET(self) -> None:
    path = self._safe_path()
    if path is None:
      self._send_json(400, {"ok": False, "error": "invalid_path"})
      return

    if path == "/":
      self._send_html(200, _build_shell_html())
      return

    if path == _BOOTSTRAP_ASSET_PATH:
      self._send_javascript(200, _load_steamos_bootstrap_asset(self.server.asset_root))
      return

    if path == _RUNTIME_METADATA_PATH:
      self._send_runtime_metadata()
      return

    self._send_json(404, {"ok": False, "error": "not_found"})

  def do_POST(self) -> None:
    self._send_method_not_allowed(("GET",))

  def do_OPTIONS(self) -> None:
    self._send_method_not_allowed(("GET",))

  def _safe_path(self) -> str | None:
    parsed_path = urlsplit(self.path).path
    decoded_path = unquote(parsed_path)
    if "\\" in decoded_path:
      return None
    if any(part == ".." for part in decoded_path.split("/")):
      return None
    return decoded_path

  def _send_runtime_metadata(self) -> None:
    runtime = self.server.backend_runtime
    if runtime is None:
      self._send_json(503, {"ok": False, "error": "backend_not_ready"})
      return

    self._send_json(
      200,
      {
        "host": runtime.host,
        "pid": os.getpid(),
        "port": runtime.port,
        "startedAt": runtime.started_at,
        "token": runtime.token,
      },
    )

  def _send_html(self, status: int, html: str) -> None:
    response = html.encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "text/html; charset=utf-8")
    self.send_header("Content-Length", str(len(response)))
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(response)

  def _send_javascript(self, status: int, body: str) -> None:
    response = body.encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/javascript; charset=utf-8")
    self.send_header("Content-Length", str(len(response)))
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(response)

  def _send_json(self, status: int, payload: Mapping[str, Any]) -> None:
    response = json.dumps(dict(payload), sort_keys=True).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(response)))
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(response)

  def _send_method_not_allowed(self, allowed_methods: tuple[str, ...]) -> None:
    self.send_response(405)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Cache-Control", "no-store")
    self.send_header("Allow", ", ".join(allowed_methods))
    self.end_headers()
    self.wfile.write(json.dumps({"ok": False, "error": "method_not_allowed"}, sort_keys=True).encode("utf-8"))


def _build_shell_html() -> str:
  marker = escape(_SHELL_MARKER)
  return (
    "<!doctype html>\n"
    "<html lang=\"en\">\n"
    "  <head>\n"
    "    <meta charset=\"utf-8\">\n"
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
    "    <title>Achievement Companion SteamOS Dev Shell</title>\n"
    "  </head>\n"
    "  <body>\n"
    f"    <div id=\"root\">{marker}</div>\n"
    f"    <script src=\"{_BOOTSTRAP_ASSET_PATH}\" defer></script>\n"
    "  </body>\n"
    "</html>\n"
  )


def _get_steamos_bootstrap_asset_path(asset_root: Path | None = None) -> Path:
  return (asset_root or _REPO_ROOT) / "dist-steamos" / "steamos-bootstrap.js"


def _load_steamos_bootstrap_asset(asset_root: Path | None = None) -> str:
  asset_path = _get_steamos_bootstrap_asset_path(asset_root)
  try:
    return asset_path.read_text(encoding="utf-8")
  except OSError:
    return _BOOTSTRAP_ASSET_BODY


def _create_shell_server(
  *,
  host: str = LOCAL_BACKEND_HOST,
  port: int = 0,
  asset_root: Path | None = None,
) -> SteamOSDevShellHTTPServer:
  if host != LOCAL_BACKEND_HOST:
    raise ValueError("SteamOS dev shell must bind to 127.0.0.1.")
  return SteamOSDevShellHTTPServer((host, port), asset_root=asset_root)


def start_steamos_dev_shell(
  *,
  env: Mapping[str, str] | None = None,
  home: Path | None = None,
  paths: BackendPaths | None = None,
  metadata_path: Path | None = None,
  shell_host: str = LOCAL_BACKEND_HOST,
  shell_port: int = 0,
  backend_port: int = 0,
  asset_root: Path | None = None,
  context: LocalBackendContext | None = None,
  cleanup_metadata: bool = True,
) -> SteamOSDevShellRuntime:
  resolved_paths = paths or (context.paths if context is not None else resolve_steamos_backend_paths(env=env, home=home))
  shell_server = _create_shell_server(host=shell_host, port=shell_port, asset_root=asset_root)
  shell_origin = f"http://{shell_server.server_address[0]}:{shell_server.server_address[1]}"

  try:
    backend_runtime = start_local_backend(
      env=env,
      home=home,
      paths=resolved_paths,
      metadata_path=metadata_path,
      port=backend_port,
      allowed_origins=(shell_origin,),
      context=context,
      cleanup_metadata=cleanup_metadata,
    )
  except Exception:
    shell_server.server_close()
    raise

  try:
    shell_server.backend_runtime = backend_runtime
    shell_thread = threading.Thread(
      target=shell_server.serve_forever,
      name="achievement-companion-steamos-dev-shell",
      daemon=True,
    )
    runtime = SteamOSDevShellRuntime(
      backend_runtime=backend_runtime,
      shell_server=shell_server,
      shell_thread=shell_thread,
    )

    shell_thread.start()
    return runtime
  except Exception:
    backend_runtime.shutdown()
    shell_server.server_close()
    raise


def run_steamos_dev_shell(
  *,
  env: Mapping[str, str] | None = None,
  home: Path | None = None,
  metadata_path: Path | None = None,
  shell_port: int = 0,
  backend_port: int = 0,
  once: bool = False,
  stdout: TextIO | None = None,
) -> int:
  output = stdout or sys.stdout
  runtime = start_steamos_dev_shell(
    env=env,
    home=home,
    metadata_path=metadata_path,
    shell_port=shell_port,
    backend_port=backend_port,
  )
  try:
    print(f"Achievement Companion SteamOS dev shell listening on {runtime.shell_url}", file=output)
    print(f"Local backend listening on {runtime.backend_url}", file=output)
    if once:
      return 0
    runtime.wait_forever()
    return 0
  except KeyboardInterrupt:
    return 0
  finally:
    runtime.shutdown()


def _build_parser() -> argparse.ArgumentParser:
  parser = argparse.ArgumentParser(
    prog="python -m backend.dev_shell",
    description="Start the Achievement Companion SteamOS dev shell.",
  )
  parser.add_argument(
    "--shell-port",
    type=int,
    default=0,
    help="Dev shell port. Defaults to 0 for an OS-assigned ephemeral port.",
  )
  parser.add_argument(
    "--backend-port",
    type=int,
    default=0,
    help="Local backend port. Defaults to 0 for an OS-assigned ephemeral port.",
  )
  parser.add_argument(
    "--metadata-path",
    type=Path,
    default=None,
    help="Runtime metadata path for tests or controlled launchers.",
  )
  parser.add_argument(
    "--once",
    action="store_true",
    help="Start, print safe status, and shut down.",
  )
  return parser


def main(argv: Sequence[str] | None = None) -> int:
  parser = _build_parser()
  args = parser.parse_args(argv)
  try:
    return run_steamos_dev_shell(
      metadata_path=args.metadata_path,
      shell_port=args.shell_port,
      backend_port=args.backend_port,
      once=args.once,
    )
  except Exception as error:
    print(f"Unable to start SteamOS dev shell: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
