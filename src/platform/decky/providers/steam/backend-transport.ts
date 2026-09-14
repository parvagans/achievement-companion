import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import type { SteamTransport, SteamTransportRequest } from "../../../../providers/steam/client/transport";
import { SteamRequestError } from "../../../../providers/steam/client/transport";

interface DeckySteamRequest {
  readonly path: string;
  readonly query?: SteamTransportRequest["query"];
  readonly handledHttpStatuses?: SteamTransportRequest["handledHttpStatuses"];
  readonly init?: Pick<RequestInit, "method" | "headers" | "body">;
}

interface DeckySteamFailureEnvelope { readonly handledHttpError?: unknown; readonly status?: unknown; readonly message?: unknown; }
function isFailureEnvelope(value: unknown): value is DeckySteamFailureEnvelope { return typeof value === "object" && value !== null && (value as Record<string, unknown>)["handledHttpError"] === true; }

export function createDeckySteamTransport(): SteamTransport {
  return {
    async requestJson<T>({ path, query, init, handledHttpStatuses }: SteamTransportRequest): Promise<T> {
      const response = await callDeckyBackendMethod<T>("request_steam_json", {
        path,
        ...(query !== undefined ? { query } : {}),
        ...(handledHttpStatuses !== undefined ? { handledHttpStatuses } : {}),
        ...(init !== undefined ? { init } : {}),
      } satisfies DeckySteamRequest);
      const failureEnvelope = response as unknown;
      if (isFailureEnvelope(failureEnvelope)) {
        throw new SteamRequestError(typeof failureEnvelope.message === "string" ? failureEnvelope.message : "Steam request failed.", path, typeof failureEnvelope.status === "number" ? failureEnvelope.status : undefined, "http");
      }
      return response;
    },
  };
}
