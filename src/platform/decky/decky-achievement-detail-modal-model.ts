import type { GameDetailSnapshot, NormalizedAchievement } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { buildAchievementStatus, formatCount, getAchievementDescriptionText, getMetricValue, parseMetricNumber } from "./decky-achievement-detail-helpers";
import { projectRetroAchievementsFullScreenAchievements } from "./decky-retroachievements-full-screen-achievement-data";
import { getSteamHuntersAchievementEnrichment, getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { formatSteamHuntersPercentage, formatSteamHuntersPlayersUnlocked } from "./decky-steam-hunters-presentation";
export interface DeckyAchievementModalMetric {
  readonly label: string;
  readonly value: string;
  readonly tone?: "positive" | "hardcore" | "softcore" | "muted" | "warning" | "danger";
  readonly icon?: "date" | "time" | "points" | "steam-hunters" | "community" | "players";
  readonly valueTone?: "points" | "retro-points";
  readonly progress?: { readonly percent: number; readonly hardcorePercent?: number };
}

export interface DeckyAchievementModalModel {
  readonly gameTitle: string;
  readonly title: string;
  readonly description: string;
  readonly artworkUrl?: string;
  readonly isUnlocked: boolean;
  readonly isSteamProvider: boolean;
  readonly status: string;
  readonly unlockHeading?: string;
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

function addUnlockDateMetrics(metrics: DeckyAchievementModalMetric[], isUnlocked: boolean, timestamp: number | undefined): void {
  if (isUnlocked && timestamp !== undefined && Number.isFinite(new Date(timestamp).getTime())) {
    metrics.push(
      { label: "Date", value: new Date(timestamp).toLocaleDateString(), icon: "date" },
      { label: "Time", value: new Date(timestamp).toLocaleTimeString(), icon: "time" },
    );
  } else {
    addMetric(metrics, "Your unlock", isUnlocked ? "Date not recorded" : "Not yet unlocked", "muted");
  }
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
  let unlockHeading: string | undefined;
  if (isSteamProvider) {
    unlockHeading = achievement.isUnlocked ? "Unlocked" : "Locked";
    addUnlockDateMetrics(yourUnlockMetrics, achievement.isUnlocked, achievement.unlockedAt);
  } else {
    // In Both, Hardcore takes precedence: RA also records its timestamp in the
    // Softcore field. That is one earned unlock, not two different modes.
    const earnedMode = achievement.unlockMode ?? (achievement.hardcoreUnlockedAt !== undefined ? "hardcore"
      : achievement.softcoreUnlockedAt !== undefined ? "softcore" : undefined);
    unlockHeading = achievement.isUnlocked
      ? `Unlocked${earnedMode === undefined ? "" : ` · ${earnedMode === "hardcore" ? "Hardcore" : "Softcore"}`}`
      : `Locked${mode === "both" ? "" : ` · ${mode === "hardcore" ? "Hardcore" : "Softcore"}`}`;
    const source = snapshot.achievements.find((entry) => entry.achievementId === achievementId)!;
    const recordedDate = earnedMode === "hardcore" ? achievement.hardcoreUnlockedAt
      : earnedMode === "softcore" ? achievement.softcoreUnlockedAt : undefined;
    const timestamp = recordedDate ?? achievement.unlockedAt ?? (source.unlockMode === earnedMode ? source.unlockedAt : undefined);
    addUnlockDateMetrics(yourUnlockMetrics, achievement.isUnlocked, timestamp);
    if (achievement.classification !== undefined) {
      addMetric(metadata, "Type", achievement.classification === "win-condition" ? "Win Condition" : achievement.classification === "missable" ? "Missable" : "Progression");
    }
    addMetric(metadata, "Author", getMetricValue(achievement.metrics, "author"));
  }

  const communityMetrics: DeckyAchievementModalMetric[] = [];
  let communityTitle = "RetroAchievements";
  if (isSteamProvider) {
    const enrichment = getSteamHuntersGameEnrichment(snapshot);
    const hunter = getSteamHuntersAchievementEnrichment(snapshot, achievementId);
    if (hunter?.points !== undefined) communityMetrics.push({ label: "Points", value: formatCount(hunter.points), icon: "steam-hunters" });
    const qualifiedRate = validPercentage(hunter?.localPercentage);
    const qualifiedPlayers = validCount(enrichment?.app.playersQualifiedCount);
    if (qualifiedRate !== undefined) {
      communityMetrics.push({ label: "Community", value: formatSteamHuntersPercentage(qualifiedRate), icon: "community" });
      if (qualifiedPlayers !== undefined && qualifiedPlayers > 0) {
        communityMetrics.push({ label: "Players unlocked", value: formatSteamHuntersPlayersUnlocked(qualifiedRate, qualifiedPlayers), icon: "players" });
      }
    }
    const globalPercent = validPercentage(parseMetricNumber(achievement.metrics, "global-percent"));
    // Keep Steam's global population explicitly separate from the qualified
    // SteamHunters population, even when their percentages happen to match.
    if (globalPercent !== undefined) communityMetrics.push({ label: "Steam global", value: formatSteamHuntersPercentage(globalPercent), icon: "community" });
    if (hunter?.obtainability !== undefined && hunter.obtainability !== "unknown" && hunter.obtainability !== "obtainable") {
      addMetric(communityMetrics, "Obtainability", hunter.obtainability.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" "), hunter.obtainability === "unobtainable" ? "danger" : "warning");
    }
    const hasHuntersMetrics = communityMetrics.some((metric) => metric.label !== "Steam global");
    communityTitle = hasHuntersMetrics ? globalPercent !== undefined ? "SteamHunters · Steam" : "SteamHunters" : "Steam";
    const group = enrichment?.achievementGroupsBySteamAchievementId[achievementId];
    addMetric(metadata, group?.dlcAppName !== undefined ? "DLC" : "Group", meaningfulGroupName(group?.dlcAppName ?? group?.name, snapshot.game.title));
  } else {
    const totalUnlockCount = countMetric(achievement, "unlocked-count");
    const totalPlayers = validCount(parseMetricNumber(snapshot.game.metrics, "total-players", "Total Players"));
    if (achievement.points !== undefined) communityMetrics.push({ label: "Points", value: formatCount(achievement.points), icon: "points", valueTone: "points" });
    const retroPoints = getMetricValue(achievement.metrics, "true-ratio");
    if (retroPoints !== undefined) communityMetrics.push({ label: "RetroPoints", value: retroPoints, icon: "points", valueTone: "retro-points" });
    const hardcore = countMetric(achievement, "hardcore-unlocked-count");
    const softcoreOnly = countMetric(achievement, "softcore-unlocked-count");
    if (totalUnlockCount !== undefined) {
      const rate = totalPlayers !== undefined && totalPlayers > 0 ? validPercentage(totalUnlockCount / totalPlayers * 100) : undefined;
      if (rate !== undefined) communityMetrics.push({ label: "Community", value: `${rate.toFixed(2)}%`, icon: "community",
        progress: { percent: rate, ...(hardcore !== undefined && hardcore <= totalUnlockCount ? { hardcorePercent: hardcore / totalPlayers! * 100 } : {}) } });
      communityMetrics.push({ label: "Players unlocked", value: formatCount(totalUnlockCount), icon: "players" });
    }
    if (hardcore !== undefined && (totalUnlockCount === undefined || hardcore <= totalUnlockCount)) communityMetrics.push({ label: "Hardcore unlocks", value: formatCount(hardcore), icon: "players", tone: "hardcore" });
    if (softcoreOnly !== undefined && (totalUnlockCount === undefined || softcoreOnly <= totalUnlockCount)) communityMetrics.push({ label: "Softcore-only", value: formatCount(softcoreOnly), icon: "players", tone: "softcore" });
  }

  return {
    gameTitle: snapshot.game.title,
    title: achievement.title,
    description: getAchievementDescriptionText(achievement.description),
    ...(achievement.badgeImageUrl !== undefined ? { artworkUrl: achievement.badgeImageUrl } : {}),
    isUnlocked: achievement.isUnlocked,
    isSteamProvider,
    status,
    ...(unlockHeading !== undefined ? { unlockHeading } : {}),
    metadata,
    yourUnlockMetrics,
    communityTitle,
    communityMetrics,
  };
}

