import type {
  GameDetailSnapshot,
  GameProgressStatus,
  NormalizedAchievement,
  NormalizedGame,
  NormalizedMetric,
  NormalizedProfile,
  ProgressSummary,
  RecentlyPlayedGame,
  RecentUnlock,
} from "@core/domain";
import { RETROACHIEVEMENTS_PROVIDER_ID, type RetroAchievementsProviderConfig } from "../config";
import type {
  RawRetroAchievementsCompletionProgressEntry,
  RawRetroAchievementsGameProgressAchievement,
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsMetric,
  RawRetroAchievementsProfileResponse,
  RawRetroAchievementsRecentUnlockResponse,
  RawRetroAchievementsRecentlyPlayedGameResponse,
} from "../raw-types";

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = coerceString(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }

  return undefined;
}

function coerceIdentifier(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return undefined;
}

function pickIdentifier(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = coerceIdentifier(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }

  return undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const normalized = coerceNumber(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }

  return undefined;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 0) {
      return false;
    }

    if (value === 1) {
      return true;
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      return true;
    }

    if (normalized === "0" || normalized === "false" || normalized === "no") {
      return false;
    }
  }

  return undefined;
}

function pickBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    const normalized = coerceBoolean(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }

  return undefined;
}

function coerceEpochMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return Math.trunc(numericValue);
    }

    return parseRetroAchievementsTimestamp(value);
  }

  return undefined;
}

function parseRetroAchievementsTimestamp(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const explicitTimezoneMatch = /(?:Z|[+-]\d{2}:?\d{2})$/iu.test(trimmed);
  if (explicitTimezoneMatch) {
    const parsedDate = Date.parse(trimmed);
    return Number.isFinite(parsedDate) ? parsedDate : undefined;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T])(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/u,
  );
  if (match === null) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const millisecond = Number(fraction.padEnd(3, "0"));
  const parsedAt = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millisecond,
  );

  const parsedDate = new Date(parsedAt);
  if (
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() !== Number(month) - 1 ||
    parsedDate.getUTCDate() !== Number(day) ||
    parsedDate.getUTCHours() !== Number(hour) ||
    parsedDate.getUTCMinutes() !== Number(minute) ||
    parsedDate.getUTCSeconds() !== Number(second) ||
    parsedDate.getUTCMilliseconds() !== millisecond
  ) {
    return undefined;
  }

  return parsedAt;
}

