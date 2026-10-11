from __future__ import annotations

import asyncio
import io
import types
import urllib.error
import unittest

import _test_support  # noqa: F401
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
  def test_request_json_rejects_paths_that_leave_provider_before_attaching_auth(self) -> None:
    attempted: list[str] = []

    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      attempted.append(request.full_url)
      return FakeResponse(b'{"ok": true}')

    for path in (
      "https://example.invalid/capture",
      "//example.invalid/capture",
      "http://api.steampowered.com/capture",
      "/IPlayerService/GetOwnedGames/v1/",
      "../capture",
      "%2e%2e/capture",
      "IPlayerService\\GetOwnedGames\\v1",
    ):
      with self.subTest(path=path), self.assertRaises(ValueError):
        backend_http.request_json(
          provider_id="steam",
          provider_label="Steam",
          base_url="https://api.steampowered.com/",
          path=path,
          query=None,
          auth_query={"key": "synthetic-secret"},
          opener=fake_opener,
        )
    self.assertEqual(attempted, [])

  def test_redirect_handler_blocks_cross_origin_downgrade_and_other_endpoint(self) -> None:
    request_url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=synthetic-secret"
    handler = backend_http._ProviderRedirectHandler(  # type: ignore[attr-defined]
      "https://api.steampowered.com/",
      request_url,
      authenticated=True,
    )
    request = backend_http.Request(request_url)
    for location in (
      "https://example.invalid/capture",
      "//example.invalid/capture",
      "http://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
    ):
      with self.subTest(location=location), self.assertRaises(urllib.error.URLError):
        handler.redirect_request(request, None, 302, "Found", {}, location)

    same_endpoint = handler.redirect_request(
      request,
      None,
      302,
      "Found",
      {},
      "/IPlayerService/GetOwnedGames/v1/?format=json",
    )
    self.assertEqual(same_endpoint.full_url, "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?format=json")

  def test_default_opener_installs_provider_redirect_policy(self) -> None:
    original_build_opener = backend_http.build_opener
    installed_handlers: list[object] = []

    def fake_build_opener(*handlers: object) -> object:
      installed_handlers.extend(handlers)
      return types.SimpleNamespace(open=lambda request, timeout=None: FakeResponse(b'{"ok": true}'))

    backend_http.build_opener = fake_build_opener  # type: ignore[assignment]
    try:
      result = backend_http.request_json(
        provider_id="steam",
        provider_label="Steam",
        base_url="https://api.steampowered.com/",
        path="IPlayerService/GetOwnedGames/v1/",
        query=None,
        auth_query={"key": "synthetic-secret"},
      )
    finally:
      backend_http.build_opener = original_build_opener  # type: ignore[assignment]

    self.assertEqual(result, {"ok": True})
    self.assertTrue(any(isinstance(handler, backend_http._ProviderRedirectHandler) for handler in installed_handlers))  # type: ignore[attr-defined]

  def test_request_json_uses_monotonic_clock_outside_an_event_loop(self) -> None:
    def fake_opener(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
      return FakeResponse(b'{"ok": true}')

    result = backend_http.request_json(
      provider_id="steamhunters",
      provider_label="SteamHunters",
      base_url="https://steamhunters.com/api/",
      path="apps/275850",
      query=None,
      auth_query={},
      opener=fake_opener,
    )

    self.assertEqual(result, {"ok": True})

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

    clock_values = iter([0.0, backend_http.SLOW_PROVIDER_REQUEST_LOG_THRESHOLD_MS / 1000 + 1.0])
    original_elapsed_time_seconds = backend_http._elapsed_time_seconds
    backend_http._elapsed_time_seconds = lambda: next(clock_values)  # type: ignore[assignment]
    try:
      result = backend_http.request_json(
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
      backend_http._elapsed_time_seconds = original_elapsed_time_seconds  # type: ignore[assignment]
    rendered = "\n".join(f"{level} {message} {fields}" for level, message, fields in capture.records)
    self.assertEqual(result, {"ok": True})
    self.assertIn("Slow provider request", rendered)
    self.assertIn("durationMs", rendered)


if __name__ == "__main__":
  unittest.main()
