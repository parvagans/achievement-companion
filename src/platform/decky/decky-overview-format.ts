import type { ReleaseDateGranularity } from "@core/domain";

export interface DeckyOverviewDetailRow {
  readonly key?: string;
  readonly label: string;
  readonly value: string | undefined;
}

export interface DeckySteamGameInfoFields {
  readonly appId: string;
  readonly releaseDate?: string;
  readonly steamPlaytime?: string;
  readonly deckPlaytime?: string;
  readonly setPoints?: string;
  readonly lastRefreshed?: string;
}

export interface DeckyRetroAchievementsGameInfoFields {
  readonly gameId: string;
  readonly system?: string;
  readonly releaseDate?: string;
  readonly lastSync?: string;
  readonly totalSetPoints?: string;
  readonly playerCount?: string;
  readonly completionAward?: string;
  readonly awardDate?: string;
}

/** The compact Game Info contract: provider metadata only, never progress duplication. */
export function buildDeckySteamGameInfoRows(fields: DeckySteamGameInfoFields): readonly DeckyOverviewDetailRow[] {
  return dedupeDeckyOverviewDetailRows([
    { key: "steam-app-id", label: "Steam App ID", value: fields.appId },
    { key: "release-date", label: "Release Date", value: fields.releaseDate },
    { key: "steam-playtime", label: "Steam Playtime", value: fields.steamPlaytime },
    { key: "deck-playtime", label: "Deck Playtime", value: fields.deckPlaytime },
    { key: "steamhunters-set-points", label: "SteamHunters Set Points", value: fields.setPoints },
    { key: "last-refreshed", label: "Last Refreshed", value: fields.lastRefreshed },
  ]).slice(0, 6);
}

/** The compact RA Game Info contract; missing award dates are deliberately omitted. */
export function buildDeckyRetroAchievementsGameInfoRows(fields: DeckyRetroAchievementsGameInfoFields): readonly DeckyOverviewDetailRow[] {
  return dedupeDeckyOverviewDetailRows([
    { key: "provider-game-id", label: "Game ID", value: fields.gameId },
    { key: "system", label: "System", value: fields.system },
    { key: "release-date", label: "Release Date", value: fields.releaseDate },
    { key: "last-sync", label: "Last Sync", value: fields.lastSync },
    { key: "total-set-points", label: "Total Set Points", value: fields.totalSetPoints },
    { key: "players", label: "Players", value: fields.playerCount },
    { key: "completion-award", label: "Completion Award", value: fields.completionAward },
    { key: "award-date", label: "Award Date", value: fields.awardDate },
  ]);
}

function normalizeDetailSemantic(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "");
  const aliases: Readonly<Record<string, string>> = {
    appid: "steam-app-id",
    steamappid: "steam-app-id",
    gameid: "provider-game-id",
    providergameid: "provider-game-id",
    ragameid: "provider-game-id",
    retroachievementsgameid: "provider-game-id",
    totalachievements: "total-achievements",
    achievementtotal: "total-achievements",
    achievementsunlocked: "achievements-unlocked",
    unlockedachievements: "achievements-unlocked",
    platform: "system",
    console: "system",
  };
  return aliases[normalized] ?? normalized;
}

/** Removes provider rows that repeat an explicit field under a different label. */
export function dedupeDeckyOverviewDetailRows(rows: readonly DeckyOverviewDetailRow[]): readonly DeckyOverviewDetailRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (row.value === undefined) return false;
    const semantic = normalizeDetailSemantic(row.key ?? row.label);
    if (semantic.length === 0 || seen.has(semantic)) return false;
    seen.add(semantic);
    return true;
  });
}

/** Formats provider dates without implying precision the source did not supply. */
export function formatDeckyOverviewDate(value: string, granularity?: ReleaseDateGranularity): string {
  const trimmed = value.trim();
  const year = /^(\d{4})$/u.exec(trimmed);
  if (granularity === "year" || year !== null) return year?.[1] ?? trimmed;
  const month = /^(\d{4})-(\d{2})$/u.exec(trimmed);
  if (granularity === "month" || month !== null) {
    const match = month ?? /^(\d{4})-(\d{2})/u.exec(trimmed);
    if (match !== null) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)).toLocaleDateString(undefined, { year: "numeric", month: "long", timeZone: "UTC" });
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return new Date(parsed).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Concise date/time used by Deck-sized metadata and milestone surfaces. */
export function formatDeckyOverviewDateTime(value: number | Date): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
