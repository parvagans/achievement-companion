import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import type {
  RetroAchievementsTransport,
  RetroAchievementsTransportRequest,
} from "../../../../providers/retroachievements/client/transport";

interface DeckyRetroAchievementsRequest {
  readonly path: string;
  readonly query?: RetroAchievementsTransportRequest["query"];
  readonly init?: Pick<RequestInit, "method" | "headers" | "body">;
}

export function createDeckyRetroAchievementsTransport(): RetroAchievementsTransport {
  return {
    async requestJson<T>({ path, query, init }: RetroAchievementsTransportRequest): Promise<T> {
      return callDeckyBackendMethod<T>("request_retroachievements_json", {
        path,
        ...(query !== undefined ? { query } : {}),
        ...(init !== undefined ? { init } : {}),
      } satisfies DeckyRetroAchievementsRequest);
    },
  };
}
