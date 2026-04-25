import type { SteamOSLocalBackendFetch } from "./local-backend-client";
import {
  createSteamOSLocalBackendClientConfig,
  parseSteamOSBackendRuntimeMetadata,
  type SteamOSBackendRuntimeMetadata,
  type SteamOSLocalBackendClientConfig,
} from "./runtime-metadata";

export const DEFAULT_STEAMOS_RUNTIME_METADATA_URL = "/__achievement_companion__/runtime";

export type SteamOSRuntimeBootstrapErrorCode =
  | "fetch_unavailable"
  | "invalid_bootstrap_url"
  | "request_failed"
  | "invalid_content_type"
  | "invalid_json"
  | "invalid_metadata";

export interface SteamOSRuntimeBootstrapOptions {
  readonly fetchImpl?: SteamOSLocalBackendFetch;
  readonly bootstrapUrl?: string;
}

export class SteamOSRuntimeBootstrapError extends Error {
  readonly code: SteamOSRuntimeBootstrapErrorCode;

  constructor(code: SteamOSRuntimeBootstrapErrorCode) {
    super(`SteamOS runtime bootstrap failed: ${code}.`);
    this.name = "SteamOSRuntimeBootstrapError";
    this.code = code;
  }
}

function isSameOriginBootstrapPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !/^[a-z][a-z0-9+.-]*:/iu.test(value);
}

function hasJsonContentType(response: Response): boolean {
  const contentType = response.headers.get("Content-Type");
  return contentType !== null && contentType.toLowerCase().includes("application/json");
}

async function readRuntimeMetadataJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new SteamOSRuntimeBootstrapError("invalid_json");
  }
}

export async function loadSteamOSRuntimeMetadata(
  options: SteamOSRuntimeBootstrapOptions = {},
): Promise<SteamOSBackendRuntimeMetadata> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new SteamOSRuntimeBootstrapError("fetch_unavailable");
  }

  const bootstrapUrl = options.bootstrapUrl ?? DEFAULT_STEAMOS_RUNTIME_METADATA_URL;
  if (!isSameOriginBootstrapPath(bootstrapUrl)) {
    throw new SteamOSRuntimeBootstrapError("invalid_bootstrap_url");
  }

  const response = await fetchImpl(bootstrapUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new SteamOSRuntimeBootstrapError("request_failed");
  }

  if (!hasJsonContentType(response)) {
    throw new SteamOSRuntimeBootstrapError("invalid_content_type");
  }

  const metadata = parseSteamOSBackendRuntimeMetadata(await readRuntimeMetadataJson(response));
  if (metadata === null) {
    throw new SteamOSRuntimeBootstrapError("invalid_metadata");
  }

  return metadata;
}

export async function loadSteamOSBootstrapConfig(
  options: SteamOSRuntimeBootstrapOptions = {},
): Promise<SteamOSLocalBackendClientConfig> {
  return createSteamOSLocalBackendClientConfig(await loadSteamOSRuntimeMetadata(options));
}
