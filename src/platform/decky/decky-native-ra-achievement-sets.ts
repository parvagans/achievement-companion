import type { GameDetailSnapshot, RelatedGameSummary } from "@core/domain";
import {
  projectNativeRetroAchievementsDetail,
  type NativeRetroAchievementsProjection,
} from "./decky-native-retroachievements-projection";
import { toNativeSteamAchievements } from "./decky-native-steam-achievement-conversion";
import type { NativeSteamAchievementSet } from "./decky-native-steam-achievement-queries";

interface VerifiedSubsetDetails {
  readonly relationship: RelatedGameSummary;
  readonly snapshot: GameDetailSnapshot;
}

export interface NativeRaAchievementSet extends NativeSteamAchievementSet {
  readonly projection: NativeRetroAchievementsProjection;
}

/** Build one Steam set and retain its verified RA game identity for pinning. */
export function buildNativeRaAchievementSets(
  base: NativeRetroAchievementsProjection,
  verifiedDetails: readonly VerifiedSubsetDetails[],
): readonly NativeRaAchievementSet[] {
  const usedGameIds = new Set([base.raGameId]);
  const usedAchievementIds = new Set(base.achievements.map(row => row.achievementId));
  const subsets: NativeRaAchievementSet[] = [];
  for (const { relationship, snapshot } of verifiedDetails) {
    const { gameId, providerId, parentGameId } = relationship;
    const label = relationship.title.trim();
    const groupId = Number(gameId);
    if (providerId !== "retroachievements" || parentGameId !== base.raGameId || !label || usedGameIds.has(gameId)
      || !/^[1-9]\d*$/u.test(gameId) || !Number.isInteger(groupId) || groupId > 0xffffffff
      || (snapshot.game.parentGameId !== undefined && snapshot.game.parentGameId !== base.raGameId)) continue;
    const subset = projectNativeRetroAchievementsDetail(base.appId, gameId, base.mode, snapshot);
    if (subset.status !== "ready" || subset.achievements.some(row =>
      !/^[1-9]\d*$/u.test(row.achievementId) || !Number.isSafeInteger(Number(row.achievementId))
      || usedAchievementIds.has(row.achievementId))) continue;

    usedGameIds.add(gameId);
    for (const achievement of subset.achievements) usedAchievementIds.add(achievement.achievementId);
    subsets.push({
      id: groupId,
      name: label,
      model: toNativeSteamAchievements(subset.achievements, subset.mode, subset.totalPlayers),
      projection: subset,
    });
  }
  return subsets;
}
