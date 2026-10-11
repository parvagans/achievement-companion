from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

from backend.redaction import redact_text as _redact_text


REQUEST_TIMEOUT_SECONDS = 20
SLOW_PROVIDER_REQUEST_LOG_THRESHOLD_MS = 2000
BACKEND_HTTP_USER_AGENT = "Achievement Companion Decky Plugin"

LogCallback = Callable[..., None]
Opener = Callable[..., Any]
SslContextProvider = Callable[[], Any]


def _https_origin(url: str) -> tuple[str, int]:
  parsed = urlsplit(url)
  if parsed.scheme != "https" or parsed.hostname is None or parsed.username is not None or parsed.password is not None:
    raise ValueError("Provider requests require an HTTPS origin.")
  try:
    return parsed.hostname.lower(), parsed.port or 443
  except ValueError as cause:
    raise ValueError("Provider requests require a valid HTTPS origin.") from cause


def _resolve_provider_url(base_url: str, path: str) -> str:
  base = urlsplit(base_url)
  base_origin = _https_origin(base_url)
  relative = urlsplit(path)
  if (
    not path or path.startswith("/") or relative.scheme or relative.netloc or relative.fragment
    or "\\" in path or "%" in relative.path
    or any(character.isspace() or ord(character) < 32 for character in path)
    or any(segment in (".", "..") for segment in relative.path.split("/"))
  ):
    raise ValueError("Provider request path is invalid.")

  resolved = urljoin(base_url, path)
  target = urlsplit(resolved)
  if _https_origin(resolved) != base_origin or not target.path.startswith(base.path):
    raise ValueError("Provider request path is outside the provider API.")
  return resolved


class _ProviderRedirectHandler(HTTPRedirectHandler):
  def __init__(self, base_url: str, request_path: str, *, authenticated: bool) -> None:
    self._base_origin = _https_origin(base_url)
    self._base_path = urlsplit(base_url).path
    self._request_path = urlsplit(request_path).path
    self._authenticated = authenticated

  def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
    target = urljoin(req.full_url, newurl)
    parsed = urlsplit(target)
    try:
      if (
        _https_origin(target) != self._base_origin
        or not parsed.path.startswith(self._base_path)
        or (self._authenticated and parsed.path != self._request_path)
      ):
        raise ValueError("Unsafe provider redirect")
    except ValueError as cause:
      # urllib follows redirects automatically; reject before it can issue a second request.
      raise URLError("Provider redirect left its allowed HTTPS endpoint.") from cause
    return super().redirect_request(req, fp, code, msg, headers, target)


def _elapsed_time_seconds() -> float:
  try:
    return asyncio.get_running_loop().time()
  except RuntimeError:
    # Backend request callables use a worker thread so Decky's event loop stays responsive.
    return time.monotonic()


@dataclass(frozen=True)
class ProviderRequestError(RuntimeError):
  provider_id: str
  provider_label: str
  path: str
  category: str
  duration_ms: int
  status_code: int | None = None

  def __init__(
    self,
    *,
    provider_id: str,
    provider_label: str,
    path: str,
    category: str,
    duration_ms: int,
    status_code: int | None = None,
    message: str | None = None,
  ) -> None:
    resolved_message = (
      message
      if message is not None
      else f"{provider_label} request failed with {category.replace('_', ' ')}."
    )
    super().__init__(resolved_message)
    object.__setattr__(self, "provider_id", provider_id)
    object.__setattr__(self, "provider_label", provider_label)
    object.__setattr__(self, "path", path)
    object.__setattr__(self, "category", category)
    object.__setattr__(self, "duration_ms", duration_ms)
    object.__setattr__(self, "status_code", status_code)

def _request_query_items(query: Mapping[str, Any] | None, auth_query: Mapping[str, Any]) -> dict[str, Any]:
  request_query: dict[str, Any] = {}
  if query is not None:
    for key, value in query.items():
      if value is not None:
        request_query[key] = value
  for key, value in auth_query.items():
    if value is not None:
      request_query[key] = value
  return request_query


