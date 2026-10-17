import type { GameDetailSnapshot, NormalizedAchievement, NormalizedMetric, ProviderId } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { getSteamHuntersAchievementEnrichment, getSteamHuntersGameEnrichment } from "../../providers/steamhunters/compose-steam-game-detail";
import {
  formatCount,
  formatMetricValue,
  formatProviderAchievementPointsText,
  formatProviderAchievementStatusText,
  formatTimestamp,
  getAchievementDetailCounts,
  getMetricValue,
} from "./decky-achievement-detail-helpers";
import { formatSteamHuntersPercentage, formatSteamHuntersPlayersUnlocked } from "./decky-steam-hunters-presentation";
import { sortAchievementsForDisplay } from "./decky-game-detail-ordering";
import { isRetroAchievementsUnlockedInMode } from "./decky-retroachievements-compact-game-model";
import { getSteamAchievementCommunityPercent } from "./decky-achievement-row-presentation";

export type CompactAchievementFilter = "all" | "unlocked" | "locked";
export type CompactAchievementModeFilter = "all" | "hardcore" | "softcore";
export type CompactAchievementStateKind = "unlocked" | "locked";
export type CompactAchievementTone = "default" | "hardcore" | "softcore" | "locked";

/** Lightweight selection payload used by existing dashboard rows. */
export interface CompactAchievementTarget {
  readonly game: {
    readonly providerId: ProviderId;
    readonly gameId: string;
    readonly title: string;
    readonly platformLabel?: string;
    readonly coverImageUrl?: string;
  };
  readonly achievement: Pick<
    NormalizedAchievement,
    "achievementId" | "title" | "classification" | "description" | "badgeImageUrl" |
    "isUnlocked" | "unlockedAt" | "hardcoreUnlockedAt" | "softcoreUnlockedAt" |
    "unlockMode" | "points" | "metrics"
  >;
}

export interface CompactAchievementMetadataItem {
  readonly key: string;
  readonly value: string;
}

export interface CompactAchievementRowViewModel {
  readonly achievementId: string;
  readonly title: string;
  readonly description?: string;
  readonly iconUrl?: string;
  readonly classification?: NormalizedAchievement["classification"];
  readonly isUnlocked: boolean;
  readonly unlockMode?: NormalizedAchievement["unlockMode"];
  readonly statusText: string;
  readonly timestampText?: string;
  readonly stateIndicator?: CompactAchievementStateKind;
  readonly metadata: readonly CompactAchievementMetadataItem[];
  readonly metadataPlacement: "rail" | "stack";
  readonly tone: CompactAchievementTone;
}

export interface CompactAchievementListViewModel {
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly rows: readonly CompactAchievementRowViewModel[];
  readonly supportsModeFilter: boolean;
  readonly initialVisibleCount: number;
}

export interface CompactAchievementDetailStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
  readonly fullWidth?: boolean;
  readonly communityProgress?: Readonly<{
    hardcorePercent: number;
    softcorePercent: number;
  }>;
}

export type CompactAchievementDetailBlock =
  | {
      readonly kind: "status";
      readonly title: string;
      readonly value: string;
      readonly secondary?: string;
      readonly tone: CompactAchievementTone;
    }
  | {
      readonly kind: "stats";
      readonly title: string;
      readonly stats: readonly CompactAchievementDetailStat[];
      readonly columns: 2 | 3;
    }
  | {
      readonly kind: "rarity";
      readonly title: string;
      readonly percent?: number;
      readonly caption: string;
      readonly stats: readonly CompactAchievementDetailStat[];
    }
  | {
      readonly kind: "timestamp";
      readonly title: string;
      readonly value: string;
      readonly secondary: string;
    };

export interface CompactAchievementDetailBadge {
  readonly key: string;
  readonly label: string;
  readonly tone: "default" | "success" | "points";
}

export interface CompactAchievementDetailViewModel {
  readonly providerId: ProviderId;
  readonly achievementId: string;
  readonly title: string;
  readonly description: string;
  readonly iconUrl?: string;
  readonly isUnlocked: boolean;
  readonly unlockMode?: NormalizedAchievement["unlockMode"];
  readonly classification?: NormalizedAchievement["classification"];
  readonly badges: readonly CompactAchievementDetailBadge[];
  readonly blocks: readonly CompactAchievementDetailBlock[];
  readonly game: {
    readonly providerId: ProviderId;
    readonly gameId: string;
    readonly title: string;
    readonly platformLabel: string;
    readonly artworkUrl?: string;
    readonly metrics?: readonly NormalizedMetric[];
  };
  readonly gamePlacement: "before-achievement" | "after-details";
  readonly showLegacyActions: boolean;
  readonly panelTitle?: string;
}

