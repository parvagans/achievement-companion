const REDACTED_VALUE = "[redacted]";

const SECRET_FIELD_NAMES = new Set([
  "apikey",
  "apikeydraft",
  "authorization",
  "key",
  "password",
  "secret",
  "token",
  "y",
]);

const SECRET_QUERY_PARAM_PATTERN =
  /([?&](?:apiKeyDraft|apiKey|key|y|token|password|secret)=)([^&#\s]+)/gi;
const AUTHORIZATION_INLINE_PATTERN =
  /(^|[^?&\w])(Authorization)\b\s*[:=]\s*(?:Bearer\s+)?[^,\s}]+/gi;
const SECRET_INLINE_PATTERN =
  /(^|[^?&\w])(apiKeyDraft|apiKey|key|y|token|password|secret)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^,\s}]+)/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

function normalizeFieldName(fieldName: string): string {
  return fieldName.toLowerCase();
}

function isSecretFieldName(fieldName: string): boolean {
  return SECRET_FIELD_NAMES.has(normalizeFieldName(fieldName));
}

export function redactFrontendLogText(text: string): string {
  return text
    .replace(SECRET_QUERY_PARAM_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(AUTHORIZATION_INLINE_PATTERN, `$1$2: ${REDACTED_VALUE}`)
    .replace(SECRET_INLINE_PATTERN, `$1$2: ${REDACTED_VALUE}`)
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_VALUE}`);
}

export function redactFrontendLogValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactFrontendLogText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactFrontendLogValue(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSecretFieldName(key) ? REDACTED_VALUE : redactFrontendLogValue(item),
      ]),
    );
  }

  return value;
}
