export interface RetroAchievementsTransportRequest {
  readonly path: string;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly init?: RequestInit;
}

export interface RetroAchievementsTransport {
  requestJson<T>(request: RetroAchievementsTransportRequest): Promise<T>;
}

export interface FetchRetroAchievementsTransportOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://retroachievements.org/API/";

function appendQueryParams(url: URL, query: RetroAchievementsTransportRequest["query"]): void {
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

// Assumption: RetroAchievements exposes the documented PHP endpoints under the /API/ prefix.
export function createFetchRetroAchievementsTransport(
  options: FetchRetroAchievementsTransportOptions = {},
): RetroAchievementsTransport {
  return {
    async requestJson<T>({ path, query, init }: RetroAchievementsTransportRequest): Promise<T> {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      if (typeof fetchImpl !== "function") {
        throw new Error("RetroAchievements transport requires a fetch implementation.");
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
        const detail = bodyText !== undefined ? `: ${bodyText}` : "";
        throw new Error(
          `RetroAchievements request failed with ${response.status} ${response.statusText}${detail}`,
        );
      }

      return response.json() as Promise<T>;
    },
  };
}