function pickEpochMs(...values: unknown[]): number | undefined {
  for (const value of values) {
    const normalized = coerceEpochMs(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }

  return undefined;
}

const RETROACHIEVEMENTS_IMAGE_ORIGIN = "https://i.retroachievements.org";

function normalizeRetroAchievementsImageUrl(imagePath: string): string {
  return new URL(imagePath, RETROACHIEVEMENTS_IMAGE_ORIGIN).toString();
}

function buildRetroAchievementsBadgeImageUrl(badgeName: string): string {
  return normalizeRetroAchievementsImageUrl(`/Badge/${badgeName}.png`);
}

function normalizeRetroAchievementsBadgeUrl(badgeUrl: string): string {
  return normalizeRetroAchievementsImageUrl(badgeUrl);
}

function normalizeMetric(metric: RawRetroAchievementsMetric, index: number): NormalizedMetric {
  const key = coerceString(metric.key) ?? `metric-${index + 1}`;
  const label = coerceString(metric.label) ?? key;
  const value = coerceString(metric.value) ?? String(metric.value ?? "");

  const normalizedMetric: NormalizedMetric = {
    key,
    label,
    value,
  };

  const detail = coerceString(metric.detail);
  if (detail !== undefined) {
    return {
      ...normalizedMetric,
      detail,
    };
  }

  return normalizedMetric;
}

function toMetrics(metrics: readonly RawRetroAchievementsMetric[] | undefined): readonly NormalizedMetric[] {
  if (!metrics || metrics.length === 0) {
    return [];
  }

  return metrics.map(normalizeMetric);
}

function coercePercent(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = value.trim().endsWith("%")
      ? value.trim().slice(0, -1).trim()
      : value.trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  return undefined;
}

function readGameProgressAchievementCollection(
  rawAchievements: unknown,
): readonly RawRetroAchievementsGameProgressAchievement[] {
  if (Array.isArray(rawAchievements)) {
    return rawAchievements as readonly RawRetroAchievementsGameProgressAchievement[];
  }

  if (typeof rawAchievements === "object" && rawAchievements !== null) {
    return Object.values(rawAchievements as Record<string, RawRetroAchievementsGameProgressAchievement>);
  }

  return [];
}

interface RetroAchievementsProfileInput {
  readonly User?: string;
  readonly user?: string;
  readonly ULID?: string;
  readonly ulid?: string;
  readonly UserPic?: string;
  readonly userPic?: string;
  readonly MemberSince?: string;
  readonly memberSince?: string;
  readonly RichPresenceMsg?: string;
  readonly richPresenceMsg?: string;
  readonly LastGameID?: number | string;
  readonly lastGameId?: number | string;
  readonly TotalPoints?: number | string;
  readonly totalPoints?: number | string;
  readonly TotalSoftcorePoints?: number | string;
  readonly totalSoftcorePoints?: number | string;
  readonly TotalTruePoints?: number | string;
  readonly totalTruePoints?: number | string;
}

function normalizeProfileMetrics(raw: RetroAchievementsProfileInput): readonly NormalizedMetric[] {
  const totalPoints = pickNumber(raw.TotalPoints, raw.totalPoints);
  const totalSoftcorePoints = pickNumber(raw.TotalSoftcorePoints, raw.totalSoftcorePoints);
  const totalTruePoints = pickNumber(raw.TotalTruePoints, raw.totalTruePoints);
  const retroRatio =
    totalPoints !== undefined && totalPoints > 0 && totalTruePoints !== undefined
      ? (totalTruePoints / totalPoints).toFixed(2)
      : undefined;
  const lastGameId = pickIdentifier(raw.LastGameID, raw.lastGameId);
  const memberSince = pickString(raw.MemberSince, raw.memberSince);
  const richPresenceMsg = pickString(raw.RichPresenceMsg, raw.richPresenceMsg);

  return [
    ...(totalPoints !== undefined
      ? [
          {
            key: "total-points",
            label: "Points",
            value: String(totalPoints),
          },
        ]
      : []),
    ...(totalSoftcorePoints !== undefined
      ? [
          {
            key: "softcore-points",
            label: "Softcore",
            value: String(totalSoftcorePoints),
          },
        ]
      : []),
    ...(totalTruePoints !== undefined
      ? [
          {
            key: "true-points",
            label: "True",
            value: String(totalTruePoints),
          },
        ]
      : []),
    ...(retroRatio !== undefined
      ? [
          {
            key: "retro-ratio",
            label: "RetroRatio",
            value: retroRatio,
          },
        ]
      : []),
    ...(lastGameId !== undefined
      ? [
          {
            key: "last-game-id",
            label: "Last Game",
            value: lastGameId,
          },
        ]
      : []),
    ...(memberSince !== undefined
      ? [
          {
            key: "member-since",
            label: "Member Since",
            value: memberSince,
          },
        ]
      : []),
    ...(richPresenceMsg !== undefined
      ? [
          {
            key: "rich-presence",
            label: "Rich Presence",
            value: richPresenceMsg,
          },
        ]
      : []),
  ];
}

export function summarizeRetroAchievementsCompletionProgress(
  rawEntries: readonly RawRetroAchievementsCompletionProgressEntry[],
): ProgressSummary {
  let unlockedCount = 0;
  let totalCount = 0;

  for (const entry of rawEntries) {
    unlockedCount += pickNumber(entry.NumAwarded, entry.numAwarded) ?? 0;

    const maxPossible = pickNumber(entry.MaxPossible, entry.maxPossible);
    if (maxPossible !== undefined && maxPossible > 0) {
      totalCount += maxPossible;
    }
  }

  return {
    unlockedCount,
    ...(totalCount > 0
      ? {
          totalCount,
          completionPercent: Math.round((unlockedCount / totalCount) * 100),
        }
      : {}),
  };
}

export function countRetroAchievementsGamesBeaten(
  rawEntries: readonly RawRetroAchievementsCompletionProgressEntry[],
): number {
  let gamesBeatenCount = 0;

  for (const entry of rawEntries) {
    const highestAwardKind = pickString(entry.HighestAwardKind, entry.highestAwardKind);
    const normalizedHighestAwardKind = highestAwardKind?.toLowerCase();

    if (
      normalizedHighestAwardKind !== undefined &&
      (normalizedHighestAwardKind.includes("beaten") ||
        normalizedHighestAwardKind.includes("mastered"))
    ) {
      gamesBeatenCount += 1;
    }
  }

  return gamesBeatenCount;
}

interface RetroAchievementsSelectableGameInput {
  readonly GameID?: number | string;
  readonly gameId?: number | string;
  readonly Title?: string;
  readonly title?: string;
  readonly ImageIcon?: string;
  readonly imageIcon?: string;
  readonly ConsoleName?: string;
  readonly consoleName?: string;
  readonly MaxPossible?: number | string;
  readonly maxPossible?: number | string;
  readonly NumAwarded?: number | string;
  readonly numAwarded?: number | string;
  readonly MostRecentAwardedDate?: string;
  readonly mostRecentAwardedDate?: string;
  readonly HighestAwardKind?: string;
  readonly highestAwardKind?: string;
  readonly HighestAwardDate?: string;
  readonly highestAwardDate?: string;
  readonly ParentGameID?: number | string | null;
  readonly parentGameId?: number | string | null;
}

function normalizeSelectableGame(
  raw: RetroAchievementsSelectableGameInput,
): NormalizedGame | undefined {
  const unlockedCount = pickNumber(raw.NumAwarded, raw.numAwarded) ?? 0;
  if (unlockedCount <= 0) {
    return undefined;
  }

  const totalCount = pickNumber(raw.MaxPossible, raw.maxPossible);
  const highestAwardKind = pickString(raw.HighestAwardKind, raw.highestAwardKind);
  const summary: ProgressSummary = {
    unlockedCount,
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(totalCount !== undefined && totalCount > 0
      ? { completionPercent: Math.round((unlockedCount / totalCount) * 100) }
      : {}),
  };

  const game = buildGameIdentity({
    gameId: raw.GameID ?? raw.gameId,
    gameTitle: raw.Title ?? raw.title,
    platformLabel: raw.ConsoleName ?? raw.consoleName,
    coverImageUrl: raw.ImageIcon ?? raw.imageIcon,
  });
  const parentGameId = pickIdentifier(raw.ParentGameID, raw.parentGameId);
  const lastUnlockAt = pickEpochMs(
    raw.MostRecentAwardedDate,
    raw.mostRecentAwardedDate,
    raw.HighestAwardDate,
    raw.highestAwardDate,
  );

  return {
    ...game,
    ...(parentGameId !== undefined ? { parentGameId } : {}),
    status: inferGameStatus(highestAwardKind, summary),
    summary,
    metrics: [
      {
        key: "unlocked-count",
        label: "Unlocked",
        value: String(summary.unlockedCount),
      },
      ...(summary.totalCount !== undefined
        ? [
            {
              key: "total-count",
              label: "Total",
              value: String(summary.totalCount),
            },
          ]
        : []),
      ...(lastUnlockAt !== undefined
        ? [
            {
              key: "last-active",
              label: "Last Active",
              value: String(lastUnlockAt),
            },
          ]
        : []),
    ],
    ...(lastUnlockAt !== undefined ? { lastUnlockAt } : {}),
  };
}

export function normalizeRetroAchievementsSelectableGames(
  rawEntries: readonly RetroAchievementsSelectableGameInput[],
): readonly NormalizedGame[] {
  return normalizeRetroAchievementsCompletionProgressGames(rawEntries).slice(0, 3);
}

export function normalizeRetroAchievementsCompletionProgressGames(
  rawEntries: readonly RetroAchievementsSelectableGameInput[],
): readonly NormalizedGame[] {
  return rawEntries
    .map(normalizeSelectableGame)
    .filter((game): game is NormalizedGame => game !== undefined)
    .sort((left, right) => {
      const leftLastActive = left.lastUnlockAt ?? 0;
      const rightLastActive = right.lastUnlockAt ?? 0;
      if (leftLastActive !== rightLastActive) {
        return rightLastActive - leftLastActive;
      }

      if (left.summary.unlockedCount !== right.summary.unlockedCount) {
        return right.summary.unlockedCount - left.summary.unlockedCount;
      }

      return left.title.localeCompare(right.title);
    });
}

function inferGameStatus(rawStatus: unknown, summary: ProgressSummary): GameProgressStatus {
  const normalizedStatus = coerceString(rawStatus)?.toLowerCase();

  if (normalizedStatus === "locked" || normalizedStatus === "in_progress") {
    return normalizedStatus;
  }

  // Assumption: any mastered-like award kind should remain mastered.
  if (normalizedStatus?.includes("mastered")) {
    return "mastered";
  }

  // Assumption: any completed-like award kind should remain completed, even if it is further qualified.
  if (normalizedStatus?.includes("completed")) {
    return "completed";
  }

  if (normalizedStatus?.includes("beaten")) {
    return "beaten";
  }

  if (summary.totalCount !== undefined && summary.totalCount > 0) {
    if (summary.unlockedCount <= 0) {
      return "locked";
    }

    if (summary.unlockedCount >= summary.totalCount) {
      return "beaten";
    }

    return "in_progress";
  }

  return summary.unlockedCount > 0 ? "in_progress" : "locked";
}

interface RetroAchievementsGameIdentityInput {
  readonly gameId?: string | number | undefined;
  readonly gameTitle?: string | undefined;
  readonly title?: string | undefined;
  readonly platformLabel?: string | undefined;
  readonly coverImageUrl?: string | undefined;
  readonly boxArtImageUrl?: string | undefined;
}

function buildGameIdentity(
  raw: RetroAchievementsGameIdentityInput,
): Pick<
  NormalizedGame,
  "providerId" | "gameId" | "title" | "platformLabel" | "coverImageUrl" | "boxArtImageUrl"
> {
  const gameId = pickIdentifier(raw.gameId) ?? "unknown-game";
  const title = pickString(raw.gameTitle, raw.title) ?? "Unknown Game";
  const platformLabel = pickString(raw.platformLabel);
  const coverImageUrl = pickString(raw.coverImageUrl);
  const boxArtImageUrl = pickString(raw.boxArtImageUrl);

  return {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    gameId,
    title,
    ...(platformLabel !== undefined ? { platformLabel } : {}),
    ...(coverImageUrl !== undefined ? { coverImageUrl: normalizeRetroAchievementsImageUrl(coverImageUrl) } : {}),
    ...(boxArtImageUrl !== undefined ? { boxArtImageUrl: normalizeRetroAchievementsImageUrl(boxArtImageUrl) } : {}),
  };
}

interface RetroAchievementsGameProgressAchievementInput {
  readonly ID?: number | string;
  readonly id?: number | string;
  readonly NumAwarded?: number | string;
  readonly numAwarded?: number | string;
  readonly NumAwardedHardcore?: number | string;
  readonly numAwardedHardcore?: number | string;
  readonly Title?: string;
  readonly title?: string;
  readonly Description?: string;
  readonly description?: string;
  readonly Points?: number | string;
  readonly points?: number | string;
  readonly TrueRatio?: number | string;
  readonly trueRatio?: number | string;
  readonly Author?: string;
  readonly author?: string;
  readonly AuthorULID?: string;
  readonly authorUlid?: string;
  readonly DateModified?: string;
  readonly dateModified?: string;
  readonly DateCreated?: string;
  readonly dateCreated?: string;
  readonly BadgeName?: string;
  readonly badgeName?: string;
  readonly DisplayOrder?: number | string;
  readonly displayOrder?: number | string;
  readonly MemAddr?: string;
  readonly memAddr?: string;
  readonly Type?: string;
  readonly type?: string;
  readonly DateEarned?: string;
  readonly dateEarned?: string;
  readonly DateEarnedHardcore?: string;
  readonly dateEarnedHardcore?: string;
}

function buildGameProgressAchievement(
  raw: RetroAchievementsGameProgressAchievementInput,
  gameId: string,
): NormalizedAchievement {
  const achievementId = pickIdentifier(raw.ID, raw.id);
  if (achievementId === undefined) {
    throw new SyntaxError("Game progress response is missing an achievement ID.");
  }

  const title = pickString(raw.Title, raw.title);
  if (title === undefined) {
    throw new SyntaxError(`Game progress response is missing a title for achievement ${achievementId}.`);
  }

  const description = pickString(raw.Description, raw.description);
  const points = pickNumber(raw.Points, raw.points);
  const trueRatio = pickNumber(raw.TrueRatio, raw.trueRatio);
  const unlockedCount = pickNumber(raw.NumAwarded, raw.numAwarded);
  const hardcoreUnlockedCount = pickNumber(raw.NumAwardedHardcore, raw.numAwardedHardcore);
  const author = pickString(raw.Author, raw.author);
  const authorUlid = pickString(raw.AuthorULID, raw.authorUlid);
  const dateModified = pickString(raw.DateModified, raw.dateModified);
  const dateCreated = pickString(raw.DateCreated, raw.dateCreated);
  const badgeName = pickString(raw.BadgeName, raw.badgeName);
  const badgeImageUrl = badgeName !== undefined ? buildRetroAchievementsBadgeImageUrl(badgeName) : undefined;
  const displayOrder = pickNumber(raw.DisplayOrder, raw.displayOrder);
  const memAddr = pickString(raw.MemAddr, raw.memAddr);
  const type = pickString(raw.Type, raw.type);
  const unlockedAt = pickEpochMs(raw.DateEarnedHardcore, raw.dateEarnedHardcore, raw.DateEarned, raw.dateEarned);
  const isUnlocked =
    unlockedAt !== undefined ||
    raw.DateEarnedHardcore !== undefined ||
    raw.dateEarnedHardcore !== undefined ||
    raw.DateEarned !== undefined ||
    raw.dateEarned !== undefined;

  const metrics = [
    ...(badgeName !== undefined
      ? [
          {
            key: "badge-name",
            label: "Badge",
            value: badgeName,
          },
        ]
      : []),
    ...(author !== undefined
      ? [
          {
            key: "author",
            label: "Author",
            value: author,
          },
        ]
      : []),
    ...(authorUlid !== undefined
      ? [
          {
            key: "author-ulid",
            label: "Author ULID",
            value: authorUlid,
          },
        ]
      : []),
    ...(displayOrder !== undefined
      ? [
          {
            key: "display-order",
            label: "Order",
            value: String(displayOrder),
          },
        ]
      : []),
    ...(type !== undefined
      ? [
          {
            key: "type",
            label: "Type",
            value: type,
          },
        ]
      : []),
    ...(trueRatio !== undefined
      ? [
          {
            key: "true-ratio",
            label: "True Ratio",
            value: String(trueRatio),
          },
        ]
      : []),
    ...(unlockedCount !== undefined
      ? [
          {
            key: "unlocked-count",
            label: "Total Players",
            value: String(unlockedCount),
          },
        ]
      : []),
    ...(hardcoreUnlockedCount !== undefined
      ? [
          {
            key: "hardcore-unlocked-count",
            label: "Hardcore Unlocks",
            value: String(hardcoreUnlockedCount),
          },
        ]
      : []),
    ...(unlockedCount !== undefined && hardcoreUnlockedCount !== undefined
      ? [
          {
            key: "softcore-unlocked-count",
            label: "Softcore Unlocks",
            value: String(Math.max(0, unlockedCount - hardcoreUnlockedCount)),
          },
        ]
      : []),
    ...(memAddr !== undefined
      ? [
          {
            key: "mem-addr",
            label: "Mem Addr",
            value: memAddr,
          },
        ]
      : []),
    ...(dateCreated !== undefined
      ? [
          {
            key: "date-created",
            label: "Created",
            value: dateCreated,
          },
        ]
      : []),
    ...(dateModified !== undefined
      ? [
          {
            key: "date-modified",
            label: "Modified",
            value: dateModified,
          },
        ]
      : []),
  ];

  return {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    achievementId,
    gameId,
    title,
    ...(description !== undefined ? { description } : {}),
    ...(badgeImageUrl !== undefined ? { badgeImageUrl } : {}),
    isUnlocked,
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    ...(points !== undefined ? { points } : {}),
    metrics,
  };
}

interface RetroAchievementsRecentUnlockInput {
  readonly achievementId?: string | number | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly unlockedAt?: string | number | undefined;
  readonly points?: number | string | undefined;
  readonly trueRatio?: number | string | undefined;
  readonly hardcoreMode?: boolean | number | string | undefined;
  readonly BadgeURL?: string | undefined;
  readonly badgeUrl?: string | undefined;
  readonly gameId: string;
  readonly gameTitle?: string | undefined;
  readonly gameIcon?: string | undefined;
  readonly consoleName?: string | undefined;
}

function buildRecentUnlockAchievement(
  raw: RetroAchievementsRecentUnlockInput,
): NormalizedAchievement {
  const unlockedAt = pickEpochMs(raw.unlockedAt);
  const points = pickNumber(raw.points);
  const trueRatio = pickNumber(raw.trueRatio);
  const hardcoreMode = pickBoolean(raw.hardcoreMode);
  const description = pickString(raw.description);
  const badgeUrl = pickString(raw.BadgeURL, raw.badgeUrl);
  const title = pickString(raw.title) ?? "Unknown Achievement";
  const badgeImageUrl = badgeUrl !== undefined ? normalizeRetroAchievementsBadgeUrl(badgeUrl) : undefined;

  const metrics = [
    ...(points !== undefined
      ? [
          {
            key: "points",
            label: "Points",
            value: String(points),
          },
        ]
      : []),
    ...(trueRatio !== undefined
      ? [
          {
            key: "true-ratio",
            label: "True Ratio",
            value: String(trueRatio),
          },
        ]
      : []),
    ...(hardcoreMode !== undefined
      ? [
          {
            key: "hardcore-mode",
            label: "Mode",
            value: hardcoreMode ? "Hardcore" : "Softcore",
          },
        ]
      : []),
  ];

  // Assumption: recent unlocks are always unlocked by definition.
  return {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    achievementId: pickIdentifier(raw.achievementId) ?? `${raw.gameId}:achievement`,
    gameId: raw.gameId,
    title,
    isUnlocked: true,
    metrics,
    ...(description !== undefined ? { description } : {}),
    ...(badgeImageUrl !== undefined ? { badgeImageUrl } : {}),
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    ...(points !== undefined ? { points } : {}),
  };
}

export function normalizeRetroAchievementsProfile(
  raw: RawRetroAchievementsProfileResponse,
  completionSummary: ProgressSummary,
  config: RetroAchievementsProviderConfig,
  featuredGames: readonly NormalizedGame[] = [],
  gamesBeatenCount?: number,
): NormalizedProfile {
  const avatarPath = pickString(raw.UserPic, raw.userPic);
  const avatarUrl = avatarPath !== undefined ? normalizeRetroAchievementsImageUrl(avatarPath) : undefined;
  const motto = pickString(raw.Motto, raw.motto);

  const identity: NormalizedProfile["identity"] = {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    accountId:
      pickIdentifier(raw.ULID, raw.ulid, raw.ID, raw.id) ?? config.username,
    displayName: pickString(raw.User, raw.user) ?? config.username,
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
  };

  return {
    providerId: RETROACHIEVEMENTS_PROVIDER_ID,
    identity,
    summary: completionSummary,
    metrics: [
      ...normalizeProfileMetrics(raw),
      ...(gamesBeatenCount !== undefined
        ? [
            {
              key: "games-beaten",
              label: "Games Beaten",
              value: String(gamesBeatenCount),
            },
          ]
        : []),
    ],
    ...(motto !== undefined ? { motto } : {}),
    ...(featuredGames.length > 0 ? { featuredGames } : {}),
  };
}

export function normalizeRetroAchievementsRecentUnlocks(
  rawUnlocks: readonly RawRetroAchievementsRecentUnlockResponse[],
): readonly RecentUnlock[] {
  return rawUnlocks.map((raw) => {
    const game = buildGameIdentity({
      gameId: raw.GameID ?? raw.gameId,
      gameTitle: raw.GameTitle ?? raw.gameTitle,
      platformLabel: raw.ConsoleName ?? raw.consoleName,
      coverImageUrl: raw.GameIcon ?? raw.gameIcon,
    });
    const unlockedAt = pickEpochMs(raw.Date, raw.date);

    const achievement = buildRecentUnlockAchievement({
      achievementId: raw.AchievementID ?? raw.achievementId,
      title: raw.Title ?? raw.title,
      description: raw.Description ?? raw.description,
      unlockedAt: raw.Date ?? raw.date,
      points: raw.Points ?? raw.points,
      trueRatio: raw.TrueRatio ?? raw.trueRatio,
      hardcoreMode: raw.HardcoreMode ?? raw.hardcoreMode,
      BadgeURL: raw.BadgeURL ?? raw.badgeUrl,
      gameId: game.gameId,
      gameTitle: game.title,
      gameIcon: raw.GameIcon ?? raw.gameIcon,
      consoleName: raw.ConsoleName ?? raw.consoleName,
    });

    return {
      achievement,
      game,
      ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    };
  });
}

interface RetroAchievementsRecentlyPlayedGameInput {
  readonly GameID?: number | string;
  readonly gameId?: number | string;
  readonly ConsoleName?: string;
  readonly consoleName?: string;
  readonly Title?: string;
  readonly title?: string;
  readonly ImageIcon?: string;
  readonly imageIcon?: string;
  readonly AchievementsTotal?: number | string;
  readonly achievementsTotal?: number | string;
  readonly NumPossibleAchievements?: number | string;
  readonly numPossibleAchievements?: number | string;
  readonly NumAchieved?: number | string;
  readonly numAchieved?: number | string;
  readonly LastPlayed?: string;
  readonly lastPlayed?: string;
}

function normalizeRetroAchievementsRecentlyPlayedGame(
  raw: RetroAchievementsRecentlyPlayedGameInput,
): RecentlyPlayedGame | undefined {
  const game = buildGameIdentity({
    gameId: raw.GameID ?? raw.gameId,
    gameTitle: raw.Title ?? raw.title,
    platformLabel: raw.ConsoleName ?? raw.consoleName,
    coverImageUrl: raw.ImageIcon ?? raw.imageIcon,
  });
  const unlockedCount = pickNumber(raw.NumAchieved, raw.numAchieved) ?? 0;
  const totalCount = pickNumber(raw.AchievementsTotal, raw.achievementsTotal, raw.NumPossibleAchievements, raw.numPossibleAchievements);
  const lastPlayedAt = pickEpochMs(raw.LastPlayed, raw.lastPlayed);

  if (unlockedCount <= 0 && totalCount === undefined && lastPlayedAt === undefined) {
    return undefined;
  }

  const summary: ProgressSummary = {
    unlockedCount,
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(totalCount !== undefined && totalCount > 0
      ? { completionPercent: Math.round((unlockedCount / totalCount) * 100) }
      : {}),
  };

  const { providerId, gameId, title, platformLabel, coverImageUrl } = game;

  return {
    providerId,
    gameId,
    title,
    ...(platformLabel !== undefined ? { platformLabel } : {}),
    ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
    summary,
    ...(lastPlayedAt !== undefined ? { lastPlayedAt } : {}),
  };
}

export function normalizeRetroAchievementsRecentlyPlayedGames(
  rawGames: readonly RawRetroAchievementsRecentlyPlayedGameResponse[],
): readonly RecentlyPlayedGame[] {
  return rawGames
    .map((raw) => normalizeRetroAchievementsRecentlyPlayedGame(raw))
    .filter((game): game is RecentlyPlayedGame => game !== undefined);
}

export function normalizeRetroAchievementsGameDetail(
  raw: RawRetroAchievementsGameProgressResponse,
): GameDetailSnapshot {
  const gameId = pickIdentifier(raw.ID, raw.id);
  if (gameId === undefined) {
    throw new SyntaxError("Game progress response is missing a game ID.");
  }

  const title = pickString(raw.Title, raw.title);
  if (title === undefined) {
    throw new SyntaxError(`Game progress response is missing a title for game ${gameId}.`);
  }

  const achievementsCollection = readGameProgressAchievementCollection(raw.Achievements ?? raw.achievements);
  if (achievementsCollection.length === 0) {
    throw new SyntaxError(`Game progress response for ${title} did not include any achievements.`);
  }

  const sortedAchievements = [...achievementsCollection].sort((left, right) => {
    const leftDisplayOrder = pickNumber(left.DisplayOrder, left.displayOrder);
    const rightDisplayOrder = pickNumber(right.DisplayOrder, right.displayOrder);
    if (leftDisplayOrder !== rightDisplayOrder) {
      return (leftDisplayOrder ?? Number.MAX_SAFE_INTEGER) - (rightDisplayOrder ?? Number.MAX_SAFE_INTEGER);
    }

    const leftId = pickNumber(left.ID, left.id);
    const rightId = pickNumber(right.ID, right.id);
    if (leftId !== rightId) {
      return (leftId ?? Number.MAX_SAFE_INTEGER) - (rightId ?? Number.MAX_SAFE_INTEGER);
    }

    return pickString(left.Title, left.title)?.localeCompare(pickString(right.Title, right.title) ?? "") ?? 0;
  });

  const achievements = sortedAchievements.map((achievement) =>
    buildGameProgressAchievement(achievement, gameId),
  );

  const totalCount = pickNumber(raw.NumAchievements, raw.numAchievements) ?? achievements.length;
  const unlockedCount =
    pickNumber(raw.NumAwardedToUser, raw.numAwardedToUser) ??
    achievements.filter((achievement) => achievement.isUnlocked).length;
  const hardcoreUnlockedCount = pickNumber(raw.NumAwardedToUserHardcore, raw.numAwardedToUserHardcore);
  const userCompletion = pickString(raw.UserCompletion, raw.userCompletion);
  const hardcoreUserCompletion = pickString(raw.UserCompletionHardcore, raw.userCompletionHardcore);
  const completionPercent =
    coercePercent(userCompletion) ?? (totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : undefined);
  const hardcoreCompletionPercent = coercePercent(hardcoreUserCompletion);
  const consoleLabel = pickString(raw.ConsoleName, raw.consoleName);
  const coverImageUrl = pickString(raw.ImageIcon, raw.imageIcon, raw.ImageTitle, raw.imageTitle, raw.ImageIngame, raw.imageIngame);
  const boxArtImageUrl = pickString(raw.ImageBoxArt, raw.imageBoxArt);
  const publisher = pickString(raw.Publisher, raw.publisher);
  const developer = pickString(raw.Developer, raw.developer);
  const genre = pickString(raw.Genre, raw.genre);
  const released = pickString(raw.Released, raw.released);
  const guideUrl = pickString(raw.GuideURL, raw.guideUrl);
  const highestAwardKind = pickString(raw.HighestAwardKind, raw.highestAwardKind);
  const userTotalPlaytime = pickNumber(raw.UserTotalPlaytime, raw.userTotalPlaytime);
  const lastUnlockAt = pickEpochMs(raw.HighestAwardDate, raw.highestAwardDate);

  const summary: ProgressSummary = {
    unlockedCount,
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(completionPercent !== undefined ? { completionPercent } : {}),
  };

  const game: NormalizedGame = {
    ...buildGameIdentity({
      gameId,
      title,
      platformLabel: consoleLabel,
      coverImageUrl,
      boxArtImageUrl,
    }),
    status: inferGameStatus(highestAwardKind, summary),
    summary,
    metrics: [
      ...(publisher !== undefined
        ? [
            {
              key: "publisher",
              label: "Publisher",
              value: publisher,
            },
          ]
        : []),
      ...(developer !== undefined
        ? [
            {
              key: "developer",
              label: "Developer",
              value: developer,
            },
          ]
        : []),
      ...(genre !== undefined
        ? [
            {
              key: "genre",
              label: "Genre",
              value: genre,
            },
          ]
        : []),
      ...(released !== undefined
        ? [
            {
              key: "released",
              label: "Released",
              value: released,
            },
          ]
        : []),
      ...(guideUrl !== undefined
        ? [
            {
              key: "guide-url",
              label: "Guide",
              value: guideUrl,
            },
          ]
        : []),
      ...(hardcoreUnlockedCount !== undefined
        ? [
            {
              key: "hardcore-unlocked-count",
              label: "Hardcore Unlocked",
              value: String(hardcoreUnlockedCount),
            },
          ]
        : []),
      ...(hardcoreCompletionPercent !== undefined
        ? [
            {
              key: "hardcore-completion",
              label: "Hardcore Completion",
              value: `${hardcoreCompletionPercent}%`,
            },
          ]
        : []),
      ...(userTotalPlaytime !== undefined
        ? [
            {
              key: "playtime",
              label: "Playtime",
              value: String(userTotalPlaytime),
            },
          ]
        : []),
      ...(highestAwardKind !== undefined
        ? [
            {
              key: "highest-award-kind",
              label: "Highest Award",
              value: highestAwardKind,
            },
          ]
        : []),
      {
        key: "awarded-count",
        label: "Unlocked",
        value: String(unlockedCount),
      },
      ...(totalCount !== undefined
        ? [
            {
              key: "achievement-count",
              label: "Total",
              value: String(totalCount),
            },
          ]
        : []),
    ],
    ...(lastUnlockAt !== undefined ? { lastUnlockAt } : {}),
  };

  return {
    game,
    achievements,
    refreshedAt: Date.now(),
  };
}
