from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from pathlib import Path
from typing import Any, Mapping

from backend.storage import WarningCallback, read_json_file, write_json_file


SECRET_RECORD_VERSION = 2
SECRET_RECORD_SCHEME = "local-obfuscation-v1"
_MACHINE_ID_PATHS: tuple[Path, ...] = (
  Path("/etc/machine-id"),
  Path("/var/lib/dbus/machine-id"),
)


def _base64_urlsafe_encode(value: bytes) -> str:
  return base64.urlsafe_b64encode(value).decode("ascii")


def _base64_urlsafe_decode(value: str | None) -> bytes | None:
  if value is None or value.strip() == "":
    return None

  try:
    return base64.urlsafe_b64decode(value.encode("ascii"))
  except (ValueError, UnicodeDecodeError):
    return None


def _read_machine_id_text() -> str | None:
  for candidate in _MACHINE_ID_PATHS:
    try:
      value = candidate.read_text(encoding="utf-8").strip()
    except OSError:
      continue

    if value != "":
      return value

  return None


def _resolve_seed_text(settings_dir_text: str) -> str:
  return _read_machine_id_text() or settings_dir_text


def _derive_secret_record_key(provider_key: str, salt: bytes, *, settings_dir_text: str = "") -> bytes:
  seed_text = _resolve_seed_text(settings_dir_text)
  seed = f"{SECRET_RECORD_SCHEME}:{provider_key}:{seed_text}".encode("utf-8")
  return hashlib.pbkdf2_hmac("sha256", seed, salt, 150_000, dklen=32)


def _xor_with_keystream(secret_key: bytes, nonce: bytes, payload: bytes) -> bytes:
  stream = bytearray()
  counter = 0

  while len(stream) < len(payload):
    stream.extend(
      hmac.new(secret_key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest(),
    )
    counter += 1

  return bytes(left ^ right for left, right in zip(payload, stream))


def _encode_protected_secret_record(provider_key: str, api_key: str, *, settings_dir_text: str = "") -> dict[str, Any]:
  salt = secrets.token_bytes(16)
  nonce = secrets.token_bytes(16)
  secret_key = _derive_secret_record_key(provider_key, salt, settings_dir_text=settings_dir_text)
  plaintext = api_key.encode("utf-8")
  ciphertext = _xor_with_keystream(secret_key, nonce, plaintext)
  tag = hmac.new(secret_key, nonce + ciphertext, hashlib.sha256).digest()[:16]

  return {
    "version": SECRET_RECORD_VERSION,
    "scheme": SECRET_RECORD_SCHEME,
    "salt": _base64_urlsafe_encode(salt),
    "nonce": _base64_urlsafe_encode(nonce),
    "ciphertext": _base64_urlsafe_encode(ciphertext),
    "tag": _base64_urlsafe_encode(tag),
  }


def _decode_legacy_secret_api_key(payload: str | None) -> str | None:
  if payload is None or payload.strip() == "":
    return None

  try:
    decoded = base64.urlsafe_b64decode(payload.encode("ascii"))
    parsed = json.loads(decoded.decode("utf-8"))
  except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
    return None

  if isinstance(parsed, dict):
    api_key = parsed.get("apiKey")
    if isinstance(api_key, str) and api_key.strip() != "":
      return api_key.strip()

  return None


def _decode_protected_secret_record(
  provider_key: str,
  provider_secret: Mapping[str, Any],
  *,
  settings_dir_text: str = "",
) -> str | None:
  if provider_secret.get("version") != SECRET_RECORD_VERSION:
    return None

  if provider_secret.get("scheme") != SECRET_RECORD_SCHEME:
    return None

  salt = _base64_urlsafe_decode(provider_secret.get("salt") if isinstance(provider_secret.get("salt"), str) else None)
  nonce = _base64_urlsafe_decode(provider_secret.get("nonce") if isinstance(provider_secret.get("nonce"), str) else None)
  ciphertext = _base64_urlsafe_decode(
    provider_secret.get("ciphertext") if isinstance(provider_secret.get("ciphertext"), str) else None,
  )
  tag = _base64_urlsafe_decode(provider_secret.get("tag") if isinstance(provider_secret.get("tag"), str) else None)
  if salt is None or nonce is None or ciphertext is None or tag is None:
    return None

  secret_key = _derive_secret_record_key(provider_key, salt, settings_dir_text=settings_dir_text)
  expected_tag = hmac.new(secret_key, nonce + ciphertext, hashlib.sha256).digest()[:16]
  if not hmac.compare_digest(expected_tag, tag):
    return None

  try:
    plaintext = _xor_with_keystream(secret_key, nonce, ciphertext).decode("utf-8")
  except UnicodeDecodeError:
    return None

  return plaintext if plaintext.strip() != "" else None


def _load_secret_store(secrets_path: Path, *, warn: WarningCallback | None = None) -> dict[str, Any]:
  store = read_json_file(secrets_path, warn=warn)
  if store.get("version") not in (1, SECRET_RECORD_VERSION):
    return {"version": SECRET_RECORD_VERSION}
  return store


def load_secret_api_key(
  secrets_path: Path,
  provider_key: str,
  *,
  warn: WarningCallback | None = None,
  settings_dir_text: str = "",
) -> str | None:
  secrets = _load_secret_store(secrets_path, warn=warn)
  provider_secret = secrets.get(provider_key)
  if not isinstance(provider_secret, dict):
    return None

  if provider_secret.get("version") == 1:
    legacy_secret = _decode_legacy_secret_api_key(
      provider_secret.get("payload") if isinstance(provider_secret.get("payload"), str) else None,
    )
    if legacy_secret is not None:
      save_secret_api_key(
        secrets_path,
        provider_key,
        legacy_secret,
        warn=warn,
        settings_dir_text=settings_dir_text,
      )
    return legacy_secret

  return _decode_protected_secret_record(provider_key, provider_secret, settings_dir_text=settings_dir_text)


def save_secret_api_key(
  secrets_path: Path,
  provider_key: str,
  api_key: str,
  *,
  warn: WarningCallback | None = None,
  settings_dir_text: str = "",
) -> None:
  secrets = _load_secret_store(secrets_path, warn=warn)
  secrets["version"] = SECRET_RECORD_VERSION
  secrets[provider_key] = _encode_protected_secret_record(
    provider_key,
    api_key,
    settings_dir_text=settings_dir_text,
  )
  write_json_file(secrets_path, secrets)


def clear_secret_api_key(
  secrets_path: Path,
  provider_key: str,
  *,
  warn: WarningCallback | None = None,
) -> None:
  secrets = _load_secret_store(secrets_path, warn=warn)
  if provider_key in secrets:
    secrets.pop(provider_key, None)
    if len(secrets) <= 1:
      try:
        secrets_path.unlink()
      except FileNotFoundError:
        pass
      except OSError as cause:
        if warn is not None:
          warn("Unable to remove provider secret file", {"path": str(secrets_path), "error": str(cause)})
      return

    write_json_file(secrets_path, secrets)