def request_json(
  *,
  provider_id: str,
  provider_label: str,
  base_url: str,
  path: str,
  query: Mapping[str, Any] | None,
  auth_query: Mapping[str, Any],
  handled_http_statuses: set[int] | None = None,
  log: LogCallback | None = None,
  get_ssl_context: SslContextProvider | None = None,
  opener: Opener | None = None,
  timeout_seconds: int = REQUEST_TIMEOUT_SECONDS,
) -> Any:
  started_at = _elapsed_time_seconds()
  request_url = _resolve_provider_url(base_url, path)
  request_query = _request_query_items(query, auth_query)
  query_separator = "&" if urlsplit(request_url).query else "?"
  full_url = f"{request_url}{query_separator}{urlencode(request_query, doseq=True)}" if request_query else request_url
  request = Request(
    full_url,
    headers={
      "Accept": "application/json",
      "User-Agent": BACKEND_HTTP_USER_AGENT,
    },
    method="GET",
  )

  ssl_context = get_ssl_context() if get_ssl_context is not None else None
  if opener is None:
    redirect_handler = _ProviderRedirectHandler(base_url, request_url, authenticated=bool(auth_query))
    safe_opener = build_opener(redirect_handler, HTTPSHandler(context=ssl_context))
    request_opener = lambda request, timeout, context: safe_opener.open(request, timeout=timeout)
  else:
    request_opener = opener

  try:
    with request_opener(request, timeout=timeout_seconds, context=ssl_context) as response:
      body = response.read().decode("utf-8")
      duration_ms = int((_elapsed_time_seconds() - started_at) * 1000)
      if duration_ms >= SLOW_PROVIDER_REQUEST_LOG_THRESHOLD_MS and log is not None:
        log(
          "info",
          "Slow provider request",
          providerId=provider_id,
          path=path,
          durationMs=duration_ms,
        )
      if body.strip() == "":
        return None
      return json.loads(body)
  except HTTPError as cause:
    duration_ms = int((_elapsed_time_seconds() - started_at) * 1000)

    if handled_http_statuses is not None and cause.code in handled_http_statuses:
      response_body = ""
      try:
        response_body = cause.read().decode("utf-8").strip()
      except Exception:
        response_body = ""

      retry_after_ms: int | None = None
      retry_after = cause.headers.get("Retry-After") if cause.headers is not None else None
      if retry_after is not None:
        try:
          retry_after_ms = max(0, int(float(retry_after) * 1000))
        except (TypeError, ValueError):
          retry_after_ms = None

      return {
        "handledHttpError": True,
        "status": cause.code,
        "statusText": _redact_text(str(getattr(cause, "reason", ""))) if getattr(cause, "reason", None) else "",
        "message": _redact_text(response_body) if response_body != "" else f"HTTP {cause.code}",
        "durationMs": duration_ms,
        **({"retryAfterMs": retry_after_ms} if retry_after_ms is not None else {}),
      }

    if log is not None:
      log(
        "warning",
        f"{provider_label} request failed",
        providerId=provider_id,
        path=path,
        errorCategory="http_error",
        status=getattr(cause, "code", None),
        durationMs=duration_ms,
      )
    raise ProviderRequestError(
      provider_id=provider_id,
      provider_label=provider_label,
      path=path,
      category="http_error",
      duration_ms=duration_ms,
      status_code=getattr(cause, "code", None),
      message=f"{provider_label} request failed with HTTP {getattr(cause, 'code', 'unknown')}.",
    ) from cause
  except URLError as cause:
    duration_ms = int((_elapsed_time_seconds() - started_at) * 1000)
    if log is not None:
      log(
        "warning",
        f"{provider_label} request failed",
        providerId=provider_id,
        path=path,
        errorCategory="network_error",
        durationMs=duration_ms,
      )
    raise ProviderRequestError(
      provider_id=provider_id,
      provider_label=provider_label,
      path=path,
      category="network_error",
      duration_ms=duration_ms,
      message=f"{provider_label} request failed due to a network error.",
    ) from cause
  except json.JSONDecodeError as cause:
    duration_ms = int((_elapsed_time_seconds() - started_at) * 1000)
    if log is not None:
      log(
        "warning",
        f"{provider_label} response decode failed",
        providerId=provider_id,
        path=path,
        errorCategory="invalid_json",
        durationMs=duration_ms,
      )
    raise ProviderRequestError(
      provider_id=provider_id,
      provider_label=provider_label,
      path=path,
      category="invalid_json",
      duration_ms=duration_ms,
      message=f"{provider_label} returned invalid JSON.",
    ) from cause
