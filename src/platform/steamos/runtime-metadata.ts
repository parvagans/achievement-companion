export interface SteamOSBackendRuntimeMetadata {
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly pid: number;
  readonly token: string;
  readonly startedAt: string;
}

export interface SteamOSLocalBackendClientConfig {
  readonly baseUrl: string;
  readonly token: string;
}

const MINIMUM_RUNTIME_TOKEN_LENGTH = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePositiveInteger(value: unknown): number | null {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0) {
    return null;
  }

  return value;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "" || Number.isNaN(Date.parse(trimmed))) {
    return null;
  }

  return trimmed;
}

function parseRuntimeToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed !== value || trimmed.length < MINIMUM_RUNTIME_TOKEN_LENGTH) {
    return null;
  }

  return trimmed;
}

export function isSafeLocalBackendHost(host: unknown): host is "127.0.0.1" {
  return host === "127.0.0.1";
}

export function parseSteamOSBackendRuntimeMetadata(
  value: unknown,
): SteamOSBackendRuntimeMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const host = value["host"];
  const port = parsePositiveInteger(value["port"]);
  const pid = parsePositiveInteger(value["pid"]);
  const token = parseRuntimeToken(value["token"]);
  const startedAt = parseTimestamp(value["startedAt"]);

  if (!isSafeLocalBackendHost(host) || port === null || port > 65_535 || pid === null || token === null || startedAt === null) {
    return null;
  }

  return {
    host,
    port,
    pid,
    token,
    startedAt,
  };
}

export function createSteamOSLocalBackendClientConfig(
  metadata: SteamOSBackendRuntimeMetadata,
): SteamOSLocalBackendClientConfig {
  return {
    baseUrl: `http://${metadata.host}:${metadata.port}`,
    token: metadata.token,
  };
}
