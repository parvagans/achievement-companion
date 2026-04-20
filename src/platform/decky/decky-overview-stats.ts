import type { NormalizedProfile } from "@core/domain";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";
import type { SteamLibraryAchievementScanOverview } from "./providers/steam";
import { getSteamAccountProgressSummary } from "./decky-stat-helpers";

export interface OverviewStat {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatOptionalCount(value: number | undefined): string {
  return value !== undefined ? formatCount(value) : "-";
}

function getMetricValue(metrics: NormalizedProfile["metrics"], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
}

export function buildProviderOverviewStats(
  profile: NormalizedProfile,
  steamLibraryAchievementScanSummary?: SteamLibraryAchievementScanOverview,
): readonly OverviewStat[] {
  if (profile.providerId === STEAM_PROVIDER_ID) {
    const ownedGames =
      steamLibraryAchievementScanSummary?.ownedGameCount ??
      steamLibraryAchievementScanSummary?.scannedGameCount ??
      profile.ownedGameCount;
    const achievementsUnlocked =
      steamLibraryAchievementScanSummary?.unlockedAchievements ?? profile.summary.unlockedCount;
    const perfectGames =
      steamLibraryAchievementScanSummary?.perfectGames ??
      Number(getMetricValue(profile.metrics, "games-beaten", "Perfect Games", "Games Beaten") ?? "0");
    const completionPercent =
      steamLibraryAchievementScanSummary?.completionPercent ?? profile.summary.completionPercent;

    return [
      {
        label: "Achievements Unlocked",
        value: formatCount(achievementsUnlocked),
      },
      {
        label: "Owned Games",
        value: formatOptionalCount(ownedGames),
      },
      {
        label: "Perfect Games",
        value: formatCount(perfectGames),
      },
      {
        label: "Completion",
        value: completionPercent !== undefined ? `${formatCount(completionPercent)}%` : "-",
      },
    ];
  }

  return [
    {
      label: "Points",
      value: getMetricValue(profile.metrics, "total-points", "Points") ?? "-",
    },
    {
      label: "Achievements Unlocked",
      value: formatCount(profile.summary.unlockedCount),
    },
    {
      label: "Games Beaten",
      value: getMetricValue(profile.metrics, "games-beaten", "Games Beaten") ?? "-",
    },
    {
      label: "Unlock rate",
      value: getMetricValue(profile.metrics, "retro-ratio", "unlock-rate", "Unlock Rate") ?? "-",
    },
  ];
}

export function getSteamOverviewProgress(profile: NormalizedProfile): {
  readonly steamLevelValue: string;
  readonly badgesValue: string;
  readonly badgesSecondary?: string;
  readonly xpProgressPercent?: number;
  readonly xpProgressCaption: string;
  readonly accountSubtitle: string;
} {
  const accountProgress = getSteamAccountProgressSummary({ profile });
  return accountProgress;
}
