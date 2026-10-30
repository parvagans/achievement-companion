import type { GameCommunityStats, GameDetailSnapshot } from "@core/domain";
import type { createRetroAchievementsDataCoordinator } from "./retroachievements-data-coordinator";
import { normalizeRetroAchievementsGameCommunityStats, normalizeRetroAchievementsLatestMasters } from "../../providers/retroachievements/community-stats";
import type { RawRetroAchievementsAchievementDistributionResponse, RawRetroAchievementsGameProgressionResponse, RawRetroAchievementsGameRankAndScoreEntry } from "../../providers/retroachievements/raw-types";

export function raCommunityRequests(gameId: string) {
  return [
    { path: "API_GetAchievementDistribution.php", query: { i: gameId, h: 1, f: 3 } },
    { path: "API_GetGameProgression.php", query: { i: gameId, h: 1 } },
    { path: "API_GetGameRankAndScore.php", query: { g: gameId, t: 1 } },
  ] as const;
}

/** Pure presentation over canonical records, shared by native and Companion.
 * Subscriptions read these records; they never issue a replacement request. */
export function readRaCommunityPresentation(resources: ReturnType<typeof createRetroAchievementsDataCoordinator>, snapshot: GameDetailSnapshot,
  previous: GameCommunityStats | undefined = snapshot.game.communityStats, now = Date.now()) {
  const requests = raCommunityRequests(snapshot.game.gameId);
  const records = requests.map((request) => resources.getResource(request));
  const distribution = records[0]?.payload as RawRetroAchievementsAchievementDistributionResponse | undefined;
  const progression = records[1]?.payload as RawRetroAchievementsGameProgressionResponse | undefined;
  const masters = records[2]?.payload as readonly RawRetroAchievementsGameRankAndScoreEntry[] | undefined;
  const players = Number(snapshot.game.metrics.find((metric) => metric.key === "total-players")?.value.replace(/,/gu, ""));
  const base = normalizeRetroAchievementsGameCommunityStats({ totalAchievementCount: snapshot.game.summary.totalCount,
    totalPlayers: Number.isFinite(players) ? players : undefined, distribution, progression,
    ...(previous !== undefined ? { previous } : {}),
  });
  const latestMasters = masters === undefined ? undefined : normalizeRetroAchievementsLatestMasters({ entries: masters,
    masteredPlayers: base?.masteredPlayers, avatarUrlByUserIdentifier: new Map(masters.flatMap((entry) => {
      const username = entry.User ?? entry.user;
      return typeof username === "string" ? [[username, `https://media.retroachievements.org/UserPic/${encodeURIComponent(username)}.png`] as const] : [];
    })),
  });
  const stats = records.every((record) => record === undefined) ? previous
    : normalizeRetroAchievementsGameCommunityStats({ totalAchievementCount: snapshot.game.summary.totalCount,
      totalPlayers: Number.isFinite(players) ? players : undefined, distribution, progression,
      ...(latestMasters !== undefined ? { latestMasters } : {}), ...(previous !== undefined ? { previous } : {}),
    });
  return { stats, pending: requests.some((request) => resources.isResourcePending(request)),
    fresh: records.every((record) => record !== undefined && record.cacheState !== "stale" && record.fetchedAt <= now && now < record.freshUntil),
    degraded: records.some((record) => record?.error !== undefined || record?.cacheState === "stale"),
  };
}
