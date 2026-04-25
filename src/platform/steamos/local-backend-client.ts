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

  constructor(status: number, code?: string) {
    super(
      code !== undefined
        ? `Local backend request failed with ${status} ${code}.`
        : `Local backend request failed with ${status}.`,
    );
    this.name = "SteamOSLocalBackendClientError";
    this.status = status;
    this.code = code;
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
      const response = await fetchImpl(url, {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await readJsonResponse(response);
      if (!response.ok) {
        throw new SteamOSLocalBackendClientError(response.status, getErrorCode(responsePayload));
      }

      return responsePayload as TResponse;
    },
  };
}