function getRowTone(achievement: NormalizedAchievement): CompactAchievementTone {
  if (!achievement.isUnlocked) {
    return "locked";
  }
  if (achievement.unlockMode === "hardcore") {
    return "hardcore";
  }
  if (achievement.unlockMode === "softcore") {
    return "softcore";
  }
  return "default";
}

function formatUnlockDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString();
}

function formatUnlockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString();
}

function getGameModel(snapshot: GameDetailSnapshot): CompactAchievementDetailViewModel["game"] {
  return {
    providerId: snapshot.game.providerId,
    gameId: snapshot.game.gameId,
    title: snapshot.game.title,
    platformLabel: snapshot.game.platformLabel ?? (snapshot.game.providerId === "steam" ? "Steam" : "Unknown platform"),
    ...(snapshot.game.coverImageUrl !== undefined ? { artworkUrl: snapshot.game.coverImageUrl } : {}),
    ...(snapshot.game.providerId === "retroachievements" ? { metrics: snapshot.game.metrics } : {}),
  };
}

function findAchievement(
  snapshot: GameDetailSnapshot,
  achievementId: string,
): NormalizedAchievement | undefined {
  return snapshot.achievements.find((achievement) => achievement.achievementId === achievementId);
}

function getRetroPoints(metrics: readonly NormalizedMetric[]): string {
  return formatMetricValue(getMetricValue(metrics, "true-ratio", "True Ratio")) ?? "-";
}

export function buildSteamCompactAchievementListModel(
  snapshot: GameDetailSnapshot,
): CompactAchievementListViewModel {
  return {
    providerId: snapshot.game.providerId,
    gameId: snapshot.game.gameId,
    gameTitle: snapshot.game.title,
    supportsModeFilter: false,
    initialVisibleCount: 12,
    rows: sortAchievementsForDisplay(snapshot.achievements).map((achievement) => {
      const steamHuntersAchievement = getSteamHuntersAchievementEnrichment(snapshot, achievement.achievementId);
      const communityPercent = getSteamAchievementCommunityPercent(achievement, steamHuntersAchievement);
      const metadata: CompactAchievementMetadataItem[] = [];
      if (steamHuntersAchievement?.points !== undefined) {
        metadata.push({ key: "points", value: `${formatCount(steamHuntersAchievement.points)} pts` });
      }
      if (communityPercent !== undefined) {
        metadata.push({
          key: "community-percentage",
          value: formatSteamHuntersPercentage(communityPercent),
        });
      }

      return {
        achievementId: achievement.achievementId,
        title: achievement.title,
        ...(achievement.description !== undefined ? { description: achievement.description } : {}),
        ...(achievement.badgeImageUrl !== undefined ? { iconUrl: achievement.badgeImageUrl } : {}),
        isUnlocked: achievement.isUnlocked,
        ...(achievement.unlockMode !== undefined ? { unlockMode: achievement.unlockMode } : {}),
        statusText: achievement.isUnlocked ? "Unlocked" : "Locked",
        ...(achievement.isUnlocked && achievement.unlockedAt !== undefined
          ? { timestampText: `Unlocked ${formatTimestamp(achievement.unlockedAt)}` }
          : {}),
        stateIndicator: achievement.isUnlocked ? "unlocked" : "locked",
        metadata,
        metadataPlacement: "rail",
        tone: getRowTone(achievement),
      };
    }),
  };
}

export function buildRetroAchievementsCompactAchievementListModel(
  snapshot: GameDetailSnapshot,
  preference: RetroAchievementsAchievementMode = "both",
): CompactAchievementListViewModel {
  const projected = snapshot.achievements.map((achievement) => {
    if (preference === "both") return achievement;
    const isUnlocked = isRetroAchievementsUnlockedInMode(achievement, preference);
    const unlockedAt = preference === "hardcore" ? achievement.hardcoreUnlockedAt : achievement.softcoreUnlockedAt;
    const { unlockMode: _originalMode, unlockedAt: _originalTime, ...rest } = achievement;
    return {
      ...rest,
      isUnlocked,
      ...(isUnlocked ? { unlockMode: preference } : {}),
      ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    };
  });
  return {
    providerId: snapshot.game.providerId,
    gameId: snapshot.game.gameId,
    gameTitle: snapshot.game.title,
    supportsModeFilter: preference === "both",
    initialVisibleCount: 12,
    rows: sortAchievementsForDisplay(projected).map((achievement) => {
      const pointsText = formatProviderAchievementPointsText(snapshot.game.providerId, achievement.points);
      const counts = getAchievementDetailCounts(achievement.metrics, snapshot.game.metrics);
      const metadata = [
        ...(pointsText === undefined ? [] : [{ key: "points", value: pointsText }]),
        ...(counts.unlockRatePercent === undefined ? [] : [{ key: "rarity", value: `${counts.unlockRatePercent.toFixed(1)}%` }]),
      ];
      return {
        achievementId: achievement.achievementId,
        title: achievement.title,
        ...(achievement.description !== undefined ? { description: achievement.description } : {}),
        ...(achievement.badgeImageUrl !== undefined ? { iconUrl: achievement.badgeImageUrl } : {}),
        ...(achievement.classification !== undefined ? { classification: achievement.classification } : {}),
        isUnlocked: achievement.isUnlocked,
        ...(achievement.unlockMode !== undefined ? { unlockMode: achievement.unlockMode } : {}),
        statusText: formatProviderAchievementStatusText(snapshot.game.providerId, achievement),
        stateIndicator: achievement.isUnlocked ? "unlocked" : "locked",
        metadata,
        metadataPlacement: "rail",
        tone: getRowTone(achievement),
      };
    }),
  };
}

