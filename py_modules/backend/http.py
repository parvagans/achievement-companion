from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

from backend.redaction import redact_text as _redact_text


REQUEST_TIMEOUT_SECONDS = 20
SLOW_PROVIDER_REQUEST_LOG_THRESHOLD_MS = 2000
BACKEND_HTTP_USER_AGENT = "Achievement Companion Decky Plugin"

LogCallback = Callable[..., None]
Opener = Callable[..., Any]
SslContextProvider = Callable[[], Any]


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

  def to_diagnostic_fields(self) -> dict[str, Any]:
    fields: dict[str, Any] = {
      "providerId": self.provider_id,
      "path": self.path,
      "errorCategory": self.category,
      "durationMs": self.duration_ms,
    }
    if self.status_code is not None:
      fields["status"] = self.status_code
    return fields


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
) -> Any:
  loop = asyncio.get_running_loop()
  started_at = loop.time()
  request_url = urljoin(base_url, path)
  request_query = _request_query_items(query, auth_query)
  full_url = f"{request_url}?{urlencode(request_query, doseq=True)}" if request_query else request_url
  request = Request(
    full_url,
    headers={
      "Accept": "application/json",
      "User-Agent": BACKEND_HTTP_USER_AGENT,
    },
    method="GET",
  )

  request_opener = opener or urlopen
  ssl_context = get_ssl_context() if get_ssl_context is not None else None

  try:
    with request_opener(request, timeout=REQUEST_TIMEOUT_SECONDS, context=ssl_context) as response:
      body = response.read().decode("utf-8")
      duration_ms = int((loop.time() - started_at) * 1000)
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
    duration_ms = int((loop.time() - started_at) * 1000)

    if handled_http_statuses is not None and cause.code in handled_http_statuses:
      response_body = ""
      try:
        response_body = cause.read().decode("utf-8").strip()
      except Exception:
        response_body = ""

      return {
        "handledHttpError": True,
        "status": cause.code,
        "statusText": _redact_text(str(getattr(cause, "reason", ""))) if getattr(cause, "reason", None) else "",
        "message": _redact_text(response_body) if response_body != "" else f"HTTP {cause.code}",
        "durationMs": duration_ms,
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
    duration_ms = int((loop.time() - started_at) * 1000)
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
    duration_ms = int((loop.time() - started_at) * 1000)
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
