export interface SteamTransportRequest {
  readonly path: string;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly init?: RequestInit;
  readonly handledHttpStatuses?: readonly number[];
}

export interface SteamTransportHandledHttpErrorResponse {
  readonly handledHttpError: true;
  readonly status: number;
  readonly statusText: string;
  readonly message: string;
  readonly durationMs?: number;
}

export interface SteamTransport {
  requestJson<T>(request: SteamTransportRequest): Promise<T>;
}

export interface FetchSteamTransportOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.steampowered.com/";

function appendQueryParams(url: URL, query: SteamTransportRequest["query"]): void {
  if (query === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

async function readResponseText(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.trim().length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

function isHandledHttpStatus(
  handledHttpStatuses: readonly number[] | undefined,
  status: number,
): boolean {
  return handledHttpStatuses !== undefined && handledHttpStatuses.some((value) => value === status);
}

export function isSteamTransportHandledHttpErrorResponse(
  value: unknown,
): value is SteamTransportHandledHttpErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as SteamTransportHandledHttpErrorResponse).handledHttpError === true &&
    typeof (value as SteamTransportHandledHttpErrorResponse).status === "number" &&
    typeof (value as SteamTransportHandledHttpErrorResponse).statusText === "string" &&
    typeof (value as SteamTransportHandledHttpErrorResponse).message === "string"
  );
}

export function createFetchSteamTransport(
  options: FetchSteamTransportOptions = {},
): SteamTransport {
  return {
    async requestJson<T>({ path, query, init, handledHttpStatuses }: SteamTransportRequest): Promise<T> {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      if (typeof fetchImpl !== "function") {
        throw new Error("Steam transport requires a fetch implementation.");
      }

      const url = new URL(path, normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL));
      appendQueryParams(url, query);

      const headers = new Headers(init?.headers);
      headers.set("Accept", "application/json");

      const response = await fetchImpl(url, {
        ...init,
        cache: "no-store",
        method: init?.method ?? "GET",
        headers,
      });

      if (!response.ok) {
        const bodyText = await readResponseText(response);
        if (isHandledHttpStatus(handledHttpStatuses, response.status)) {
          return {
            handledHttpError: true,
            status: response.status,
            statusText: response.statusText,
            message: bodyText !== undefined ? bodyText : response.statusText,
          } as T;
        }
        const detail = bodyText !== undefined ? `: ${bodyText}` : "";
        throw new Error(`Steam request failed with ${response.status} ${response.statusText}${detail}`);
      }

      return response.json() as Promise<T>;
    },
  };
}
