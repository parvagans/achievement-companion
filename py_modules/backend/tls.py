from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable


BACKEND_HTTP_CA_CANDIDATES: tuple[tuple[str, Path], ...] = (
  ("system-cert.pem", Path("/etc/ssl/cert.pem")),
  ("system-ca-certificates.crt", Path("/etc/ssl/certs/ca-certificates.crt")),
  ("system-tls-ca-bundle.pem", Path("/etc/ca-certificates/extracted/tls-ca-bundle.pem")),
)

_backend_http_ssl_context = None
_backend_http_ssl_context_source: str | None = None

LogCallback = Callable[..., None]


def sanitize_backend_runtime_environment() -> None:
  ld_library_path = os.environ.get("LD_LIBRARY_PATH")
  if ld_library_path is None:
    return

  if "/tmp/_MEI" not in ld_library_path:
    return

  os.environ.pop("LD_LIBRARY_PATH", None)


def select_backend_ca_source(
  candidates: tuple[tuple[str, Path], ...] = BACKEND_HTTP_CA_CANDIDATES,
) -> tuple[str | None, str | None]:
  for label, candidate in candidates:
    if candidate.exists():
      return str(candidate), label

  try:
    import certifi
  except Exception:
    certifi = None

  if certifi is not None:
    candidate = Path(certifi.where())
    if candidate.exists():
      return str(candidate), "certifi"

  return None, None


def get_backend_http_ssl_context(*, log: LogCallback | None = None):
  global _backend_http_ssl_context
  global _backend_http_ssl_context_source

  if _backend_http_ssl_context is not None:
    return _backend_http_ssl_context

  import ssl

  ca_file, source = select_backend_ca_source()
  if ca_file is not None:
    try:
      _backend_http_ssl_context = ssl.create_default_context(cafile=ca_file)
      _backend_http_ssl_context_source = source or ca_file
    except OSError as cause:
      if log is not None:
        log(
          "warning",
          "Unable to load backend TLS CA file",
          path=ca_file,
          error=str(cause),
        )

  if _backend_http_ssl_context is None:
    _backend_http_ssl_context = ssl.create_default_context()
    _backend_http_ssl_context_source = "default"

  return _backend_http_ssl_context


def get_backend_http_ssl_context_source() -> str:
  if _backend_http_ssl_context_source is None:
    get_backend_http_ssl_context()

  return _backend_http_ssl_context_source or "default"
