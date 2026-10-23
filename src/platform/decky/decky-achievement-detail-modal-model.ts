import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { buildAchievementStatus, formatCount, formatTimestamp, getAchievementDescriptionText, getMetricValue, parseMetricNumber } from "./decky-achievement-detail-helpers";
import { projectRetroAchievementsFullScreenAchievements } from "./decky-retroachievements-full-screen-achievement-data";
import { getSteamHuntersAchievementEnrichment, getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { formatSteamHuntersPercentage, formatSteamHuntersPlayersUnlocked } from "./decky-steam-hunters-presentation";
export interface DeckyAchievementModalMetric {
  readonly label: string;
  readonly value: string;
  readonly tone?: "positive" | "hardcore" | "softcore" | "muted" | "warning" | "danger";
}

export interface DeckyAchievementModalModel {
  readonly gameTitle: string;
  readonly title: string;
  readonly description: string;
  readonly artworkUrl?: string;
  readonly isUnlocked: boolean;
  readonly isSteamProvider: boolean;
  readonly status: string;
  readonly metadata: readonly DeckyAchievementModalMetric[];
  readonly yourUnlockMetrics: readonly DeckyAchievementModalMetric[];
  readonly communityTitle: string;
  readonly communityMetrics: readonly DeckyAchievementModalMetric[];
}

function addMetric(metrics: DeckyAchievementModalMetric[], label: string, value: string | number | undefined, tone?: DeckyAchievementModalMetric["tone"]): void {
  if (value !== undefined && value !== "") {
    metrics.push({ label, value: typeof value === "number" ? formatCount(value) : value, ...(tone !== undefined ? { tone } : {}) });
  }
}

function validCount(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function countMetric(achievement: NormalizedAchievement, key: string): number | undefined {
  return validCount(parseMetricNumber(achievement.metrics, key));
}

function validPercentage(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

function meaningfulGroupName(name: string | undefined, gameTitle: string): string | undefined {
  const trimmed = name?.trim();
  const normalized = trimmed?.toLocaleLowerCase().replace(/[\s_-]+/gu, " ");
  if (!trimmed || normalized === "base game" || normalized === "basegame" || normalized === "base"
    || normalized === gameTitle.trim().toLocaleLowerCase().replace(/[\s_-]+/gu, " ")) return undefined;
  return trimmed;
}

/** A provider-sourced view model shared by full-screen, QAM, and saved-link openings. */
export function buildDeckyAchievementModalModel(
  snapshot: GameDetailSnapshot,
  achievementId: string,
  mode: RetroAchievementsAchievementMode,
): DeckyAchievementModalModel | undefined {
  const isSteamProvider = snapshot.game.providerId === "steam";
  const projectedAchievement = projectRetroAchievementsFullScreenAchievements(snapshot, mode)
    .find((entry) => entry.achievementId === achievementId);
  if (projectedAchievement === undefined) return undefined;
  const selectedModeTimestamp = mode === "hardcore" ? projectedAchievement.hardcoreUnlockedAt
    : mode === "softcore" ? projectedAchievement.softcoreUnlockedAt : undefined;
  // A real timestamp for the selected mode is stronger evidence than the list's
  // highest-mode projection, which can hide a prior Softcore unlock.
  const achievement = !isSteamProvider && mode !== "both" && selectedModeTimestamp !== undefined
    ? { ...projectedAchievement, isUnlocked: true, unlockMode: mode, unlockedAt: selectedModeTimestamp }
    : projectedAchievement;

  const yourUnlockMetrics: DeckyAchievementModalMetric[] = [];
  const metadata: DeckyAchievementModalMetric[] = [];
  const status = buildAchievementStatus(achievement).value;
  if (isSteamProvider) {
    addMetric(yourUnlockMetrics, achievement.isUnlocked ? "Unlocked" : "Your unlock",
      achievement.isUnlocked ? achievement.unlockedAt !== undefined ? formatTimestamp(achievement.unlockedAt) : "Date not recorded" : "Locked",
      achievement.isUnlocked ? "positive" : "muted");
  } else {
    if (achievement.hardcoreUnlockedAt !== undefined && achievement.hardcoreUnlockedAt === achievement.softcoreUnlockedAt) {
      addMetric(yourUnlockMetrics, "Hardcore + Softcore", formatTimestamp(achievement.hardcoreUnlockedAt), "hardcore");
    } else {
      if (achievement.hardcoreUnlockedAt !== undefined) addMetric(yourUnlockMetrics, "Hardcore unlock", formatTimestamp(achievement.hardcoreUnlockedAt), "hardcore");
      if (achievement.softcoreUnlockedAt !== undefined) addMetric(yourUnlockMetrics, "Softcore unlock", formatTimestamp(achievement.softcoreUnlockedAt), "softcore");
    }
    const selectedModeDate = mode === "hardcore" ? achievement.hardcoreUnlockedAt : mode === "softcore" ? achievement.softcoreUnlockedAt : undefined;
    if (yourUnlockMetrics.length === 0) {
      const recordedDate = achievement.unlockedAt ?? snapshot.achievements.find((entry) => entry.achievementId === achievementId)?.unlockedAt;
      addMetric(yourUnlockMetrics, achievement.isUnlocked ? status : mode === "both" ? "Your unlock" : `${mode === "hardcore" ? "Hardcore" : "Softcore"} unlock`,
        achievement.isUnlocked ? recordedDate !== undefined ? formatTimestamp(recordedDate) : "Date not recorded" : "Locked",
        achievement.isUnlocked ? achievement.unlockMode ?? "positive" : "muted");
    } else if (mode !== "both" && selectedModeDate === undefined && !achievement.isUnlocked) {
      addMetric(yourUnlockMetrics, `${mode === "hardcore" ? "Hardcore" : "Softcore"} unlock`, "Locked", "muted");
    }
    if (achievement.classification !== undefined) {
      addMetric(metadata, "Type", achievement.classification === "win-condition" ? "Win Condition" : achievement.classification === "missable" ? "Missable" : "Progression");
    }
    addMetric(metadata, "Author", getMetricValue(achievement.metrics, "author"));
  }

  const communityMetrics: DeckyAchievementModalMetric[] = [];
  if (isSteamProvider) {
    const enrichment = getSteamHuntersGameEnrichment(snapshot);
    const hunter = getSteamHuntersAchievementEnrichment(snapshot, achievementId);
    addMetric(communityMetrics, "SteamHunters points", hunter?.points);
    const qualifiedRate = validPercentage(hunter?.localPercentage);
    const qualifiedPlayers = validCount(enrichment?.app.playersQualifiedCount);
    if (qualifiedRate !== undefined && qualifiedPlayers !== undefined && qualifiedPlayers > 0) {
      addMetric(communityMetrics, "SteamHunters qualified players", `${formatSteamHuntersPlayersUnlocked(qualifiedRate, qualifiedPlayers)} (${formatSteamHuntersPercentage(qualifiedRate)})`);
    } else if (qualifiedRate !== undefined) {
      addMetric(communityMetrics, "SteamHunters qualified-player rate", formatSteamHuntersPercentage(qualifiedRate));
    }
    const globalPercent = validPercentage(parseMetricNumber(achievement.metrics, "global-percent"));
    if (globalPercent !== undefined) addMetric(communityMetrics, "Steam global unlock rate", formatSteamHuntersPercentage(globalPercent));
    if (hunter?.obtainability !== undefined && hunter.obtainability !== "unknown" && hunter.obtainability !== "obtainable") {
      addMetric(communityMetrics, "Obtainability", hunter.obtainability.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" "), hunter.obtainability === "unobtainable" ? "danger" : "warning");
    }
    const group = enrichment?.achievementGroupsBySteamAchievementId[achievementId];
    addMetric(metadata, group?.dlcAppName !== undefined ? "DLC" : "Group", meaningfulGroupName(group?.dlcAppName ?? group?.name, snapshot.game.title));
  } else {
    const totalUnlockCount = countMetric(achievement, "unlocked-count");
    const totalPlayers = validCount(parseMetricNumber(snapshot.game.metrics, "total-players", "Total Players"));
    addMetric(communityMetrics, "Points", achievement.points);
    addMetric(communityMetrics, "RetroPoints", getMetricValue(achievement.metrics, "true-ratio"));
    if (totalUnlockCount !== undefined) {
      const rate = totalPlayers !== undefined && totalPlayers > 0 ? validPercentage(totalUnlockCount / totalPlayers * 100) : undefined;
      addMetric(communityMetrics, "Players unlocked", rate !== undefined && totalPlayers !== undefined
        ? `${formatCount(totalUnlockCount)} / ${formatCount(totalPlayers)} (${rate.toFixed(2)}%)`
        : totalUnlockCount);
    }
    const hardcore = countMetric(achievement, "hardcore-unlocked-count");
    const softcoreOnly = countMetric(achievement, "softcore-unlocked-count");
    const modeCounts = [
      hardcore !== undefined && (totalUnlockCount === undefined || hardcore <= totalUnlockCount) ? `${formatCount(hardcore)} Hardcore` : undefined,
      softcoreOnly !== undefined && (totalUnlockCount === undefined || softcoreOnly <= totalUnlockCount) ? `${formatCount(softcoreOnly)} Softcore-only` : undefined,
    ].filter((value): value is string => value !== undefined);
    if (modeCounts.length > 0) addMetric(communityMetrics, "Unlock modes", modeCounts.join(" · "));
  }

  return {
    gameTitle: snapshot.game.title,
    title: achievement.title,
    description: getAchievementDescriptionText(achievement.description),
    ...(achievement.badgeImageUrl !== undefined ? { artworkUrl: achievement.badgeImageUrl } : {}),
    isUnlocked: achievement.isUnlocked,
    isSteamProvider,
    status,
    metadata,
    yourUnlockMetrics,
    communityTitle: isSteamProvider ? "SteamHunters and Steam" : "RetroAchievements",
    communityMetrics,
  };
}

