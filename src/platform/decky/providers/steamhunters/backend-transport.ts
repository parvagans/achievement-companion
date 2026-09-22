import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import {
  SteamHuntersRequestError,
  type SteamHuntersResource,
  type SteamHuntersTransport,
} from "../../../../providers/steamhunters";

interface DeckySteamHuntersRequest {
  readonly appId?: number;
  readonly steamId?: string;
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

function pathFor(identifier: number | string, resource: SteamHuntersResource): string {
  return resource === "profile"
    ? `steam-users/${identifier}`
    : resource === "app"
    ? `apps/${identifier}`
    : resource === "achievements"
      ? `apps/${identifier}/achievements`
      : `GetAchievementGroups/v1?appid=${identifier}`;
}

export function createDeckySteamHuntersTransport(): SteamHuntersTransport {
  return {
    async requestJson(identifier, resource) {
      const path = pathFor(identifier, resource);
      try {
        const response = await callDeckyBackendMethod<unknown>("request_steamhunters_json", {
          ...(resource === "profile" ? { steamId: String(identifier) } : { appId: Number(identifier) }),
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
