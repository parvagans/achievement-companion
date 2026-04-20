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
  SteamBadgeSummary,
} from "@core/domain";
import { normalizeSteamArtworkUrl } from "../artwork";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../config";
import type {
  RawSteamGlobalAchievementPercentage,
  RawSteamPlayerAchievement,
  RawSteamPlayerSummary,
  RawSteamRecentlyPlayedGame,
  RawSteamSchemaAchievement,
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

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
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

function normalizeEpochSeconds(value: unknown): number | undefined {
  const seconds = coerceNumber(value);
  if (seconds !== undefined) {
    return seconds > 0 ? seconds * 1000 : undefined;
  }

  const valueAsString = pickString(value);
  if (valueAsString === undefined) {
    return undefined;
  }

  const parsedDate = Date.parse(valueAsString);
  return Number.isFinite(parsedDate) ? parsedDate : undefined;
}

function normalizeUnixSecondsToMs(value: unknown): number | undefined {
  const seconds = coerceNumber(value);
  return seconds !== undefined && seconds > 0 ? seconds * 1000 : undefined;
}

function normalizeUnixSecondsToIso(value: unknown): string | undefined {
  const seconds = coerceNumber(value);
  if (seconds === undefined || seconds <= 0) {
    return undefined;
  }

  return new Date(seconds * 1000).toISOString();
}

function buildGameIdentity(
  raw: {
    readonly appId: number | undefined;
    readonly title: string | undefined;
    readonly platformLabel: string | undefined;
    readonly coverImageUrl: string | undefined;
    readonly boxArtImageUrl: string | undefined;
  },
): Pick<
  NormalizedGame,
  "providerId" | "appid" | "gameId" | "title" | "platformLabel" | "coverImageUrl" | "boxArtImageUrl"
> {
  const appId = raw.appId ?? Number.NaN;
  const gameId = Number.isFinite(appId) ? String(Math.trunc(appId)) : "unknown-game";
  const title = raw.title ?? "Unknown Game";
  const platformLabel = raw.platformLabel;

  return {
    providerId: STEAM_PROVIDER_ID,
    ...(Number.isFinite(appId) ? { appid: Math.trunc(appId) } : {}),
    gameId,
    title,
    ...(platformLabel !== undefined ? { platformLabel } : {}),
    ...(raw.coverImageUrl !== undefined ? { coverImageUrl: raw.coverImageUrl } : {}),
    ...(raw.boxArtImageUrl !== undefined ? { boxArtImageUrl: raw.boxArtImageUrl } : {}),
  };
}

function buildSteamAchievementMetrics(args: {
  readonly globalPercent: number | undefined;
  readonly unlockedAt: number | undefined;
  readonly hidden: boolean | undefined;
}): readonly NormalizedMetric[] {
  return [
    ...(args.globalPercent !== undefined
      ? [
          {
            key: "true-ratio",
            label: "Unlock rate",
            value: String(Math.max(1, 100 / args.globalPercent)),
          },
        ]
      : []),
    ...(args.globalPercent !== undefined
      ? [
          {
            key: "global-percent",
            label: "Global Unlock Rate",
            value: String(args.globalPercent),
          },
        ]
      : []),
    ...(args.unlockedAt !== undefined
      ? [
          {
            key: "unlock-time",
            label: "Unlock Time",
            value: String(args.unlockedAt),
          },
        ]
      : []),
    ...(args.hidden !== undefined
      ? [
          {
            key: "hidden",
            label: "Hidden",
            value: args.hidden ? "Yes" : "No",
          },
        ]
      : []),
  ];
}

function createSteamAchievementFromSchema(args: {
  readonly appId: number;
  readonly schemaAchievement: RawSteamSchemaAchievement;
  readonly playerAchievement: RawSteamPlayerAchievement | undefined;
  readonly achieved: boolean;
  readonly unlockTime: number | undefined;
  readonly globalPercent: number | undefined;
}): NormalizedAchievement | undefined {
  const achievementId = pickString(args.schemaAchievement.name);
  const title = pickString(args.schemaAchievement.displayName, args.schemaAchievement.name);
  if (achievementId === undefined || title === undefined) {
    return undefined;
  }

  const badgeImageUrl = args.achieved
    ? normalizeSteamArtworkUrl(args.schemaAchievement.icon, args.appId)
    : normalizeSteamArtworkUrl(args.schemaAchievement.icongray, args.appId) ??
      normalizeSteamArtworkUrl(args.schemaAchievement.icon, args.appId);
  const description = pickString(args.schemaAchievement.description, args.playerAchievement?.description);

  return {
    providerId: STEAM_PROVIDER_ID,
    achievementId,
    gameId: String(args.appId),
    title,
    ...(description !== undefined ? { description } : {}),
    ...(badgeImageUrl !== undefined ? { badgeImageUrl } : {}),
    isUnlocked: args.achieved,
    ...(args.unlockTime !== undefined ? { unlockedAt: args.unlockTime } : {}),
    metrics: buildSteamAchievementMetrics({
      globalPercent: args.globalPercent,
      unlockedAt: args.unlockTime,
      hidden: pickBoolean(args.schemaAchievement.hidden) ?? undefined,
    }),
  };
}

function createSteamAchievementFromPlayerOnly(args: {
  readonly appId: number;
  readonly playerAchievement: RawSteamPlayerAchievement;
  readonly globalPercent: number | undefined;
}): NormalizedAchievement | undefined {
  const achievementId = pickString(args.playerAchievement.apiname);
  if (achievementId === undefined) {
    return undefined;
  }

  const unlockTime = normalizeEpochSeconds(args.playerAchievement.unlocktime);
  const achieved = pickBoolean(args.playerAchievement.achieved) ?? false;
  const badgeImageUrl =
    normalizeSteamArtworkUrl(args.playerAchievement.icon, args.appId) ??
    normalizeSteamArtworkUrl(args.playerAchievement.icongray, args.appId);
  const description = pickString(args.playerAchievement.description);

  if (!achieved) {
    return undefined;
  }

  return {
    providerId: STEAM_PROVIDER_ID,
    achievementId,
    gameId: String(args.appId),
    title: achievementId,
    ...(description !== undefined ? { description } : {}),
    ...(badgeImageUrl !== undefined ? { badgeImageUrl } : {}),
    isUnlocked: true,
    ...(unlockTime !== undefined ? { unlockedAt: unlockTime } : {}),
    metrics: buildSteamAchievementMetrics({
      globalPercent: args.globalPercent,
      unlockedAt: unlockTime,
      hidden: undefined,
    }),
  };
}

function compareRecentUnlocks(left: RecentUnlock, right: RecentUnlock): number {
  const leftTimestamp = left.unlockedAt ?? left.achievement.unlockedAt ?? Number.NEGATIVE_INFINITY;
  const rightTimestamp = right.unlockedAt ?? right.achievement.unlockedAt ?? Number.NEGATIVE_INFINITY;

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  const gameDelta = left.game.title.localeCompare(right.game.title);
  if (gameDelta !== 0) {
    return gameDelta;
  }

  const achievementDelta = left.achievement.title.localeCompare(right.achievement.title);
  if (achievementDelta !== 0) {
    return achievementDelta;
  }

  return `${left.achievement.providerId}:${left.game.gameId}:${left.achievement.achievementId}`.localeCompare(
    `${right.achievement.providerId}:${right.game.gameId}:${right.achievement.achievementId}`,
  );
}

function summarizeSteamGames(games: readonly NormalizedGame[]): ProgressSummary {
  let unlockedCount = 0;
  let totalCount = 0;

  for (const game of games) {
    unlockedCount += game.summary.unlockedCount;
    totalCount += game.summary.totalCount ?? 0;
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

export function normalizeSteamRecentlyPlayedGames(
  rawGames: readonly RawSteamRecentlyPlayedGame[],
  details: ReadonlyMap<number, GameDetailSnapshot> = new Map(),
): readonly RecentlyPlayedGame[] {
  const normalizedGames: RecentlyPlayedGame[] = [];

  for (const rawGame of rawGames) {
    const appId = coerceNumber(rawGame.appid);
    if (appId === undefined) {
      continue;
    }

    const detail = details.get(appId);
    const coverImageUrl = normalizeSteamArtworkUrl(rawGame.img_icon_url, appId);
    const playtimeForeverMinutes = coerceNumber(rawGame.playtime_forever);
    const playtimeTwoWeeksMinutes = coerceNumber(rawGame.playtime_2weeks);
    const playtimeDeckForeverMinutes = coerceNumber(rawGame.playtime_deck_forever);
    const lastPlayedAt = normalizeUnixSecondsToMs(rawGame.rtime_last_played);
    const gameIdentity = buildGameIdentity({
      appId,
      title: pickString(rawGame.name),
      platformLabel: "Steam",
      coverImageUrl,
      boxArtImageUrl: undefined,
    });

    normalizedGames.push({
      providerId: STEAM_PROVIDER_ID,
      appid: appId,
      gameId: gameIdentity.gameId,
      title: gameIdentity.title,
      ...(gameIdentity.platformLabel !== undefined ? { platformLabel: gameIdentity.platformLabel } : {}),
      ...(gameIdentity.coverImageUrl !== undefined ? { coverImageUrl: gameIdentity.coverImageUrl } : {}),
      summary: detail?.game.summary ?? {
        unlockedCount: 0,
      },
      ...(playtimeForeverMinutes !== undefined ? { playtimeForeverMinutes } : {}),
      ...(playtimeTwoWeeksMinutes !== undefined ? { playtimeTwoWeeksMinutes } : {}),
      ...(playtimeDeckForeverMinutes !== undefined ? { playtimeDeckForeverMinutes } : {}),
      ...(lastPlayedAt !== undefined ? { lastPlayedAt } : {}),
    });
  }

  return normalizedGames;
}

export function normalizeSteamGameDetail(args: {
  readonly appId: number;
  readonly rawGameName: string | undefined;
  readonly rawGameIcon: string | undefined;
  readonly rawGameBoxArt: string | undefined;
  readonly playerAchievements: readonly RawSteamPlayerAchievement[];
  readonly schemaAchievements: readonly RawSteamSchemaAchievement[];
  readonly globalAchievementPercentages: ReadonlyMap<string, number>;
  readonly playtimeForever: number | undefined;
  readonly playtimeTwoWeeks: number | undefined;
  readonly playtimeDeckForever: number | undefined;
}): GameDetailSnapshot {
  const title = args.rawGameName ?? "Unknown Game";
  const playerAchievementsByName = new Map(
    args.playerAchievements.flatMap((achievement) => {
      const achievementName = pickString(achievement.apiname);
      if (achievementName === undefined) {
        return [];
      }

      return [[achievementName, achievement]] as const;
    }),
  );

  const normalizedAchievements: NormalizedAchievement[] = [];

  if (args.schemaAchievements.length > 0) {
    for (const schemaAchievement of args.schemaAchievements) {
      const achievementId = pickString(schemaAchievement.name);
      if (achievementId === undefined) {
        continue;
      }

      const playerAchievement = playerAchievementsByName.get(achievementId);
      const achieved = pickBoolean(playerAchievement?.achieved) ?? false;
      const unlockTime = normalizeEpochSeconds(playerAchievement?.unlocktime);
      const globalPercent = args.globalAchievementPercentages.get(achievementId);
      const normalizedAchievement = createSteamAchievementFromSchema({
        appId: args.appId,
        schemaAchievement,
        playerAchievement,
        achieved,
        unlockTime,
        globalPercent,
      });

      if (normalizedAchievement !== undefined) {
        normalizedAchievements.push(normalizedAchievement);
      }
    }
  } else {
    for (const playerAchievement of args.playerAchievements) {
      const achievementId = pickString(playerAchievement.apiname);
      if (achievementId === undefined) {
        continue;
      }

      const globalPercent = args.globalAchievementPercentages.get(achievementId);
      const normalizedAchievement = createSteamAchievementFromPlayerOnly({
        appId: args.appId,
        playerAchievement,
        globalPercent,
      });

      if (normalizedAchievement !== undefined) {
        normalizedAchievements.push(normalizedAchievement);
      }
    }
  }

  const unlockedAchievements = normalizedAchievements.filter((achievement) => achievement.isUnlocked);
  const unlockedCount = unlockedAchievements.length;
  const totalCount = normalizedAchievements.length > 0 ? normalizedAchievements.length : undefined;
  const completionPercent =
    totalCount !== undefined && totalCount > 0
      ? Math.round((unlockedCount / totalCount) * 100)
      : undefined;
  const summary: ProgressSummary = {
    unlockedCount,
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(completionPercent !== undefined ? { completionPercent } : {}),
  };
  const coverImageUrl = normalizeSteamArtworkUrl(args.rawGameIcon, args.appId);

  return {
    game: {
      ...buildGameIdentity({
        appId: args.appId,
        title,
        platformLabel: "Steam",
        coverImageUrl,
        boxArtImageUrl: normalizeSteamArtworkUrl(args.rawGameBoxArt, args.appId),
      }),
      ...(args.playtimeForever !== undefined ? { playtimeForeverMinutes: args.playtimeForever } : {}),
      ...(args.playtimeTwoWeeks !== undefined ? { playtimeTwoWeeksMinutes: args.playtimeTwoWeeks } : {}),
      ...(args.playtimeDeckForever !== undefined
        ? { playtimeDeckForeverMinutes: args.playtimeDeckForever }
        : {}),
      status: totalCount !== undefined
        ? unlockedCount >= totalCount
          ? "mastered"
          : unlockedCount > 0
            ? "in_progress"
            : "locked"
        : unlockedCount > 0
          ? "in_progress"
          : "locked",
      summary,
      metrics: [
        {
          key: "steam-app-id",
          label: "Steam App ID",
          value: String(args.appId),
        },
        ...(args.playtimeForever !== undefined
          ? [
              {
                key: "playtime-forever",
                label: "Playtime",
                value: String(args.playtimeForever),
              },
            ]
          : []),
        {
          key: "unlocked-count",
          label: "Unlocked",
          value: String(unlockedCount),
        },
        ...(totalCount !== undefined
          ? [
              {
                key: "total-count",
                label: "Total",
                value: String(totalCount),
              },
            ]
          : []),
        ...(completionPercent !== undefined
          ? [
              {
                key: "completion-percent",
                label: "Completion",
                value: String(completionPercent),
              },
            ]
          : []),
      ],
    },
    achievements: normalizedAchievements,
    refreshedAt: Date.now(),
  };
}

export function normalizeSteamProfile(args: {
  readonly playerSummary: RawSteamPlayerSummary | undefined;
  readonly config: SteamProviderConfig;
  readonly recentGames: readonly RecentlyPlayedGame[];
  readonly gamesBeatenCount: number;
  readonly steamLevel?: number;
  readonly ownedGameCount?: number;
  readonly badgeCount?: number;
  readonly playerXp?: number;
  readonly steamBadges?: readonly SteamBadgeSummary[];
}): NormalizedProfile {
  const displayName =
    pickString(args.playerSummary?.personaname) ?? args.config.steamId64;
  const avatarUrl = pickString(
    args.playerSummary?.avatarfull,
    args.playerSummary?.avatarmedium,
    args.playerSummary?.avatar,
  );
  const profileUrl = pickString(args.playerSummary?.profileurl);
  const communityVisibilityState = pickNumber(args.playerSummary?.communityvisibilitystate);
  const memberSince = normalizeUnixSecondsToIso(args.playerSummary?.timecreated);
  const totalCount = args.recentGames.reduce((sum, game) => sum + (game.summary.totalCount ?? 0), 0);
  const unlockedCount = args.recentGames.reduce((sum, game) => sum + game.summary.unlockedCount, 0);
  const completionPercent =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : undefined;

  return {
    providerId: STEAM_PROVIDER_ID,
    identity: {
      providerId: STEAM_PROVIDER_ID,
      accountId: args.config.steamId64,
      displayName,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(profileUrl !== undefined ? { profileUrl } : {}),
    },
    summary: {
      unlockedCount,
      ...(totalCount > 0 ? { totalCount } : {}),
      ...(completionPercent !== undefined ? { completionPercent } : {}),
    },
    ...(args.steamLevel !== undefined ? { steamLevel: args.steamLevel } : {}),
    ...(args.ownedGameCount !== undefined ? { ownedGameCount: args.ownedGameCount } : {}),
    ...(args.badgeCount !== undefined ? { badgeCount: args.badgeCount } : {}),
    ...(args.playerXp !== undefined ? { playerXp: args.playerXp } : {}),
    ...(args.steamBadges !== undefined ? { steamBadges: args.steamBadges } : {}),
    metrics: [
      ...(memberSince !== undefined
        ? [
            {
              key: "member-since",
              label: "Member Since",
              value: memberSince,
            },
          ]
        : []),
      ...(args.steamLevel !== undefined
        ? [
            {
              key: "steam-level",
              label: "Steam Level",
              value: String(args.steamLevel),
            },
          ]
        : []),
      ...(args.ownedGameCount !== undefined
        ? [
            {
              key: "owned-games",
              label: "Owned Games",
              value: String(args.ownedGameCount),
            },
          ]
        : []),
      {
        key: "steam-id64",
        label: "Steam ID64",
        value: args.config.steamId64,
      },
      {
        key: "steam-language",
        label: "Language",
        value: args.config.language,
      },
      {
        key: "recent-aches-count",
        label: "Recent Achievements",
        value: String(args.config.recentAchievementsCount),
      },
      {
        key: "recently-played-count",
        label: "Recently Played",
        value: String(args.config.recentlyPlayedCount),
      },
      ...(args.badgeCount !== undefined
        ? [
            {
              key: "badge-count",
              label: "Badges",
              value: String(args.badgeCount),
              ...(args.playerXp !== undefined ? { detail: `${args.playerXp.toLocaleString()} XP` } : {}),
            },
          ]
        : []),
      {
        key: "include-played-free-games",
        label: "Include Played Free Games",
        value: args.config.includePlayedFreeGames ? "Yes" : "No",
      },
      ...(communityVisibilityState !== undefined
        ? [
            {
              key: "profile-visibility",
              label: "Profile Visibility",
              value: String(communityVisibilityState),
            },
          ]
        : []),
      {
        key: "games-beaten",
        label: "Perfect Games",
        value: String(args.gamesBeatenCount),
      },
      {
        key: "unlock-rate",
        label: "Completion",
        value: completionPercent !== undefined ? String(completionPercent) : "0",
      },
    ],
    ...(normalizeSteamCompletionProgressGames(args.recentGames).slice(0, 3).length > 0
      ? { featuredGames: normalizeSteamCompletionProgressGames(args.recentGames).slice(0, 3) }
      : {}),
  };
}

export function normalizeSteamRecentUnlocks(
  recentGames: readonly RecentlyPlayedGame[],
  gameDetails: readonly GameDetailSnapshot[],
): readonly RecentUnlock[] {
  const detailByGameId = new Map(gameDetails.map((detail) => [detail.game.gameId, detail] as const));
  const unlockedRecentUnlocks: RecentUnlock[] = [];

  for (const recentGame of recentGames) {
    const detail = detailByGameId.get(recentGame.gameId);
    if (detail === undefined) {
      continue;
    }

    for (const achievement of detail.achievements) {
      if (!achievement.isUnlocked) {
        continue;
      }

      unlockedRecentUnlocks.push({
        achievement,
        game: {
          providerId: recentGame.providerId,
          gameId: recentGame.gameId,
          title: recentGame.title,
          ...(recentGame.coverImageUrl !== undefined ? { coverImageUrl: recentGame.coverImageUrl } : {}),
          ...(recentGame.platformLabel !== undefined ? { platformLabel: recentGame.platformLabel } : {}),
        },
        ...(achievement.unlockedAt !== undefined ? { unlockedAt: achievement.unlockedAt } : {}),
      });
    }
  }

  return unlockedRecentUnlocks.sort(compareRecentUnlocks);
}

export function normalizeSteamCompletionProgressGames(
  recentGames: readonly RecentlyPlayedGame[],
): readonly NormalizedGame[] {
  return recentGames.map((game) => ({
    providerId: game.providerId,
    ...(game.appid !== undefined ? { appid: game.appid } : {}),
    gameId: game.gameId,
    title: game.title,
    ...(game.platformLabel !== undefined ? { platformLabel: game.platformLabel } : {}),
    ...(game.coverImageUrl !== undefined ? { coverImageUrl: game.coverImageUrl } : {}),
    ...(game.playtimeForeverMinutes !== undefined ? { playtimeForeverMinutes: game.playtimeForeverMinutes } : {}),
    ...(game.playtimeTwoWeeksMinutes !== undefined
      ? { playtimeTwoWeeksMinutes: game.playtimeTwoWeeksMinutes }
      : {}),
    ...(game.playtimeDeckForeverMinutes !== undefined
      ? { playtimeDeckForeverMinutes: game.playtimeDeckForeverMinutes }
      : {}),
    ...(game.lastPlayedAt !== undefined ? { lastPlayedAt: game.lastPlayedAt } : {}),
    status:
      game.summary.totalCount !== undefined
        ? game.summary.unlockedCount >= game.summary.totalCount
          ? "mastered"
          : game.summary.unlockedCount > 0
            ? "in_progress"
            : "locked"
        : game.summary.unlockedCount > 0
          ? "in_progress"
          : "locked",
    summary: game.summary,
    metrics: [
      {
        key: "steam-game-id",
        label: "Steam Game ID",
        value: game.gameId,
      },
      {
        key: "unlocked-count",
        label: "Unlocked",
        value: String(game.summary.unlockedCount),
      },
      ...(game.summary.totalCount !== undefined
        ? [
            {
              key: "total-count",
              label: "Total",
              value: String(game.summary.totalCount),
            },
          ]
        : []),
      ...(game.summary.completionPercent !== undefined
        ? [
            {
              key: "completion-percent",
              label: "Completion",
              value: String(game.summary.completionPercent),
            },
          ]
        : []),
    ],
  }));
}
