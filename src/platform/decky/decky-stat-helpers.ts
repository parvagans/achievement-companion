import type {
  CompletionProgressSnapshot,
  CompletionProgressSummary,
  DashboardSnapshot,
  NormalizedGame,
  RecentlyPlayedGame,
} from "@core/domain";
import { formatCompletionProgressFilterLabel, type CompletionProgressFilter } from "@core/settings";
import { STEAM_PROVIDER_ID } from "../../providers/steam";
import type { SteamLibraryAchievementScanOverview } from "./providers/steam";
import { formatSteamXp, getSteamXpProgress } from "./steam-xp";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatOptionalCount(value: number | undefined): string {
  return value !== undefined ? formatCount(value) : "-";
}

function getMetricValue(metrics: DashboardSnapshot["profile"]["metrics"], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key || metric.label === key);
    if (match !== undefined) {
      return match.value;
    }
  }

  return undefined;
}

export function formatProfileMemberSince(
  metrics: DashboardSnapshot["profile"]["metrics"],
): string | undefined {
  const memberSince = getMetricValue(metrics, "member-since", "Member Since");
  if (memberSince === undefined) {
    return undefined;
  }

  const parsedMemberSince = Date.parse(memberSince);
  if (!Number.isFinite(parsedMemberSince)) {
    return undefined;
  }

  return new Date(parsedMemberSince).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(epochMs: number | undefined): string | undefined {
  if (epochMs === undefined) {
    return undefined;
  }

  const elapsedMs = Date.now() - epochMs;
  const absoluteMs = Math.abs(elapsedMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  if (absoluteMs < 60_000) {
    const value = Math.max(1, Math.round(absoluteMs / 1000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "second");
  }

  if (absoluteMs < 3_600_000) {
    const value = Math.max(1, Math.round(absoluteMs / 60_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "minute");
  }

  if (absoluteMs < 86_400_000) {
    const value = Math.max(1, Math.round(absoluteMs / 3_600_000));
    return formatter.format(elapsedMs >= 0 ? -value : value, "hour");
  }

  const value = Math.max(1, Math.round(absoluteMs / 86_400_000));
  return formatter.format(elapsedMs >= 0 ? -value : value, "day");
}

export function formatSteamPlaytimeMinutes(minutes: number | undefined): string | undefined {
  if (minutes === undefined) {
    return undefined;
  }

  const normalizedMinutes = Math.max(0, Math.trunc(minutes));
  if (normalizedMinutes < 60) {
    return `${normalizedMinutes}m`;
  }

  const hours = Math.floor(normalizedMinutes / 60);
  const remainderMinutes = normalizedMinutes % 60;
  if (remainderMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainderMinutes}m`;
}

export function getSteamCompletionProgressGameDetailId(
  game: Pick<NormalizedGame, "appid" | "gameId">,
): string {
  if (typeof game.appid === "number" && Number.isFinite(game.appid) && game.appid > 0) {
    return String(Math.trunc(game.appid));
  }

  return game.gameId;
}

export interface ProfileStatDescriptor {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
}

export interface SteamAccountProgressSummary {
  readonly steamLevelValue: string;
  readonly badgesValue: string;
  readonly badgesSecondary?: string;
  readonly xpProgressPercent?: number;
  readonly xpProgressCaption: string;
  readonly accountSubtitle: string;
}

export interface SteamAccountProgressCardDescriptor {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string;
}

export function getSteamAccountProgressSummary(args: {
  readonly profile: DashboardSnapshot["profile"];
}): SteamAccountProgressSummary {
  const { profile } = args;
  const steamLevelValue =
    getMetricValue(profile.metrics, "steam-level", "Steam Level") ?? profile.steamLevel?.toString() ?? "-";
  const badgesValue = profile.badgeCount !== undefined ? formatCount(profile.badgeCount) : "-";
  const badgesSecondary =
    profile.playerXp !== undefined ? `${formatSteamXp(profile.playerXp)} XP` : undefined;
  const steamXpProgress = getSteamXpProgress(profile.steamLevel, profile.playerXp);

  return {
    steamLevelValue,
    badgesValue,
    ...(badgesSecondary !== undefined ? { badgesSecondary } : {}),
    ...(steamXpProgress !== undefined ? { xpProgressPercent: steamXpProgress.progressPercent } : {}),
    xpProgressCaption: steamXpProgress?.caption ?? "XP unavailable",
    accountSubtitle:
      steamLevelValue !== "-" && profile.playerXp !== undefined
        ? `Level ${steamLevelValue} \u00b7 ${badgesSecondary ?? `${formatSteamXp(profile.playerXp)} XP`}`
        : "XP unavailable",
  };
}

export function getSteamAccountProgressCards(args: {
  readonly profile: DashboardSnapshot["profile"];
}): readonly SteamAccountProgressCardDescriptor[] {
  const summary = getSteamAccountProgressSummary(args);

  return [
    {
      label: "Badges",
      value: summary.badgesValue,
      ...(summary.badgesSecondary !== undefined ? { secondary: summary.badgesSecondary } : {}),
    },
  ];
}

export function getSteamProfileStats(args: {
  readonly profile: DashboardSnapshot["profile"];
  readonly steamLibraryAchievementScanSummary?: SteamLibraryAchievementScanOverview;
}): readonly ProfileStatDescriptor[] {
  const { profile, steamLibraryAchievementScanSummary } = args;
  const ownedGames =
    steamLibraryAchievementScanSummary?.ownedGameCount ??
    profile.ownedGameCount ??
    (() => {
      const metricValue = getMetricValue(profile.metrics, "owned-games", "Owned Games");
      const parsed = metricValue !== undefined ? Number(metricValue) : Number.NaN;
      return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
    })();
  const achievementsUnlocked =
    steamLibraryAchievementScanSummary?.unlockedAchievements ?? profile.summary.unlockedCount;
  const perfectGames =
    steamLibraryAchievementScanSummary?.perfectGames ??
    Number(getMetricValue(profile.metrics, "games-beaten", "Perfect Games", "Games Beaten") ?? "0");
  const completionPercent =
    steamLibraryAchievementScanSummary?.completionPercent ?? profile.summary.completionPercent;
  const parsedLastLibraryScan =
    steamLibraryAchievementScanSummary !== undefined
      ? Date.parse(steamLibraryAchievementScanSummary.scannedAt)
      : undefined;
  const lastLibraryScan =
    parsedLastLibraryScan !== undefined && Number.isFinite(parsedLastLibraryScan)
      ? formatRelativeTime(parsedLastLibraryScan)
      : undefined;

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
    ...(lastLibraryScan !== undefined
      ? [
          {
            label: "Last Library Scan",
            value: lastLibraryScan,
          },
        ]
      : []),
  ];
}

export function getDeckyProfileStats(args: {
  readonly profile: DashboardSnapshot["profile"];
  readonly steamLibraryAchievementScanSummary?: SteamLibraryAchievementScanOverview;
}): readonly ProfileStatDescriptor[] {
  if (args.profile.providerId === STEAM_PROVIDER_ID) {
    return getSteamProfileStats(args);
  }

  const memberSince = formatProfileMemberSince(args.profile.metrics);

  return [
    {
      label: "Total points",
      value: getMetricValue(args.profile.metrics, "total-points", "Points") ?? "-",
    },
    {
      label: "Softcore points",
      value: getMetricValue(args.profile.metrics, "softcore-points", "Softcore") ?? "-",
    },
    {
      label: "True points",
      value: getMetricValue(args.profile.metrics, "true-points", "True") ?? "-",
    },
    {
      label: "Member since",
      value: memberSince ?? "-",
    },
  ] as const;
}

export function formatCompletionProgressFilterLabelForProvider(
  filter: CompletionProgressFilter,
  providerId: string,
): string {
  if (providerId === STEAM_PROVIDER_ID) {
    if (filter === "beaten") {
      return "Skipped";
    }

    if (filter === "mastered") {
      return "Perfect";
    }
  }

  return formatCompletionProgressFilterLabel(filter);
}

export function formatCompletionProgressSummary(
  summary: CompletionProgressSnapshot["summary"] | CompletionProgressSummary,
  providerId: string,
): string {
  const labels =
    providerId === STEAM_PROVIDER_ID
      ? ["Played", "Unfinished", "Skipped", "Perfect"]
      : ["Played", "Unfinished", "Beaten", "Mastered"];

  return [
    `${formatCount(summary.playedCount)} ${labels[0]}`,
    `${formatCount(summary.unfinishedCount)} ${labels[1]}`,
    `${formatCount(summary.beatenCount)} ${labels[2]}`,
    `${formatCount(summary.masteredCount)} ${labels[3]}`,
  ].join(" | ");
}

export function formatCompletionProgressStatusLabel(
  status: NormalizedGame["status"],
  providerId: string,
): string {
  if (status === "in_progress") {
    return "Unfinished";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "beaten") {
    return "Beaten";
  }

  if (status === "mastered") {
    return providerId === STEAM_PROVIDER_ID ? "Perfect" : "Mastered";
  }

  return "Locked";
}
