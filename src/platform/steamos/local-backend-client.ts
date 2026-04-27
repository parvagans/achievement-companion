export interface SteamOSLocalBackendFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface SteamOSLocalBackendClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetchImpl?: SteamOSLocalBackendFetch;
}

export class SteamOSLocalBackendClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly category: string | undefined;

  constructor(status: number, code?: string, category?: string) {
    super(
      code !== undefined
        ? `Local backend request failed with ${status} ${code}.`
        : `Local backend request failed with ${status}.`,
    );
    this.name = "SteamOSLocalBackendClientError";
    this.status = status;
    this.code = code;
    this.category = category;
  }
}

export interface SteamOSLocalBackendClient {
  postJson<TResponse>(path: string, payload: object): Promise<TResponse>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function normalizeEndpointPath(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const rawText = await response.text();
  if (rawText.trim() === "") {
    return {};
  }

  return JSON.parse(rawText) as unknown;
}

function getErrorCode(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const errorValue = (payload as Record<string, unknown>)["error"];
  return typeof errorValue === "string" && errorValue.trim() !== "" ? errorValue : undefined;
}

function getErrorCategory(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const errorValue = (payload as Record<string, unknown>)["errorCategory"];
  return typeof errorValue === "string" && errorValue.trim() !== "" ? errorValue : undefined;
}

export function createSteamOSLocalBackendClient(
  options: SteamOSLocalBackendClientOptions,
): SteamOSLocalBackendClient {
  return {
    async postJson<TResponse>(path: string, payload: object): Promise<TResponse> {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      if (typeof fetchImpl !== "function") {
        throw new Error("SteamOS local backend client requires a fetch implementation.");
      }

      const url = new URL(normalizeEndpointPath(path), normalizeBaseUrl(options.baseUrl));
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new SteamOSLocalBackendClientError(0, "backend_unavailable", "network_error");
      }

      let responsePayload: unknown;
      try {
        responsePayload = await readJsonResponse(response);
      } catch {
        throw new SteamOSLocalBackendClientError(response.status, "invalid_json", "invalid_json");
      }
      if (!response.ok) {
        throw new SteamOSLocalBackendClientError(
          response.status,
          getErrorCode(responsePayload),
          getErrorCategory(responsePayload),
        );
      }

      return responsePayload as TResponse;
    },
  };
}
