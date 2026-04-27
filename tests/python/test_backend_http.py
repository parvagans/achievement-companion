from __future__ import annotations

import asyncio
import io
import types
import urllib.error
import unittest

from backend import http as backend_http


class CapturingLogger:
  def __init__(self) -> None:
    self.records: list[tuple[str, str, dict[str, object]]] = []

  def __call__(self, level: str, message: str, **fields: object) -> None:
    self.records.append((level, message, fields))


class FakeResponse:
  def __init__(self, body: bytes) -> None:
    self._body = body

  def __enter__(self) -> "FakeResponse":
    return self

  def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001, ANN002, ANN003
    return False

  def read(self) -> bytes:
    return self._body


class FakeLoop:
  def __init__(self, times: list[float]) -> None:
    self._times = times

  def time(self) -> float:
    if len(self._times) > 1:
      return self._times.pop(0)
    return self._times[0]


class BackendHttpTests(unittest.TestCase):
  def test_request_json_uses_injected_opener_and_returns_json(self) -> None:
    calls: list[tuple[str, int | None, object | None]] = []

    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      calls.append((request.full_url, timeout, context))
      return FakeResponse(b'{"ok": true, "count": 3}')

    async def invoke() -> dict[str, object]:
      original_get_running_loop = backend_http.asyncio.get_running_loop
      backend_http.asyncio.get_running_loop = lambda: FakeLoop([0.0, 0.01])  # type: ignore[assignment]
      try:
        return backend_http.request_json(
          provider_id="steam",
          provider_label="Steam",
          base_url="https://api.steampowered.com/",
          path="IPlayerService/GetOwnedGames/v1/",
          query={"language": "english"},
          auth_query={"steamid": "123", "key": "secret"},
          opener=fake_opener,
          get_ssl_context=lambda: types.SimpleNamespace(name="context"),
        )
      finally:
        backend_http.asyncio.get_running_loop = original_get_running_loop  # type: ignore[assignment]

    result = asyncio.run(invoke())
    self.assertEqual(result, {"ok": True, "count": 3})
    self.assertEqual(len(calls), 1)
    self.assertIn("IPlayerService/GetOwnedGames/v1/", calls[0][0])
    self.assertEqual(calls[0][1], backend_http.REQUEST_TIMEOUT_SECONDS)
    self.assertEqual(getattr(calls[0][2], "name", None), "context")

  def test_request_json_invalid_json_raises_safe_runtime_error(self) -> None:
    capture = CapturingLogger()

    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      return FakeResponse(b'{"apiKey":"secret","steamid":"123"')

    async def invoke() -> None:
      original_get_running_loop = backend_http.asyncio.get_running_loop
      backend_http.asyncio.get_running_loop = lambda: FakeLoop([0.0, 0.01])  # type: ignore[assignment]
      try:
        backend_http.request_json(
          provider_id="steam",
          provider_label="Steam",
          base_url="https://api.steampowered.com/",
          path="IPlayerService/GetOwnedGames/v1/",
          query={"language": "english", "key": "secret"},
          auth_query={"steamid": "123", "key": "secret"},
          opener=fake_opener,
          log=capture,
        )
      finally:
        backend_http.asyncio.get_running_loop = original_get_running_loop  # type: ignore[assignment]

    with self.assertRaises(backend_http.ProviderRequestError) as context:
      asyncio.run(invoke())
    error = context.exception
    rendered = "\n".join(f"{level} {message} {fields}" for level, message, fields in capture.records)
    self.assertEqual(error.category, "invalid_json")
    self.assertEqual(error.provider_id, "steam")
    self.assertEqual(error.path, "IPlayerService/GetOwnedGames/v1/")
    self.assertIsNone(error.status_code)
    self.assertIn("returned invalid JSON", str(error))
    self.assertIn("Steam response decode failed", rendered)
    self.assertIn("errorCategory", rendered)
    self.assertIn("durationMs", rendered)
    self.assertNotIn("apiKey", rendered)
    self.assertNotIn("secret", rendered)
    self.assertNotIn("steamid", rendered)

  def test_request_json_network_error_raises_safe_provider_request_error(self) -> None:
    capture = CapturingLogger()

    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      raise urllib.error.URLError("network down secret")

    async def invoke() -> None:
      original_get_running_loop = backend_http.asyncio.get_running_loop
      backend_http.asyncio.get_running_loop = lambda: FakeLoop([0.0, 0.01])  # type: ignore[assignment]
      try:
        backend_http.request_json(
          provider_id="steam",
          provider_label="Steam",
          base_url="https://api.steampowered.com/",
          path="IPlayerService/GetOwnedGames/v1/",
          query={"language": "english", "key": "secret"},
          auth_query={"steamid": "123", "key": "secret"},
          opener=fake_opener,
          log=capture,
        )
      finally:
        backend_http.asyncio.get_running_loop = original_get_running_loop  # type: ignore[assignment]

    with self.assertRaises(backend_http.ProviderRequestError) as context:
      asyncio.run(invoke())
    error = context.exception
    self.assertEqual(error.category, "network_error")
    self.assertEqual(error.provider_id, "steam")
    self.assertEqual(error.path, "IPlayerService/GetOwnedGames/v1/")
    self.assertIsNone(error.status_code)
    self.assertIn("network", str(error))

    rendered = "\n".join(f"{level} {message} {fields}" for level, message, fields in capture.records)
    self.assertIn("Steam request failed", rendered)
    self.assertIn("errorCategory", rendered)
    self.assertIn("durationMs", rendered)
    self.assertNotIn("secret", rendered)
    self.assertNotIn("steamid", rendered)

  def test_request_json_unhandled_http_error_logs_safe_fields(self) -> None:
    capture = CapturingLogger()

    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      raise urllib.error.HTTPError(
        url=request.full_url,
        code=500,
        msg="Internal Server Error",
        hdrs=None,
        fp=io.BytesIO(b"boom secret"),
      )

    async def invoke() -> None:
      original_get_running_loop = backend_http.asyncio.get_running_loop
      backend_http.asyncio.get_running_loop = lambda: FakeLoop([0.0, 0.01])  # type: ignore[assignment]
      try:
        backend_http.request_json(
          provider_id="steam",
          provider_label="Steam",
          base_url="https://api.steampowered.com/",
          path="IPlayerService/GetOwnedGames/v1/",
          query={"language": "english", "key": "secret"},
          auth_query={"steamid": "123", "key": "secret"},
          opener=fake_opener,
          log=capture,
        )
      finally:
        backend_http.asyncio.get_running_loop = original_get_running_loop  # type: ignore[assignment]

    with self.assertRaises(backend_http.ProviderRequestError) as context:
      asyncio.run(invoke())
    error = context.exception
    rendered = "\n".join(f"{level} {message} {fields}" for level, message, fields in capture.records)
    self.assertEqual(error.category, "http_error")
    self.assertEqual(error.status_code, 500)
    self.assertEqual(error.provider_id, "steam")
    self.assertEqual(error.path, "IPlayerService/GetOwnedGames/v1/")
    self.assertIn("Steam request failed", rendered)
    self.assertIn("providerId", rendered)
    self.assertIn("path", rendered)
    self.assertIn("errorCategory", rendered)
    self.assertIn("status", rendered)
    self.assertIn("durationMs", rendered)
    self.assertNotIn("secret", rendered)
    self.assertNotIn("steamid", rendered)

  def test_request_json_handled_http_error_returns_safe_envelope(self) -> None:
    capture = CapturingLogger()

    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      raise urllib.error.HTTPError(
        url=request.full_url,
        code=403,
        msg="Forbidden",
        hdrs=None,
        fp=io.BytesIO(b"Access denied apiKey=secret"),
      )

    async def invoke() -> dict[str, object]:
      original_get_running_loop = backend_http.asyncio.get_running_loop
      backend_http.asyncio.get_running_loop = lambda: FakeLoop([0.0, 0.01])  # type: ignore[assignment]
      try:
        return backend_http.request_json(
          provider_id="steam",
          provider_label="Steam",
          base_url="https://api.steampowered.com/",
          path="IPlayerService/GetOwnedGames/v1/",
          query={"language": "english", "key": "secret"},
          auth_query={"steamid": "123", "key": "secret"},
          handled_http_statuses={403},
          opener=fake_opener,
          log=capture,
        )
      finally:
        backend_http.asyncio.get_running_loop = original_get_running_loop  # type: ignore[assignment]

    result = asyncio.run(invoke())
    rendered = "\n".join(f"{level} {message} {fields}" for level, message, fields in capture.records)
    self.assertEqual(result["handledHttpError"], True)
    self.assertEqual(result["status"], 403)
    self.assertEqual(result["statusText"], "Forbidden")
    self.assertNotIn("errorCategory", rendered)
    self.assertNotIn("secret", rendered)
    self.assertNotIn("warning", rendered)

  def test_request_json_logs_slow_requests(self) -> None:
    capture = CapturingLogger()

    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      return FakeResponse(b'{"ok": true}')

    async def invoke() -> dict[str, object]:
      original_get_running_loop = backend_http.asyncio.get_running_loop
      backend_http.asyncio.get_running_loop = lambda: FakeLoop([0.0, backend_http.SLOW_PROVIDER_REQUEST_LOG_THRESHOLD_MS / 1000 + 1.0])  # type: ignore[assignment]
      try:
        return backend_http.request_json(
          provider_id="steam",
          provider_label="Steam",
          base_url="https://api.steampowered.com/",
          path="IPlayerService/GetOwnedGames/v1/",
          query=None,
          auth_query={},
          opener=fake_opener,
          log=capture,
        )
      finally:
        backend_http.asyncio.get_running_loop = original_get_running_loop  # type: ignore[assignment]

    result = asyncio.run(invoke())
    rendered = "\n".join(f"{level} {message} {fields}" for level, message, fields in capture.records)
    self.assertEqual(result, {"ok": True})
    self.assertIn("Slow provider request", rendered)
    self.assertIn("durationMs", rendered)


if __name__ == "__main__":
  unittest.main()
