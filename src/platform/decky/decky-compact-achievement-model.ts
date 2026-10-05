import type { GameDetailSnapshot, NormalizedAchievement, NormalizedMetric, ProviderId } from "@core/domain";
import { getSteamHuntersAchievementEnrichment, getSteamHuntersGameEnrichment } from "../../providers/steamhunters/compose-steam-game-detail";
import {
  buildAchievementStatus,
  formatAchievementDetailUnlockRatePercent,
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
  readonly classification?: NormalizedAchievement["classification"];
  readonly badges: readonly CompactAchievementDetailBadge[];
  readonly blocks: readonly CompactAchievementDetailBlock[];
  readonly game: {
    readonly providerId: ProviderId;
    readonly gameId: string;
    readonly title: string;
    readonly platformLabel: string;
    readonly artworkUrl?: string;
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
      const metadata: CompactAchievementMetadataItem[] = [];
      if (steamHuntersAchievement?.points !== undefined) {
        metadata.push({ key: "points", value: `${formatCount(steamHuntersAchievement.points)} pts` });
      }
      if (steamHuntersAchievement?.localPercentage !== undefined) {
        metadata.push({
          key: "community-percentage",
          value: formatSteamHuntersPercentage(steamHuntersAchievement.localPercentage),
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
): CompactAchievementListViewModel {
  return {
    providerId: snapshot.game.providerId,
    gameId: snapshot.game.gameId,
    gameTitle: snapshot.game.title,
    supportsModeFilter: true,
    initialVisibleCount: 3,
    rows: sortAchievementsForDisplay(snapshot.achievements).map((achievement) => {
      const pointsText = formatProviderAchievementPointsText(snapshot.game.providerId, achievement.points);
      return {
        achievementId: achievement.achievementId,
        title: achievement.title,
        ...(achievement.badgeImageUrl !== undefined ? { iconUrl: achievement.badgeImageUrl } : {}),
        ...(achievement.classification !== undefined ? { classification: achievement.classification } : {}),
        isUnlocked: achievement.isUnlocked,
        ...(achievement.unlockMode !== undefined ? { unlockMode: achievement.unlockMode } : {}),
        statusText: formatProviderAchievementStatusText(snapshot.game.providerId, achievement),
        ...(achievement.unlockedAt !== undefined
          ? { timestampText: `Unlocked ${formatTimestamp(achievement.unlockedAt)}` }
          : {}),
        metadata: pointsText === undefined ? [] : [{ key: "points", value: pointsText }],
        metadataPlacement: "stack",
        tone: getRowTone(achievement),
      };
    }),
  };
}

export function buildCompactAchievementListModel(
  snapshot: GameDetailSnapshot,
): CompactAchievementListViewModel {
  return snapshot.game.providerId === "steam"
    ? buildSteamCompactAchievementListModel(snapshot)
    : buildRetroAchievementsCompactAchievementListModel(snapshot);
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
): CompactAchievementDetailViewModel | undefined {
  const achievement = findAchievement(snapshot, achievementId);
  if (achievement === undefined) {
    return undefined;
  }

  const counts = getAchievementDetailCounts(achievement.metrics, snapshot.game.metrics);
  const status = buildAchievementStatus(achievement);
  const statusSecondary = achievement.isUnlocked && achievement.unlockedAt !== undefined
    ? `Unlocked ${formatTimestamp(achievement.unlockedAt)}`
    : undefined;
  const countStats: CompactAchievementDetailStat[] = [];
  if (counts.softcoreUnlockCount !== undefined) {
    countStats.push({ key: "softcore", label: "Softcore unlocks", value: formatCount(counts.softcoreUnlockCount) });
  }
  if (counts.hardcoreUnlockCount !== undefined) {
    countStats.push({ key: "hardcore", label: "Hardcore unlocks", value: formatCount(counts.hardcoreUnlockCount) });
  }
  if (counts.totalPlayers !== undefined) {
    countStats.push({ key: "players", label: "Total players", value: formatCount(counts.totalPlayers) });
  }

  const blocks: CompactAchievementDetailBlock[] = [
    {
      kind: "status",
      title: "Status",
      value: status.value,
      ...(statusSecondary !== undefined ? { secondary: statusSecondary } : {}),
      tone: getRowTone(achievement),
    },
    {
      kind: "stats",
      title: "Unlock details",
      columns: 2,
      stats: [
        {
          key: "points",
          label: "Points",
          value: achievement.points !== undefined ? formatCount(achievement.points) : "-",
        },
        { key: "retro-points", label: "RetroPoints", value: getRetroPoints(achievement.metrics) },
      ],
    },
    {
      kind: "rarity",
      title: "Rarity",
      ...(counts.unlockRatePercent !== undefined ? { percent: counts.unlockRatePercent } : {}),
      caption: formatAchievementDetailUnlockRatePercent(counts.unlockRatePercent),
      stats: countStats,
    },
  ];

  return {
    providerId: snapshot.game.providerId,
    achievementId,
    title: achievement.title,
    description: achievement.description ?? "",
    ...(achievement.badgeImageUrl !== undefined ? { iconUrl: achievement.badgeImageUrl } : {}),
    ...(achievement.classification !== undefined ? { classification: achievement.classification } : {}),
    isUnlocked: achievement.isUnlocked,
    badges: [],
    blocks,
    game: getGameModel(snapshot),
    gamePlacement: "before-achievement",
    showLegacyActions: true,
    panelTitle: "Achievement details",
  };
}

export function buildCompactAchievementDetailModel(
  snapshot: GameDetailSnapshot,
  achievementId: string,
): CompactAchievementDetailViewModel | undefined {
  return snapshot.game.providerId === "steam"
    ? buildSteamCompactAchievementDetailModel(snapshot, achievementId)
    : buildRetroAchievementsCompactAchievementDetailModel(snapshot, achievementId);
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
