from __future__ import annotations

import asyncio
import base64
import importlib.util
import json
import os
import io
import backend.http as backend_http
import backend.tls as backend_tls
import urllib.error
import urllib.request
import ssl
import sys
import tempfile
import types
import unittest
import uuid
import zipfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT_DIR = ROOT_DIR / "scripts"
if str(SCRIPT_DIR) not in sys.path:
  sys.path.insert(0, str(SCRIPT_DIR))

import package_release  # type: ignore  # noqa: E402


class FakeDeckyLogger:
  def info(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    return

  def warning(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    return

  def error(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    return


class CapturingDeckyLogger:
  def __init__(self) -> None:
    self.records: list[tuple[str, str]] = []

  def _capture(self, level: str, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    message = args[0] if args else ""
    if len(args) > 1:
      try:
        message = message % args[1:]
      except Exception:
        message = " ".join(str(arg) for arg in args)
    self.records.append((level, str(message)))

  def info(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    self._capture("info", *args, **kwargs)

  def warning(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    self._capture("warning", *args, **kwargs)

  def error(self, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
    self._capture("error", *args, **kwargs)


FAKE_DECKY = types.SimpleNamespace(
  DECKY_PLUGIN_SETTINGS_DIR="",
  logger=FakeDeckyLogger(),
)
sys.modules["decky"] = FAKE_DECKY


def load_main_module(settings_dir: Path) -> types.ModuleType:
  FAKE_DECKY.DECKY_PLUGIN_SETTINGS_DIR = str(settings_dir)
  module_name = f"achievement_companion_main_{uuid.uuid4().hex}"
  spec = importlib.util.spec_from_file_location(module_name, ROOT_DIR / "main.py")
  if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load main.py.")

  module = importlib.util.module_from_spec(spec)
  sys.modules[module_name] = module
  spec.loader.exec_module(module)
  return module


def write_legacy_secret_record(module: types.ModuleType, provider_key: str, api_key: str) -> None:
  payload = base64.urlsafe_b64encode(json.dumps({"apiKey": api_key}).encode("utf-8")).decode("ascii")
  module._write_json_file(  # type: ignore[attr-defined]
    module.SECRETS_PATH,
    {
      "version": 1,
      provider_key: {
        "version": 1,
        "payload": payload,
      },
    },
  )


def write_malformed_text(path: Path, text: str) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(text, encoding="utf-8")


class BackendRuntimeTests(unittest.TestCase):
  def test_storage_paths_follow_temporary_root_and_valid_files_stay_quiet(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      module = load_main_module(Path(temp_dir))
      module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]

      self.assertEqual(module.SETTINGS_PATH, Path(temp_dir))  # type: ignore[attr-defined]
      self.assertEqual(module.CONFIG_PATH.parent, Path(temp_dir))  # type: ignore[attr-defined]
      self.assertEqual(module.SECRETS_PATH.parent, Path(temp_dir))  # type: ignore[attr-defined]

      module._write_json_file(  # type: ignore[attr-defined]
        module.CONFIG_PATH,
        {
          "version": 1,
          "retroAchievements": {
            "username": "alice",
            "hasApiKey": True,
            "recentAchievementsCount": 10,
            "recentlyPlayedCount": 7,
          },
        },
      )
      module._save_secret_api_key("retroAchievements", "ra-secret")  # type: ignore[attr-defined]

      provider_configs = asyncio.run(module.Plugin().get_provider_configs())

      self.assertEqual(provider_configs["retroAchievements"]["username"], "alice")
      self.assertEqual(provider_configs["retroAchievements"]["hasApiKey"], True)
      self.assertEqual(provider_configs["retroAchievements"]["recentAchievementsCount"], 10)
      self.assertEqual(provider_configs["retroAchievements"]["recentlyPlayedCount"], 7)
      self.assertEqual(list(Path(temp_dir).glob("provider-config.json.corrupt-*")), [])
      self.assertEqual(list(Path(temp_dir).glob("provider-secrets.json.corrupt-*")), [])

  def test_corrupt_backup_path_stays_in_same_directory(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      module = load_main_module(Path(temp_dir))
      backup_path = module._build_corrupt_backup_path(module.CONFIG_PATH)  # type: ignore[attr-defined]

      self.assertEqual(backup_path.parent, module.CONFIG_PATH.parent)  # type: ignore[attr-defined]
      self.assertTrue(backup_path.name.startswith("provider-config.json.corrupt-"))
      self.assertIn(".corrupt-", backup_path.name)

  def test_legacy_secret_migrates_to_protected_record(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      module = load_main_module(Path(temp_dir))
      module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]
      write_legacy_secret_record(module, "retroAchievements", "ra-secret")

      self.assertEqual(module._load_secret_api_key("retroAchievements"), "ra-secret")  # type: ignore[attr-defined]

      secrets_text = module.SECRETS_PATH.read_text(encoding="utf-8")  # type: ignore[attr-defined]
      self.assertNotIn('"payload"', secrets_text)
      self.assertNotIn('"apiKey"', secrets_text)

      secrets_json = json.loads(secrets_text)
      self.assertEqual(secrets_json["version"], 2)
      self.assertEqual(secrets_json["retroAchievements"]["version"], 2)
      self.assertEqual(secrets_json["retroAchievements"]["scheme"], "local-obfuscation-v1")
      self.assertEqual(module._load_secret_api_key("retroAchievements"), "ra-secret")  # type: ignore[attr-defined]

  def test_new_secret_record_is_not_base64_json(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      module = load_main_module(Path(temp_dir))
      module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]

      module._save_secret_api_key("steam", "steam-secret")  # type: ignore[attr-defined]

      secrets_text = module.SECRETS_PATH.read_text(encoding="utf-8")  # type: ignore[attr-defined]
      self.assertNotIn('"payload"', secrets_text)
      self.assertNotIn('"apiKey"', secrets_text)
      self.assertIn('"ciphertext"', secrets_text)

      self.assertEqual(module._load_secret_api_key("steam"), "steam-secret")  # type: ignore[attr-defined]

  def test_retroachievements_credentials_save_persists_counts(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      module = load_main_module(Path(temp_dir))
      module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]

      plugin = module.Plugin()
      saved_config = asyncio.run(
        plugin.save_retroachievements_credentials(
          {
            "username": "alice",
            "apiKeyDraft": "ra-secret",
            "recentAchievementsCount": 10,
            "recentlyPlayedCount": 7,
          },
        ),
      )

      self.assertEqual(saved_config["username"], "alice")
      self.assertEqual(saved_config["hasApiKey"], True)
      self.assertEqual(saved_config["recentAchievementsCount"], 10)
      self.assertEqual(saved_config["recentlyPlayedCount"], 7)

      provider_configs = asyncio.run(plugin.get_provider_configs())
      self.assertEqual(
        provider_configs["retroAchievements"],
        {
          "username": "alice",
          "hasApiKey": True,
          "recentAchievementsCount": 10,
          "recentlyPlayedCount": 7,
        },
      )

      config_text = module.CONFIG_PATH.read_text(encoding="utf-8")  # type: ignore[attr-defined]
      self.assertIn('"recentAchievementsCount": 10', config_text)
      self.assertIn('"recentlyPlayedCount": 7', config_text)
      self.assertNotIn('"apiKey"', config_text)
      self.assertEqual(list(Path(temp_dir).glob("provider-config.json.corrupt-*")), [])

      fallback_view = module._build_retroachievements_config_view(  # type: ignore[attr-defined]
        {"username": "alice", "hasApiKey": True},
        True,
      )
      self.assertEqual(
        fallback_view,
        {
          "username": "alice",
          "hasApiKey": True,
        },
      )

  def test_backend_log_redaction_masks_secret_like_fields_and_urls(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      try:
        module = load_main_module(Path(temp_dir))
        module._log(  # type: ignore[attr-defined]
          "info",
          "Credentials and URLs apiKey=yikes",
          apiKey="alpha",
          apiKeyDraft="beta",
          key="gamma",
          y="delta",
          token="epsilon",
          password="zeta",
          secret="eta",
          Authorization="Bearer theta",
          url="https://example.invalid/path?key=abc123&y=def456",
        )
      finally:
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertNotIn("alpha", rendered)
      self.assertNotIn("beta", rendered)
      self.assertNotIn("gamma", rendered)
      self.assertNotIn("delta", rendered)
      self.assertNotIn("epsilon", rendered)
      self.assertNotIn("zeta", rendered)
      self.assertNotIn("eta", rendered)
      self.assertNotIn("theta", rendered)
      self.assertNotIn("key=abc123", rendered)
      self.assertNotIn("y=def456", rendered)
      self.assertIn("[redacted]", rendered)

  def test_backend_diagnostic_event_redacts_secret_like_fields_and_urls(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      try:
        module = load_main_module(Path(temp_dir))
        module._record_diagnostic_event(  # type: ignore[attr-defined]
          {
            "event": "steam_library_scan_started",
            "providerId": "steam",
            "ownedGameCount": 5,
            "apiKey": "alpha",
            "apiKeyDraft": "beta",
            "key": "gamma",
            "y": "delta",
            "token": "epsilon",
            "password": "zeta",
            "secret": "eta",
            "Authorization": "Bearer theta",
            "url": "https://example.invalid/path?key=abc123&y=def456",
            "ignored": "still ignored",
          },
        )
      finally:
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertIn("Steam library scan started", rendered)
      self.assertIn('"ownedGameCount":5', rendered)
      self.assertNotIn("alpha", rendered)
      self.assertNotIn("beta", rendered)
      self.assertNotIn("gamma", rendered)
      self.assertNotIn("delta", rendered)
      self.assertNotIn("epsilon", rendered)
      self.assertNotIn("zeta", rendered)
      self.assertNotIn("eta", rendered)
      self.assertNotIn("theta", rendered)
      self.assertNotIn("ignored", rendered)
      self.assertNotIn("key=abc123", rendered)
      self.assertNotIn("y=def456", rendered)

  def test_malformed_provider_config_is_quarantined_and_recovers_safely(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      try:
        module = load_main_module(Path(temp_dir))
        write_malformed_text(
          module.CONFIG_PATH,  # type: ignore[attr-defined]
          '{"version":1,"retroAchievements":{"username":"alice","hasApiKey":true',
        )

        provider_configs = asyncio.run(module.Plugin().get_provider_configs())
      finally:
        FAKE_DECKY.logger = original_logger

      backup_files = list(Path(temp_dir).glob("provider-config.json.corrupt-*"))
      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertEqual(provider_configs, {"version": 1})
      self.assertEqual(len(backup_files), 1)
      self.assertFalse(module.CONFIG_PATH.exists())  # type: ignore[attr-defined]
      self.assertIn("Recovered malformed plugin state file", rendered)
      self.assertNotIn("alice", rendered)
      self.assertNotIn("hasApiKey", rendered)

  def test_malformed_provider_secrets_is_quarantined_and_reports_no_secrets(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      try:
        module = load_main_module(Path(temp_dir))
        write_malformed_text(
          module.SECRETS_PATH,  # type: ignore[attr-defined]
          '{"version":2,"retroAchievements":{"version":2,"scheme":"local-obfuscation-v1","salt":"oops"',
        )
        module._write_json_file(  # type: ignore[attr-defined]
          module.CONFIG_PATH,
          {
            "version": 1,
            "retroAchievements": {
              "username": "alice",
              "hasApiKey": True,
              "recentAchievementsCount": 10,
              "recentlyPlayedCount": 7,
            },
          },
        )

        provider_configs = asyncio.run(module.Plugin().get_provider_configs())
      finally:
        FAKE_DECKY.logger = original_logger

      backup_files = list(Path(temp_dir).glob("provider-secrets.json.corrupt-*"))
      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertEqual(len(backup_files), 1)
      self.assertIn("Recovered malformed plugin state file", rendered)
      self.assertNotIn("oops", rendered)
      self.assertEqual(provider_configs["retroAchievements"]["username"], "alice")
      self.assertEqual(provider_configs["retroAchievements"]["recentAchievementsCount"], 10)
      self.assertEqual(provider_configs["retroAchievements"]["recentlyPlayedCount"], 7)
      self.assertEqual(provider_configs["retroAchievements"]["hasApiKey"], False)

  def test_malformed_provider_config_quarantine_failure_falls_back_safely(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      original_replace = Path.replace
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger

      def failing_replace(self: Path, target: Path) -> Path:  # noqa: ANN001
        raise OSError("quarantine failed")

      Path.replace = failing_replace  # type: ignore[assignment]
      try:
        module = load_main_module(Path(temp_dir))
        write_malformed_text(
          module.CONFIG_PATH,  # type: ignore[attr-defined]
          '{"version":1,"steam":{"steamId64":"123","hasApiKey":true',
        )

        provider_configs = asyncio.run(module.Plugin().get_provider_configs())
      finally:
        Path.replace = original_replace  # type: ignore[assignment]
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertEqual(provider_configs, {"version": 1})
      self.assertIn("Unable to quarantine malformed plugin state file", rendered)
      self.assertNotIn("steamId64", rendered)

  def test_save_after_corrupted_secret_recovery_writes_fresh_valid_secret_file(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      module = load_main_module(Path(temp_dir))
      module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]
      write_malformed_text(
        module.SECRETS_PATH,  # type: ignore[attr-defined]
        '{"version":2,"steam":{"version":2,"scheme":"local-obfuscation-v1","salt":"oops"',
      )

      plugin = module.Plugin()
      saved_config = asyncio.run(
        plugin.save_steam_credentials(
          {
            "steamId64": "1234567890",
            "apiKeyDraft": "steam-secret",
            "language": "english",
            "recentAchievementsCount": 3,
            "recentlyPlayedCount": 4,
            "includePlayedFreeGames": True,
          },
        ),
      )

      secrets_text = module.SECRETS_PATH.read_text(encoding="utf-8")  # type: ignore[attr-defined]
      config_text = module.CONFIG_PATH.read_text(encoding="utf-8")  # type: ignore[attr-defined]
      self.assertEqual(saved_config["hasApiKey"], True)
      self.assertIn('"version": 2', secrets_text)
      self.assertIn('"scheme": "local-obfuscation-v1"', secrets_text)
      self.assertNotIn('"apiKey"', secrets_text)
      self.assertNotIn("steam-secret", secrets_text)
      self.assertNotIn('"apiKey"', config_text)
      self.assertIn('"steamId64": "1234567890"', config_text)

  def test_save_after_corrupted_config_recovery_writes_fresh_valid_config_file(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      module = load_main_module(Path(temp_dir))
      module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]
      write_malformed_text(
        module.CONFIG_PATH,  # type: ignore[attr-defined]
        '{"version":1,"steam":{"steamId64":"123","hasApiKey":true',
      )

      plugin = module.Plugin()
      saved_config = asyncio.run(
        plugin.save_retroachievements_credentials(
          {
            "username": "alice",
            "apiKeyDraft": "ra-secret",
            "recentAchievementsCount": 10,
            "recentlyPlayedCount": 7,
          },
        ),
      )

      config_text = module.CONFIG_PATH.read_text(encoding="utf-8")  # type: ignore[attr-defined]
      self.assertEqual(saved_config["hasApiKey"], True)
      self.assertIn('"version": 1', config_text)
      self.assertIn('"recentAchievementsCount": 10', config_text)
      self.assertIn('"recentlyPlayedCount": 7', config_text)
      self.assertNotIn('"apiKey"', config_text)
      self.assertEqual(len(list(Path(temp_dir).glob("provider-config.json.corrupt-*"))), 1)

  def test_backend_request_json_handles_expected_http_statuses_without_warning(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      original_urlopen = backend_http.urlopen

      def fake_urlopen(*args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        raise urllib.error.HTTPError(
          url="https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=secret",
          code=403,
          msg="Forbidden",
          hdrs=None,
          fp=io.BytesIO(b"Access is denied."),
        )

      backend_http.urlopen = fake_urlopen  # type: ignore[assignment]
      try:
        module = load_main_module(Path(temp_dir))
        module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]

        async def invoke_request() -> dict[str, object]:
          return module._request_json(  # type: ignore[attr-defined]
            provider_id="steam",
            provider_label="Steam",
            base_url="https://api.steampowered.com/",
            path="IPlayerService/GetOwnedGames/v1/",
            query={"language": "english", "key": "secret"},
            auth_query={"steamid": "123", "key": "secret"},
            handled_http_statuses={403},
          )

        handled_response = asyncio.run(invoke_request())
      finally:
        backend_http.urlopen = original_urlopen  # type: ignore[assignment]
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertEqual(handled_response["handledHttpError"], True)
      self.assertEqual(handled_response["status"], 403)
      self.assertEqual(handled_response["statusText"], "Forbidden")
      self.assertIn("Access is denied", handled_response["message"])
      self.assertIsInstance(handled_response["durationMs"], int)
      self.assertNotIn("request failed", rendered)
      self.assertNotIn("key=secret", rendered)
      self.assertNotIn("steamid", rendered)
      self.assertNotIn("Access is denied", rendered)

  def test_backend_request_json_uses_injected_urlopen_for_successful_json(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      original_urlopen = backend_http.urlopen
      calls: list[tuple[str, int | None]] = []

      class FakeResponse:
        def __init__(self, body: bytes) -> None:
          self._body = body

        def __enter__(self) -> "FakeResponse":
          return self

        def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001, ANN002, ANN003
          return False

        def read(self) -> bytes:
          return self._body

      def fake_urlopen(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
        calls.append((request.full_url, timeout))
        self.assertIsNotNone(context)
        return FakeResponse(b'{"ok": true, "count": 3}')

      backend_http.urlopen = fake_urlopen  # type: ignore[assignment]
      try:
        module = load_main_module(Path(temp_dir))
        module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]

        async def invoke_request() -> dict[str, object]:
          return module._request_json(  # type: ignore[attr-defined]
            provider_id="steam",
            provider_label="Steam",
            base_url="https://api.steampowered.com/",
            path="IPlayerService/GetOwnedGames/v1/",
            query={"language": "english"},
            auth_query={"steamid": "123", "key": "secret"},
          )

        result = asyncio.run(invoke_request())
      finally:
        backend_http.urlopen = original_urlopen  # type: ignore[assignment]
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertEqual(result, {"ok": True, "count": 3})
      self.assertEqual(len(calls), 1)
      self.assertIn("IPlayerService/GetOwnedGames/v1/", calls[0][0])
      self.assertNotIn("secret", rendered)
      self.assertNotIn("steamid", rendered)
      self.assertNotIn("key=secret", rendered)

  def test_backend_request_json_logs_failure_duration_without_query_params(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      original_urlopen = backend_http.urlopen

      def fake_urlopen(*args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        raise urllib.error.HTTPError(
          url="https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=secret",
          code=403,
          msg="Forbidden",
          hdrs=None,
          fp=io.BytesIO(b"Access is denied."),
        )

      backend_http.urlopen = fake_urlopen  # type: ignore[assignment]
      try:
        module = load_main_module(Path(temp_dir))
        module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]

        async def invoke_request() -> None:
          with self.assertRaises(RuntimeError):
            module._request_json(  # type: ignore[attr-defined]
              provider_id="steam",
              provider_label="Steam",
              base_url="https://api.steampowered.com/",
              path="IPlayerService/GetOwnedGames/v1/",
              query={"language": "english", "key": "secret"},
              auth_query={"steamid": "123", "key": "secret"},
            )

        asyncio.run(invoke_request())
      finally:
        backend_http.urlopen = original_urlopen  # type: ignore[assignment]
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertIn('"durationMs":', rendered)
      self.assertIn('"path":"IPlayerService/GetOwnedGames/v1/"', rendered)
      self.assertNotIn("key=secret", rendered)
      self.assertNotIn("steamid", rendered)
      self.assertNotIn("Access is denied", rendered)

  def test_backend_request_json_invalid_json_raises_safe_error_without_leaking_body(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      original_urlopen = backend_http.urlopen

      class FakeResponse:
        def __enter__(self) -> "FakeResponse":
          return self

        def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001, ANN002, ANN003
          return False

        def read(self) -> bytes:
          return b'{"apiKey":"secret","steamid":"123"'

      def fake_urlopen(request, timeout=None, context=None):  # noqa: ANN001, ANN002, ANN003
        return FakeResponse()

      backend_http.urlopen = fake_urlopen  # type: ignore[assignment]
      try:
        module = load_main_module(Path(temp_dir))
        module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]

        async def invoke_request() -> None:
          with self.assertRaises(RuntimeError):
            module._request_json(  # type: ignore[attr-defined]
              provider_id="steam",
              provider_label="Steam",
              base_url="https://api.steampowered.com/",
              path="IPlayerService/GetOwnedGames/v1/",
              query={"language": "english", "key": "secret"},
              auth_query={"steamid": "123", "key": "secret"},
            )

        asyncio.run(invoke_request())
      finally:
        backend_http.urlopen = original_urlopen  # type: ignore[assignment]
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertIn("Steam response decode failed", rendered)
      self.assertIn('"durationMs":', rendered)
      self.assertNotIn("apiKey", rendered)
      self.assertNotIn("secret", rendered)
      self.assertNotIn("steamid", rendered)
      self.assertNotIn("key=secret", rendered)

  def test_backend_main_logs_storage_and_tls_readiness(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      original_logger = FAKE_DECKY.logger
      capture_logger = CapturingDeckyLogger()
      FAKE_DECKY.logger = capture_logger
      try:
        module = load_main_module(Path(temp_dir))
        module._read_machine_id_text = lambda: "test-machine-id"  # type: ignore[attr-defined]
        plugin = module.Plugin()
        asyncio.run(plugin._main())
      finally:
        FAKE_DECKY.logger = original_logger

      rendered = "\n".join(message for _, message in capture_logger.records)
      self.assertIn("Achievement Companion storage ready", rendered)
      self.assertIn("Achievement Companion backend TLS context ready", rendered)
      self.assertIn("settingsPath", rendered)
      self.assertIn("logPath", rendered)

  def test_backend_tls_helper_sanitizes_ld_library_path_and_uses_cafile(self) -> None:
    original_ld_library_path = os.environ.get("LD_LIBRARY_PATH")
    os.environ["LD_LIBRARY_PATH"] = "/tmp/_MEIabcdef:/usr/lib"
    try:
      with tempfile.TemporaryDirectory() as temp_dir:
        module = load_main_module(Path(temp_dir))
        self.assertNotIn("LD_LIBRARY_PATH", os.environ)

        cafile = Path(temp_dir) / "custom-ca.pem"
        cafile.write_text("dummy ca file", encoding="utf-8")
        original_select_backend_ca_source = backend_tls.select_backend_ca_source
        backend_tls.select_backend_ca_source = lambda candidates=None: (str(cafile), "custom-ca")  # type: ignore[assignment]
        backend_tls._backend_http_ssl_context = None  # type: ignore[attr-defined]
        backend_tls._backend_http_ssl_context_source = None  # type: ignore[attr-defined]

        captured: dict[str, str | None] = {}
        original_create_default_context = ssl.create_default_context

        def fake_create_default_context(*, cafile: str | None = None, **kwargs):  # noqa: ANN001
          captured["cafile"] = cafile
          captured["kwargs"] = repr(kwargs)
          return types.SimpleNamespace(verify_mode=ssl.CERT_REQUIRED, check_hostname=True)

        ssl.create_default_context = fake_create_default_context  # type: ignore[assignment]
        try:
          context = backend_tls.get_backend_http_ssl_context()
        finally:
          ssl.create_default_context = original_create_default_context  # type: ignore[assignment]
          backend_tls.select_backend_ca_source = original_select_backend_ca_source  # type: ignore[assignment]

        self.assertEqual(captured["cafile"], str(cafile))
        self.assertEqual(backend_tls.get_backend_http_ssl_context_source(), "custom-ca")
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
    finally:
      if original_ld_library_path is None:
        os.environ.pop("LD_LIBRARY_PATH", None)
      else:
        os.environ["LD_LIBRARY_PATH"] = original_ld_library_path

  def test_release_package_includes_main_py(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      release_dir = Path(temp_dir) / "release"
      stage_dir = Path(temp_dir) / "stage" / "achievement-companion"
      staged_dir = package_release.stage_release_package(root_dir=ROOT_DIR, stage_dir=stage_dir)
      self.assertTrue((staged_dir / "main.py").exists())
      self.assertTrue((staged_dir / "backend" / "__init__.py").exists())
      self.assertTrue((staged_dir / "backend" / "diagnostics.py").exists())
      self.assertTrue((staged_dir / "backend" / "redaction.py").exists())
      self.assertTrue((staged_dir / "backend" / "secrets.py").exists())
      self.assertTrue((staged_dir / "backend" / "storage.py").exists())
      self.assertTrue((staged_dir / "backend" / "provider_config.py").exists())
      self.assertTrue((staged_dir / "backend" / "http.py").exists())
      self.assertTrue((staged_dir / "backend" / "tls.py").exists())

      zip_path = package_release.create_release_zip(
        root_dir=ROOT_DIR,
        release_dir=release_dir,
        stage_dir=staged_dir,
      )
      with zipfile.ZipFile(zip_path) as archive:
        self.assertIn("achievement-companion/main.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/__init__.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/diagnostics.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/redaction.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/secrets.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/provider_config.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/storage.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/http.py", set(archive.namelist()))
        self.assertIn("achievement-companion/backend/tls.py", set(archive.namelist()))


if __name__ == "__main__":
  unittest.main()