export function buildCompactAchievementListModel(
  snapshot: GameDetailSnapshot,
  preference: RetroAchievementsAchievementMode = "both",
): CompactAchievementListViewModel {
  return snapshot.game.providerId === "steam"
    ? buildSteamCompactAchievementListModel(snapshot)
    : buildRetroAchievementsCompactAchievementListModel(snapshot, preference);
}

export function buildSteamCompactAchievementDetailModel(
  snapshot: GameDetailSnapshot,
  achievementId: string,
): CompactAchievementDetailViewModel | undefined {
  const achievement = findAchievement(snapshot, achievementId);
  if (achievement === undefined) {
    return undefined;
  }

  const steamHuntersAchievement = getSteamHuntersAchievementEnrichment(snapshot, achievementId);
  const badges: CompactAchievementDetailBadge[] = [];

  const blocks: CompactAchievementDetailBlock[] = [];
  if (achievement.isUnlocked && achievement.unlockedAt !== undefined) {
    blocks.push({
      kind: "timestamp",
      title: "Unlocked",
      value: formatUnlockDate(achievement.unlockedAt),
      secondary: formatUnlockTime(achievement.unlockedAt),
    });
  }

  const steamHuntersStats: CompactAchievementDetailStat[] = [];
  if (steamHuntersAchievement?.points !== undefined) {
    steamHuntersStats.push({
      key: "points",
      label: "Points",
      value: formatCount(steamHuntersAchievement.points),
    });
  }
  if (steamHuntersAchievement?.localPercentage !== undefined) {
    steamHuntersStats.push({
      key: "community-percentage",
      label: "Community",
      value: formatSteamHuntersPercentage(steamHuntersAchievement.localPercentage),
    });
  }
  if (steamHuntersAchievement !== undefined) steamHuntersStats.push({
    key: "players",
    label: "Players Unlocked",
    value: formatSteamHuntersPlayersUnlocked(steamHuntersAchievement.localPercentage, getSteamHuntersGameEnrichment(snapshot)?.app.playersQualifiedCount),
  });
  if (steamHuntersStats.length > 0) {
    blocks.push({ kind: "stats", title: "SteamHunters", stats: steamHuntersStats, columns: 2 });
  }

  return {
    providerId: snapshot.game.providerId,
    achievementId,
    title: achievement.title,
    description: achievement.description ?? "No description was returned for this achievement.",
    ...(achievement.badgeImageUrl !== undefined ? { iconUrl: achievement.badgeImageUrl } : {}),
    isUnlocked: achievement.isUnlocked,
    badges,
    blocks,
    game: getGameModel(snapshot),
    gamePlacement: "after-details",
    showLegacyActions: false,
  };
}

