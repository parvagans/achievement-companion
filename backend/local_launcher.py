from __future__ import annotations

import argparse
import os
import sys
import threading
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence, TextIO

from backend.local_server import (
  LOCAL_BACKEND_HOST,
  LocalBackendContext,
  LocalBackendHTTPServer,
  create_local_backend_context,
  create_local_backend_server,
  create_session_token,
  write_runtime_metadata,
)
from backend.paths import BackendPaths, resolve_steamos_backend_paths


_THREAD_JOIN_TIMEOUT_SECONDS = 5.0


@dataclass
class LocalBackendRuntime:
  server: LocalBackendHTTPServer
  thread: threading.Thread
  token: str
  metadata_path: Path
  cleanup_metadata: bool = True

  @property
  def host(self) -> str:
    return str(self.server.server_address[0])

  @property
  def port(self) -> int:
    return int(self.server.server_address[1])

  @property
  def base_url(self) -> str:
    return f"http://{self.host}:{self.port}"

  def shutdown(self) -> None:
    self.server.shutdown()
    self.server.server_close()
    self.thread.join(timeout=_THREAD_JOIN_TIMEOUT_SECONDS)
    if self.cleanup_metadata:
      with suppress(FileNotFoundError):
        self.metadata_path.unlink()

  def wait_forever(self, *, poll_interval_seconds: float = 0.25) -> None:
    while self.thread.is_alive():
      time.sleep(poll_interval_seconds)


def _resolve_metadata_path(
  *,
  metadata_path: Path | None,
  paths: BackendPaths,
) -> Path:
  resolved_metadata_path = metadata_path or paths.runtime_metadata_path
  if resolved_metadata_path is None:
    raise RuntimeError(
      "XDG_RUNTIME_DIR is required for local backend runtime metadata. "
      "Pass metadata_path explicitly for tests.",
    )
  return resolved_metadata_path


def start_local_backend(
  *,
  env: Mapping[str, str] | None = None,
  home: Path | None = None,
  paths: BackendPaths | None = None,
  metadata_path: Path | None = None,
  host: str = LOCAL_BACKEND_HOST,
  port: int = 0,
  context: LocalBackendContext | None = None,
  cleanup_metadata: bool = True,
) -> LocalBackendRuntime:
  resolved_env = os.environ if env is None else env
  resolved_paths = paths or (context.paths if context is not None else resolve_steamos_backend_paths(env=resolved_env, home=home))
  resolved_metadata_path = _resolve_metadata_path(metadata_path=metadata_path, paths=resolved_paths)
  resolved_context = context or create_local_backend_context(paths=resolved_paths)
  token = create_session_token()
  server = create_local_backend_server(
    host=host,
    port=port,
    token=token,
    context=resolved_context,
  )
  thread = threading.Thread(
    target=server.serve_forever,
    name="achievement-companion-local-backend",
    daemon=True,
  )
  runtime = LocalBackendRuntime(
    server=server,
    thread=thread,
    token=token,
    metadata_path=resolved_metadata_path,
    cleanup_metadata=cleanup_metadata,
  )

  thread.start()
  try:
    write_runtime_metadata(
      resolved_metadata_path,
      host=runtime.host,
      port=runtime.port,
      pid=os.getpid(),
      token=token,
    )
  except Exception:
    runtime.shutdown()
    raise

  return runtime


def run_local_backend(
  *,
  env: Mapping[str, str] | None = None,
  home: Path | None = None,
  metadata_path: Path | None = None,
  host: str = LOCAL_BACKEND_HOST,
  port: int = 0,
  once: bool = False,
  stdout: TextIO | None = None,
) -> int:
  output = stdout or sys.stdout
  runtime = start_local_backend(
    env=env,
    home=home,
    metadata_path=metadata_path,
    host=host,
    port=port,
  )
  try:
    print(f"Achievement Companion local backend listening on {runtime.base_url}", file=output)
    print(f"Runtime metadata written to {runtime.metadata_path}", file=output)
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
    prog="python -m backend.local_launcher",
    description="Start the Achievement Companion local backend.",
  )
  parser.add_argument(
    "--host",
    default=LOCAL_BACKEND_HOST,
    help="Bind host. Only 127.0.0.1 is accepted.",
  )
  parser.add_argument(
    "--port",
    type=int,
    default=0,
    help="Bind port. Defaults to 0 for an OS-assigned ephemeral port.",
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
    help="Start, write metadata, print safe status, and shut down.",
  )
  return parser


def main(argv: Sequence[str] | None = None) -> int:
  parser = _build_parser()
  args = parser.parse_args(argv)
  try:
    return run_local_backend(
      metadata_path=args.metadata_path,
      host=args.host,
      port=args.port,
      once=args.once,
    )
  except Exception as error:
    print(f"Unable to start local backend: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
