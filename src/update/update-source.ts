import { parseUpdateManifest } from "./update-manifest";
import type { UpdateManifest } from "./update-types";

export type UpdateFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface UpdateSource {
  readonly kind: "production" | "local";
  readonly manifestUrl: string;
  loadManifest(): Promise<UpdateManifest>;
}

export interface HttpUpdateSourceOptions {
  readonly fetch: UpdateFetch;
  readonly timeoutMs?: number;
}

abstract class HttpUpdateSource implements UpdateSource {
  abstract readonly kind: "production" | "local";

  constructor(
    readonly manifestUrl: string,
    private readonly options: HttpUpdateSourceOptions,
  ) {}

  async loadManifest(): Promise<UpdateManifest> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000);
    try {
      const response = await this.options.fetch(this.manifestUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`Update manifest request failed with HTTP ${response.status}.`);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Update manifest response is not valid JSON.");
      }
      return parseUpdateManifest(payload, this.manifestUrl);
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Update manifest request timed out.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class ProductionUpdateSource extends HttpUpdateSource {
  readonly kind = "production" as const;
}

export class LocalUpdateSource extends HttpUpdateSource {
  readonly kind = "local" as const;
}