export function buildRetroAchievementsCompactAchievementDetailModel(
  snapshot: GameDetailSnapshot,
  achievementId: string,
  preference: RetroAchievementsAchievementMode = "both",
): CompactAchievementDetailViewModel | undefined {
  const source = findAchievement(snapshot, achievementId);
  if (source === undefined) {
    return undefined;
  }
  const isUnlocked = preference === "both" ? source.isUnlocked : isRetroAchievementsUnlockedInMode(source, preference);
  const unlockedAt = preference === "both" ? source.unlockedAt : preference === "hardcore" ? source.hardcoreUnlockedAt : source.softcoreUnlockedAt;
  const unlockMode = isUnlocked ? preference === "both" ? source.unlockMode : preference : undefined;
  const achievement = { ...source, isUnlocked, unlockedAt, unlockMode };
  const counts = getAchievementDetailCounts(achievement.metrics, snapshot.game.metrics);
  const hardcoreCommunityUnlocks = counts.totalPlayers !== undefined && counts.totalUnlockCount !== undefined && counts.hardcoreUnlockCount !== undefined
    ? Math.max(0, Math.min(counts.hardcoreUnlockCount, counts.totalUnlockCount, counts.totalPlayers))
    : undefined;
  const communityProgress = counts.totalPlayers !== undefined && counts.totalPlayers > 0
    && counts.totalUnlockCount !== undefined && hardcoreCommunityUnlocks !== undefined
    ? {
        hardcorePercent: hardcoreCommunityUnlocks / counts.totalPlayers * 100,
        softcorePercent: Math.max(0, Math.min(counts.totalUnlockCount, counts.totalPlayers) - hardcoreCommunityUnlocks) / counts.totalPlayers * 100,
      }
    : undefined;
  const stats: CompactAchievementDetailStat[] = [
    { key: "points", label: "Points", value: achievement.points === undefined ? "—" : formatCount(achievement.points) },
    { key: "retro-points", label: "RetroPoints", value: getRetroPoints(achievement.metrics) },
    ...(counts.unlockRatePercent === undefined ? [] : [{ key: "rarity", label: "Community", value: `${counts.unlockRatePercent.toFixed(2)}%`, fullWidth: true, ...(communityProgress === undefined ? {} : { communityProgress }) }]),
    ...(counts.totalUnlockCount === undefined ? [] : [{ key: "players", label: "Players Unlocked", value: formatCount(counts.totalUnlockCount) }]),
    ...(preference !== "softcore" && counts.hardcoreUnlockCount !== undefined ? [{ key: "hardcore-unlocks", label: "Hardcore Unlocks", value: formatCount(counts.hardcoreUnlockCount), fullWidth: preference === "hardcore" }] : []),
    ...(preference !== "hardcore" && counts.softcoreUnlockCount !== undefined ? [{ key: "softcore-unlocks", label: "Softcore Unlocks", value: formatCount(counts.softcoreUnlockCount), fullWidth: preference === "softcore" }] : []),
  ];
  const blocks: CompactAchievementDetailBlock[] = [
    ...(isUnlocked && unlockedAt !== undefined ? [{ kind: "timestamp" as const, title: unlockMode === undefined ? "Unlocked" : `Unlocked · ${unlockMode === "hardcore" ? "Hardcore" : "Softcore"}`, value: formatUnlockDate(unlockedAt), secondary: formatUnlockTime(unlockedAt) }] : []),
    { kind: "stats", title: "RetroAchievements", stats, columns: 2 },
  ];

  return {
    providerId: snapshot.game.providerId,
    achievementId,
    title: achievement.title,
    description: achievement.description ?? "",
    ...(achievement.badgeImageUrl !== undefined ? { iconUrl: achievement.badgeImageUrl } : {}),
    ...(achievement.classification !== undefined ? { classification: achievement.classification } : {}),
    isUnlocked: achievement.isUnlocked,
    ...(achievement.unlockMode !== undefined ? { unlockMode: achievement.unlockMode } : {}),
    badges: [],
    blocks,
    game: getGameModel(snapshot),
    gamePlacement: "after-details",
    showLegacyActions: false,
  };
}

export function buildCompactAchievementDetailModel(
  snapshot: GameDetailSnapshot,
  achievementId: string,
  preference: RetroAchievementsAchievementMode = "both",
): CompactAchievementDetailViewModel | undefined {
  return snapshot.game.providerId === "steam"
    ? buildSteamCompactAchievementDetailModel(snapshot, achievementId)
    : buildRetroAchievementsCompactAchievementDetailModel(snapshot, achievementId, preference);
}

export function getCompactAchievementFilterCounts(
  rows: readonly CompactAchievementRowViewModel[],
): Readonly<Record<CompactAchievementFilter, number>> {
  let unlocked = 0;
  for (const row of rows) {
    if (row.isUnlocked) {
      unlocked += 1;
    }
  }
  return { all: rows.length, unlocked, locked: rows.length - unlocked };
}

export function matchesCompactAchievementFilter(
  row: CompactAchievementRowViewModel,
  filter: CompactAchievementFilter,
): boolean {
  return filter === "all" || (filter === "unlocked" ? row.isUnlocked : !row.isUnlocked);
}

export function matchesCompactAchievementModeFilter(
  row: CompactAchievementRowViewModel,
  filter: CompactAchievementModeFilter,
): boolean {
  if (filter === "all" || !row.isUnlocked) {
    return true;
  }
  return filter === "hardcore" ? row.unlockMode !== "softcore" : row.unlockMode !== "hardcore";
}

export function getCompactAchievementLoadActions(visibleCount: number, totalCount: number): Readonly<{ showFiveMore: boolean; showAll: boolean }> {
  const hasMore = visibleCount < totalCount;
  return { showFiveMore: hasMore, showAll: hasMore };
}
