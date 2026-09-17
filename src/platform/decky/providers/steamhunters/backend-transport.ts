import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import {
  SteamHuntersRequestError,
  type SteamHuntersResource,
  type SteamHuntersTransport,
} from "../../../../providers/steamhunters";

interface DeckySteamHuntersRequest {
  readonly appId: number;
  readonly resource: SteamHuntersResource;
}

interface DeckySteamHuntersFailureEnvelope {
  readonly handledHttpError?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
}

function isFailureEnvelope(value: unknown): value is DeckySteamHuntersFailureEnvelope {
  return typeof value === "object" && value !== null &&
    (value as Record<string, unknown>)["handledHttpError"] === true;
}

function pathFor(appId: number, resource: SteamHuntersResource): string {
  return resource === "app" ? `apps/${appId}` : `apps/${appId}/achievements`;
}

export function createDeckySteamHuntersTransport(): SteamHuntersTransport {
  return {
    async requestJson(appId, resource) {
      const path = pathFor(appId, resource);
      try {
        const response = await callDeckyBackendMethod<unknown>("request_steamhunters_json", {
          appId,
          resource,
        } satisfies DeckySteamHuntersRequest);
        if (isFailureEnvelope(response)) {
          throw new SteamHuntersRequestError(
            typeof response.message === "string" ? response.message : "SteamHunters request failed.",
            path,
            "http",
            typeof response.status === "number" ? response.status : undefined,
          );
        }
        return response;
      } catch (cause) {
        if (cause instanceof SteamHuntersRequestError) {
          throw cause;
        }
        throw new SteamHuntersRequestError("SteamHunters request failed.", path, "network");
      }
    },
  };
}
