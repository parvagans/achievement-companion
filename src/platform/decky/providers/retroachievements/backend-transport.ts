import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import type {
  RetroAchievementsTransport,
  RetroAchievementsTransportRequest,
} from "../../../../providers/retroachievements/client/transport";
import { RetroAchievementsRequestError } from "../../../../providers/retroachievements/client/transport";

interface DeckyRetroAchievementsRequest {
  readonly path: string;
  readonly query?: RetroAchievementsTransportRequest["query"];
  readonly init?: Pick<RequestInit, "method" | "headers" | "body">;
}

interface DeckyRetroAchievementsFailureEnvelope {
  readonly handledHttpError?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
}

function isFailureEnvelope(value: unknown): value is DeckyRetroAchievementsFailureEnvelope {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>)["handledHttpError"] === true;
}

export function createDeckyRetroAchievementsTransport(): RetroAchievementsTransport {
  return {
    async requestJson<T>({ path, query, init }: RetroAchievementsTransportRequest): Promise<T> {
      const response = await callDeckyBackendMethod<T>("request_retroachievements_json", {
        path,
        ...(query !== undefined ? { query } : {}),
        ...(init !== undefined ? { init } : {}),
      } satisfies DeckyRetroAchievementsRequest);
      const failureEnvelope = response as unknown;
      if (isFailureEnvelope(failureEnvelope)) {
        const statusCode = typeof failureEnvelope.status === "number" ? failureEnvelope.status : undefined;
        throw new RetroAchievementsRequestError(
          typeof failureEnvelope.message === "string" ? failureEnvelope.message : "RetroAchievements request failed.",
          statusCode,
          "http",
        );
      }
      return response;
    },
  };
}
