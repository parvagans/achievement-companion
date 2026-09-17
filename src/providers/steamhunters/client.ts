export interface SteamHuntersClient {
  loadApp(appId: number): Promise<unknown>;
  loadAchievements(appId: number): Promise<unknown>;
}

export type SteamHuntersResource = "app" | "achievements";

export interface SteamHuntersTransport {
  requestJson(appId: number, resource: SteamHuntersResource): Promise<unknown>;
}

export class SteamHuntersRequestError extends Error {
  public constructor(
    message: string,
    public readonly path: string,
    public readonly category: "http" | "network" | "timeout" | "parse",
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "SteamHuntersRequestError";
  }
}

export interface CreateSteamHuntersClientOptions {
  readonly transport?: SteamHuntersTransport;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://steamhunters.com/api/";
const DEFAULT_TIMEOUT_MS = 8_000;

function normalizeAppId(appId: number): number {
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new Error("SteamHunters app ID must be a positive integer.");
  }

  return appId;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function readResponseText(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.trim().length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

export function createFetchSteamHuntersTransport(
  options: Omit<CreateSteamHuntersClientOptions, "transport"> = {},
): SteamHuntersTransport {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function requestJson(appId: number, resource: SteamHuntersResource): Promise<unknown> {
    if (typeof fetchImpl !== "function") {
      throw new Error("SteamHunters client requires a fetch implementation.");
    }

    const path = resource === "app" ? `apps/${appId}` : `apps/${appId}/achievements`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(new URL(path, normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL)), {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await readResponseText(response);
        throw new SteamHuntersRequestError(
          `SteamHunters request failed with ${response.status} ${response.statusText}${detail !== undefined ? `: ${detail}` : ""}`,
          path,
          "http",
          response.status,
        );
      }

      try {
        return await response.json();
      } catch {
        throw new SteamHuntersRequestError(
          "SteamHunters returned invalid JSON.",
          path,
          "parse",
        );
      }
    } catch (cause) {
      if (cause instanceof SteamHuntersRequestError) {
        throw cause;
      }

      const category = controller.signal.aborted ? "timeout" : "network";
      throw new SteamHuntersRequestError(
        category === "timeout" ? "SteamHunters request timed out." : "SteamHunters request failed.",
        path,
        category,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return { requestJson };
}

export function createSteamHuntersClient(
  options: CreateSteamHuntersClientOptions = {},
): SteamHuntersClient {
  const transport = options.transport ?? createFetchSteamHuntersTransport(options);

  return {
    loadApp(appId) {
      return transport.requestJson(normalizeAppId(appId), "app");
    },
    loadAchievements(appId) {
      return transport.requestJson(normalizeAppId(appId), "achievements");
    },
  };
}
