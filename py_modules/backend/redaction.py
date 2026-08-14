from __future__ import annotations

import re
from typing import Any, Mapping

SECRET_URL_RE = re.compile(r"(?i)https?://[^\s]*[?&](?:apiKey|key|token|password|secret|y)=[^\s]+")
SECRET_QUERY_PARAM_RE = re.compile(r"(?i)([?&](?:apiKey|key|token|password|secret|y)=)[^&\s]+")
SECRET_AUTHORIZATION_INLINE_RE = re.compile(r"(?i)\bauthorization\b\s*[:=]\s*(?:bearer\s+)?[^,\s]+")
SECRET_INLINE_RE = re.compile(
  r"(?i)\b(?:apiKey|apiKeyDraft|key|token|password|secret)\b\s*[:=]\s*[^,\s]+",
)


def is_secret_key(name: str) -> bool:
  lowered = name.lower()
  return lowered == "y" or any(token in lowered for token in ("authorization", "apikey", "key", "token", "password", "secret"))


def redact_text(text: str) -> str:
  text = SECRET_URL_RE.sub("[redacted url]", text)
  text = SECRET_QUERY_PARAM_RE.sub(r"\1[redacted]", text)
  text = SECRET_AUTHORIZATION_INLINE_RE.sub(lambda match: f"{match.group(0).split('=')[0].split(':')[0]}: [redacted]", text)
  return SECRET_INLINE_RE.sub(lambda match: f"{match.group(0).split('=')[0].split(':')[0]}: [redacted]", text)


def redact_value(value: Any) -> Any:
  if isinstance(value, str):
    return redact_text(value)

  if isinstance(value, Mapping):
    return {
      key: "[redacted]" if is_secret_key(str(key)) else redact_value(item)
      for key, item in value.items()
    }

  if isinstance(value, list):
    return [redact_value(item) for item in value]

  if isinstance(value, tuple):
    return tuple(redact_value(item) for item in value)

  return value
