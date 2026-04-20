import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import type { SteamTransport, SteamTransportRequest } from "../../../../providers/steam/client/transport";

interface DeckySteamRequest {
  readonly path: string;
  readonly query?: SteamTransportRequest["query"];
  readonly handledHttpStatuses?: SteamTransportRequest["handledHttpStatuses"];
  readonly init?: Pick<RequestInit, "method" | "headers" | "body">;
}

export function createDeckySteamTransport(): SteamTransport {
  return {
    async requestJson<T>({ path, query, init, handledHttpStatuses }: SteamTransportRequest): Promise<T> {
      return callDeckyBackendMethod<T>("request_steam_json", {
        path,
        ...(query !== undefined ? { query } : {}),
        ...(handledHttpStatuses !== undefined ? { handledHttpStatuses } : {}),
        ...(init !== undefined ? { init } : {}),
      } satisfies DeckySteamRequest);
    },
  };
}
