import type { NormalizedProfile } from "@core/domain";
import { readDeckyStorageText, writeDeckyStorageTextPreservingExisting } from "./storage";

export type RetroAchievementsRankKind = "site" | "casual";
export type RetroAchievementsRankTrend = "up" | "down";

const STORAGE_KEY_PREFIX = "achievement-companion:decky:ra-rank-trend:v1:";

interface RankTrendEntry {
  readonly version: 1;
  readonly accountId: string;
  readonly ranks: Readonly<Partial<Record<RetroAchievementsRankKind, number>>>;
  readonly trends: Readonly<Partial<Record<RetroAchievementsRankKind, RetroAchievementsRankTrend>>>;
}

function storageKey(accountId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(accountId)}`;
}

function rankValue(profile: NormalizedProfile | undefined, kind: RetroAchievementsRankKind): number | undefined {
  if (profile === undefined) return undefined;
  const metricKeys = kind === "site" ? ["site-rank", "Rank"] : ["casual-rank", "softcore-rank", "Casual Rank", "Softcore Rank"];
  for (const key of metricKeys) {
    const raw = profile.metrics.find((metric) => metric.key === key || metric.label === key)?.value;
    if (raw === undefined) continue;
    const match = /^\s*#?\s*([\d,]+)\s*$/u.exec(raw);
    const value = match === null ? Number.NaN : Number(match[1]!.replaceAll(",", ""));
    if (Number.isSafeInteger(value) && value > 0) return value;
  }
  return undefined;
}

function readEntry(accountId: string): RankTrendEntry | undefined {
  const raw = readDeckyStorageText(storageKey(accountId));
  if (raw === undefined) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<RankTrendEntry>;
    if (value.version !== 1 || value.accountId !== accountId || typeof value.ranks !== "object" || value.ranks === null || typeof value.trends !== "object" || value.trends === null) return undefined;
    return value as RankTrendEntry;
  } catch {
    return undefined;
  }
}

/** Compare fresh RA ranks with the previous successful dashboard snapshot. */
export function updateDeckyRetroAchievementsRankTrends(
  profile: NormalizedProfile,
  previousProfile?: NormalizedProfile,
): void {
  if (profile.providerId !== "retroachievements") return;
  const accountId = profile.identity.accountId;
  const existing = readEntry(accountId);
  const previousRanks: Partial<Record<RetroAchievementsRankKind, number>> = { ...(existing?.ranks ?? {}) };
  if (existing === undefined && previousProfile?.providerId === "retroachievements" && previousProfile.identity.accountId === accountId) {
    for (const kind of ["site", "casual"] as const) {
      const value = rankValue(previousProfile, kind);
      if (value !== undefined) previousRanks[kind] = value;
    }
  }

  const ranks: Partial<Record<RetroAchievementsRankKind, number>> = { ...previousRanks };
  // A rank that has not moved since the last refresh retains its last known
  // direction; an unchanged API response is not evidence that the trend ended.
  const trends: Partial<Record<RetroAchievementsRankKind, RetroAchievementsRankTrend>> = {
    ...(existing?.trends ?? {}),
  };
  for (const kind of ["site", "casual"] as const) {
    const current = rankValue(profile, kind);
    if (current === undefined) continue;
    const previous = previousRanks[kind];
    if (previous !== undefined && current !== previous) trends[kind] = current < previous ? "up" : "down";
    ranks[kind] = current;
  }

  const entry: RankTrendEntry = { version: 1, accountId, ranks, trends };
  writeDeckyStorageTextPreservingExisting(storageKey(accountId), JSON.stringify(entry));
}

export function getDeckyRetroAchievementsRankTrend(
  accountId: string,
  kind: RetroAchievementsRankKind,
): RetroAchievementsRankTrend | undefined {
  return readEntry(accountId)?.trends[kind];
}
