import assert from "node:assert/strict";
import { test } from "node:test";
import type { CacheEntry, CacheStore } from "../src/core/cache";
import {
  createProviderAchievementHistoryCacheKey,
  CACHE_VERSION,
  createProviderCompletionProgressCacheKey,
  createProviderDashboardCacheKey,
  createProviderGameDetailCacheKey,
} from "../src/core/cache-keys";
import { createAppServices } from "../src/core/app-services";
import type {
  DashboardSnapshot,
  GameDetailSnapshot,
  NormalizedGame,
  ProviderCapabilities,
  RecentlyPlayedGame,
} from "../src/core/domain";
import { createProviderRegistry } from "../src/core/provider-registry";
import type { AchievementProvider } from "../src/core/ports";
import type { KeyValueStore, PlatformServices } from "../src/core/platform";
import {
  ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY,
  DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
  parseAchievementCompanionSettings,
  serializeAchievementCompanionSettings,
} from "../src/core/settings";
import {
  applyDeckyRecentAchievementHistory,
  buildDeckyRecentAchievementHistory,
} from "../src/platform/decky/decky-app-services";
import {
  clearDeckyProviderConfig,
  clearDeckyRetroAchievementsAccountState,
  readDeckyProviderConfig,
  writeDeckyProviderConfig,
} from "../src/platform/decky/providers/retroachievements";
import { groupCompletionProgressGames } from "../src/platform/decky/decky-completion-progress-grouping";
import {
  normalizeRetroAchievementsCompletionProgressGames,
  normalizeRetroAchievementsGameDetail,
  normalizeRetroAchievementsProfile,
  normalizeRetroAchievementsRecentUnlocks,
  normalizeRetroAchievementsRecentlyPlayedGames,
} from "../src/providers/retroachievements/mappers/normalize";
import type {
  RawRetroAchievementsCompletionProgressEntry,
  RawRetroAchievementsGameProgressResponse,
  RawRetroAchievementsProfileResponse,
  RawRetroAchievementsRecentUnlockResponse,
  RawRetroAchievementsRecentlyPlayedGameResponse,
} from "../src/providers/retroachievements/raw-types";
import {
  readDeckyStorageText,
  writeDeckyStorageText,
} from "../src/platform/decky/storage";
import {
  createRetroAchievementsProvider,
  type RetroAchievementsClient,
} from "../src/providers/retroachievements";

const PROVIDER_ID = "retroachievements";
const PLATFORM: PlatformServices = {
  info: {
    platformId: "decky",
    appName: "Achievement Companion",
  },
};
const PROVIDER_CAPABILITIES: ProviderCapabilities = {
  requiresCredentials: true,
  profileSummary: true,
  completionProgress: true,
  recentUnlocks: true,
  gameProgress: true,
  rarityStats: true,
  search: false,
};

interface CallCounts {
  config: number;
  profile: number;
  completionProgress: number;
  recentUnlocks: number;
  achievementsEarnedBetween: number;
  recentlyPlayedGames: number;
  gameProgress: number;
}

function createMemoryCacheStore(
  initialEntries: readonly CacheEntry<unknown>[] = [],
): { readonly cacheStore: CacheStore; readonly writes: readonly CacheEntry<unknown>[] } {
  const entries = new Map<string, CacheEntry<unknown>>();
  const writes: CacheEntry<unknown>[] = [];

  for (const entry of initialEntries) {
    entries.set(entry.key, entry);
  }

  return {
    writes,
    cacheStore: {
      async read<T>(key: string): Promise<CacheEntry<T> | undefined> {
        return entries.get(key) as CacheEntry<T> | undefined;
      },

      async write<T>(entry: CacheEntry<T>): Promise<void> {
        writes.push(entry as CacheEntry<unknown>);
        entries.set(entry.key, entry as CacheEntry<unknown>);
      },

      async delete(key: string): Promise<void> {
        entries.delete(key);
      },

      async clear(prefix?: string): Promise<void> {
        if (prefix === undefined) {
          entries.clear();
          return;
        }

        for (const key of [...entries.keys()]) {
          if (key.startsWith(prefix)) {
            entries.delete(key);
          }
        }
      },
    },
  };
}

function createCacheEntry<T>(
  key: string,
  value: T,
  storedAt: number,
  expiresAt: number,
): CacheEntry<T> {
  return {
    key,
    value,
    storedAt,
    expiresAt,
    version: CACHE_VERSION,
  };
}

function createDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: {
      providerId: PROVIDER_ID,
      identity: {
        providerId: PROVIDER_ID,
        accountId: "alice",
        displayName: "Alice",
      },
      summary: {
        unlockedCount: 12,
        totalCount: 20,
        completionPercent: 60,
      },
      metrics: [],
      refreshedAt: 1_700_000_000_000,
    },
    recentAchievements: [],
    recentlyPlayedGames: [],
    recentUnlocks: [],
    featuredGames: [],
    refreshedAt: 1_700_000_000_000,
  };
}

function createDashboardSnapshotWithRecentAchievements(
  recentAchievements: DashboardSnapshot["recentAchievements"],
): DashboardSnapshot {
  return {
    ...createDashboardSnapshot(),
    recentAchievements,
    recentUnlocks: recentAchievements,
  };
}

function createRecentUnlock(sequence: number): DashboardSnapshot["recentAchievements"][number] {
  const unlockedAt = 1_700_000_000_000 + sequence * 1_000;

  return {
    achievement: {
      providerId: PROVIDER_ID,
      achievementId: `ach-${sequence}`,
      gameId: "game-1",
      title: `Achievement ${sequence}`,
      isUnlocked: true,
      unlockedAt,
      points: 10,
      metrics: [],
    },
    game: {
      providerId: PROVIDER_ID,
      gameId: "game-1",
      title: "Test Game",
    },
    unlockedAt,
  };
}

function createRecentUnlockWithoutTimestamp(
  sequence: number,
): DashboardSnapshot["recentAchievements"][number] {
  const recentUnlock = createRecentUnlock(sequence);

  return {
    ...recentUnlock,
    achievement: {
      ...recentUnlock.achievement,
      unlockedAt: undefined,
    },
    unlockedAt: undefined,
  };
}

function createRecentUnlockForGame(
  gameId: string,
  gameTitle: string,
  achievementNumber: number,
  unlockedAt: number,
): DashboardSnapshot["recentAchievements"][number] {
  return {
    achievement: {
      providerId: PROVIDER_ID,
      achievementId: `${gameId}-ach-${achievementNumber}`,
      gameId,
      title: `${gameTitle} Achievement ${achievementNumber}`,
      isUnlocked: true,
      unlockedAt,
      points: 10,
      metrics: [],
    },
    game: {
      providerId: PROVIDER_ID,
      gameId,
      title: gameTitle,
    },
    unlockedAt,
  };
}

function createBackfillGameDetail(
  gameId: string,
  title: string,
  timestamps: readonly number[],
): GameDetailSnapshot {
  return {
    game: {
      providerId: PROVIDER_ID,
      gameId,
      title,
      summary: {
        unlockedCount: timestamps.length,
      },
      metrics: [],
    },
    achievements: timestamps.map((unlockedAt, index) => ({
      providerId: PROVIDER_ID,
      achievementId: `${gameId}-ach-${index + 1}`,
      gameId,
      title: `${title} Achievement ${index + 1}`,
      description: `Unlock ${index + 1} for ${title}`,
      isUnlocked: true,
      unlockedAt,
      points: 10 + index,
      metrics: [],
    })),
    refreshedAt: timestamps[0],
  };
}

function createBackfillCompletionProgress(): readonly NormalizedGame[] {
  return [
    {
      providerId: PROVIDER_ID,
      gameId: "game-a",
      title: "Game A",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
      },
      metrics: [],
      lastUnlockAt: 1_700_000_000_500,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "game-b",
      title: "Game B",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
      },
      metrics: [],
      lastUnlockAt: 1_700_000_000_200,
    },
  ];
}

function createBackfillCompletionProgressWithoutDates(): readonly NormalizedGame[] {
  return [
    {
      providerId: PROVIDER_ID,
      gameId: "game-a",
      title: "Game A",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
      },
      metrics: [],
    },
    {
      providerId: PROVIDER_ID,
      gameId: "game-b",
      title: "Game B",
      status: "in_progress",
      summary: {
        unlockedCount: 2,
      },
      metrics: [],
    },
  ];
}

function createBackfillRecentlyPlayedGame(
  gameId: string,
  title: string,
  unlockedCount: number,
  lastPlayedAt: number,
): RecentlyPlayedGame {
  return {
    providerId: PROVIDER_ID,
    gameId,
    title,
    summary: {
      unlockedCount,
    },
    lastPlayedAt,
  };
}

function createMockStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string): string | null {
      return entries.get(key) ?? null;
    },
    key(index: number): string | null {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
  };
}

function createMemoryKeyValueStore(
  initialEntries: Readonly<Record<string, string>> = {},
): KeyValueStore {
  const entries = new Map<string, string>(Object.entries(initialEntries));

  return {
    async read(key: string): Promise<string | undefined> {
      return entries.get(key);
    },

    async write(key: string, value: string): Promise<void> {
      entries.set(key, value);
    },

    async delete(key: string): Promise<void> {
      entries.delete(key);
    },
  };
}

async function withMockDeckyStorage<T>(callback: () => Promise<T> | T): Promise<T> {
  const globalObject = globalThis as typeof globalThis & {
    localStorage?: Storage;
    sessionStorage?: Storage;
  };
  const previousLocalStorage = globalObject.localStorage;
  const previousSessionStorage = globalObject.sessionStorage;
  const mockStorage = createMockStorage();

  globalObject.localStorage = mockStorage;
  globalObject.sessionStorage = mockStorage;

  try {
    return await callback();
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalObject.localStorage;
    } else {
      globalObject.localStorage = previousLocalStorage;
    }

    if (previousSessionStorage === undefined) {
      delete globalObject.sessionStorage;
    } else {
      globalObject.sessionStorage = previousSessionStorage;
    }
  }
}

const DASHBOARD_REFRESH_FEATURED_GAMES: DashboardSnapshot["featuredGames"] = [
  {
    providerId: PROVIDER_ID,
    gameId: "game-2",
    title: "Test Journey",
    platformLabel: "NES",
    status: "in_progress",
    summary: {
      unlockedCount: 4,
      totalCount: 10,
      completionPercent: 40,
    },
    metrics: [],
    lastUnlockAt: 1_700_000_000_050,
  },
];

const DASHBOARD_REFRESH_PROFILE: DashboardSnapshot["profile"] = {
  providerId: PROVIDER_ID,
  identity: {
    providerId: PROVIDER_ID,
    accountId: "alice",
    displayName: "Alice",
  },
  summary: {
    unlockedCount: 12,
    totalCount: 20,
    completionPercent: 60,
  },
  metrics: [],
  featuredGames: DASHBOARD_REFRESH_FEATURED_GAMES,
  refreshedAt: 1_700_000_000_100,
};

const DASHBOARD_REFRESH_RECENT_UNLOCKS: DashboardSnapshot["recentUnlocks"] = [
  {
    achievement: {
      providerId: PROVIDER_ID,
      achievementId: "ach-1",
      gameId: "game-1",
      title: "First Blood",
      isUnlocked: true,
      unlockedAt: 1_700_000_000_100,
      points: 10,
      metrics: [],
    },
    game: {
      providerId: PROVIDER_ID,
      gameId: "game-1",
      title: "Test Game",
    },
    unlockedAt: 1_700_000_000_100,
  },
];

const DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES: DashboardSnapshot["recentlyPlayedGames"] = [
  {
    providerId: PROVIDER_ID,
    gameId: "game-3",
    title: "Familiar Game",
    platformLabel: "SNES",
    coverImageUrl: "https://example.com/game-3.png",
    summary: {
      unlockedCount: 8,
      totalCount: 16,
      completionPercent: 50,
    },
    lastPlayedAt: 1_700_000_000_200,
  },
];

function createGameDetailSnapshot(): GameDetailSnapshot {
  return {
    game: {
      providerId: PROVIDER_ID,
      gameId: "game-1",
      title: "Test Game",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
        totalCount: 10,
        completionPercent: 30,
      },
      metrics: [],
    },
    achievements: [],
    refreshedAt: 1_700_000_000_000,
  };
}

test("retroachievements game progress normalizes achievement badge art", () => {
  const rawGameProgress: RawRetroAchievementsGameProgressResponse = {
    ID: 14402,
    Title: "Dragster",
    ConsoleName: "Atari 2600",
    ImageIcon: "/Images/026368.png",
    ImageBoxArt: "/Images/066952.png",
    NumAchievements: 1,
    NumAwardedToUser: 1,
    HighestAwardKind: "mastered",
    HighestAwardDate: "2024-04-23T21:28:49+00:00",
    Achievements: {
      "79434": {
        ID: 79434,
        Title: "Novice Dragster Driver 1",
        Description: "Complete your very first race in game 1.",
        Points: 1,
        NumAwarded: 200,
        NumAwardedHardcore: 50,
        BadgeName: "85541",
        DisplayOrder: 0,
        DateEarned: "2022-08-23 22:56:38",
        DateEarnedHardcore: "2022-08-23 22:56:38",
      },
    },
  };

  const snapshot = normalizeRetroAchievementsGameDetail(rawGameProgress);

  assert.equal(
    snapshot.achievements[0]?.badgeImageUrl,
    "https://i.retroachievements.org/Badge/85541.png",
  );
  assert.equal(
    snapshot.achievements[0]?.metrics.find((metric) => metric.key === "unlocked-count")?.value,
    "200",
  );
  assert.equal(
    snapshot.achievements[0]?.metrics.find((metric) => metric.key === "hardcore-unlocked-count")?.value,
    "50",
  );
  assert.equal(
    snapshot.achievements[0]?.metrics.find((metric) => metric.key === "softcore-unlocked-count")?.value,
    "150",
  );
  assert.equal(
    snapshot.game.coverImageUrl,
    "https://i.retroachievements.org/Images/026368.png",
  );
  assert.equal(
    snapshot.game.boxArtImageUrl,
    "https://i.retroachievements.org/Images/066952.png",
  );
});

test("retroachievements recent unlocks normalize badge art urls", () => {
  const rawRecentUnlocks: readonly RawRetroAchievementsRecentUnlockResponse[] = [
    {
      AchievementID: 108302,
      Title: "First Steps",
      Description: "Unlock a starter achievement.",
      BadgeURL: "/Badge/108302.png",
      GameID: 1234,
      GameTitle: "Test Game",
      GameIcon: "/Images/000001.png",
      ConsoleName: "NES",
      Date: "2024-01-01 00:00:00",
    },
  ];

  const recentUnlocks = normalizeRetroAchievementsRecentUnlocks(rawRecentUnlocks);

  assert.equal(
    recentUnlocks[0]?.achievement.badgeImageUrl,
    "https://i.retroachievements.org/Badge/108302.png",
  );
});

test("retroachievements profile normalizes avatar image urls", () => {
  const rawProfile: RawRetroAchievementsProfileResponse = {
    User: "Alice",
    ULID: "abc123",
    UserPic: "/UserPic/0001.png",
    MemberSince: "2020-01-02 00:00:00",
    Motto: "Keep on playing",
    TotalPoints: 1234,
  };

  const profile = normalizeRetroAchievementsProfile(
    rawProfile,
    {
      unlockedCount: 12,
      totalCount: 20,
      completionPercent: 60,
    },
    {
      username: "alice",
      apiKey: "secret",
    },
  );

  assert.equal(
    profile.identity.avatarUrl,
    "https://i.retroachievements.org/UserPic/0001.png",
  );
  assert.equal(profile.motto, "Keep on playing");
});

test("achievement companion settings normalize invalid stored values", () => {
  const settings = parseAchievementCompanionSettings(
    JSON.stringify({
      recentAchievementsCount: 9,
      recentlyPlayedCount: 3,
      showCompletionProgressSubsets: "yes",
      defaultCompletionProgressFilter: "secret",
    }),
  );

  assert.deepStrictEqual(settings, {
    ...DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS,
    recentlyPlayedCount: 3,
  });
  assert.equal(
    serializeAchievementCompanionSettings(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS),
    JSON.stringify(DEFAULT_ACHIEVEMENT_COMPANION_SETTINGS),
  );
});

test("decky provider config persists and clears retroachievements credentials", async () => {
  await withMockDeckyStorage(async () => {
    assert.equal(readDeckyProviderConfig("retroachievements"), undefined);

    assert.equal(
      writeDeckyProviderConfig({
        username: "alice",
        apiKey: "secret",
      }),
      true,
    );
    assert.deepStrictEqual(readDeckyProviderConfig("retroachievements"), {
      username: "alice",
      apiKey: "secret",
    });

    assert.equal(clearDeckyProviderConfig(), true);
    assert.equal(readDeckyProviderConfig("retroachievements"), undefined);
  });
});

test("decky sign out clears retroachievements credentials and recent history", async () => {
  await withMockDeckyStorage(async () => {
    const recentHistoryStorageKey = "achievement-companion:decky:recent-achievements:retroachievements:alice";

    assert.equal(
      writeDeckyStorageText(recentHistoryStorageKey, JSON.stringify([{ recentUnlock: 1 }])),
      true,
    );
    assert.equal(
      writeDeckyProviderConfig({
        username: "alice",
        apiKey: "secret",
      }),
      true,
    );

    assert.equal(clearDeckyRetroAchievementsAccountState(), true);
    assert.equal(readDeckyProviderConfig("retroachievements"), undefined);
    assert.equal(readDeckyStorageText(recentHistoryStorageKey), undefined);
  });
});

test("retroachievements profile exposes points, games beaten, and retroratio metrics", async () => {
  const provider = createRetroAchievementsProvider({
    client: {
      async loadProfile() {
        return {
          User: "Alice",
          ULID: "abc123",
          TotalPoints: 100,
          TotalSoftcorePoints: 25,
          TotalTruePoints: 250,
        };
      },

      async loadCompletionProgress() {
        return [
          {
            GameID: 1,
            Title: "Beaten One",
            NumAwarded: 5,
            MaxPossible: 5,
            HighestAwardKind: "beaten",
          },
          {
            GameID: 2,
            Title: "Beaten Two",
            NumAwarded: 0,
            MaxPossible: 0,
            HighestAwardKind: "beaten-hardcore",
          },
          {
            GameID: 3,
            Title: "Unfinished",
            NumAwarded: 2,
            MaxPossible: 10,
          },
        ] satisfies readonly RawRetroAchievementsCompletionProgressEntry[];
      },

      async loadAchievementsEarnedBetween() {
        return [];
      },

      async loadRecentUnlocks() {
        return [];
      },

      async loadRecentlyPlayedGames() {
        return [];
      },

      async loadGameProgress() {
        throw new Error("not used");
      },
    },
  });

  const profile = await provider.loadProfile({
    username: "alice",
    apiKey: "secret",
  });

  assert.equal(
    profile.metrics.find((metric) => metric.key === "total-points")?.value,
    "100",
  );
  assert.equal(
    profile.metrics.find((metric) => metric.key === "games-beaten")?.value,
    "2",
  );
  assert.equal(
    profile.metrics.find((metric) => metric.key === "retro-ratio")?.value,
    "2.50",
  );
});

test("retroachievements completion progress normalizes beaten and mastered status", () => {
  const games = normalizeRetroAchievementsCompletionProgressGames([
    {
      GameID: 1,
      Title: "Beaten Game",
      ConsoleName: "NES",
      MaxPossible: 5,
      NumAwarded: 3,
      HighestAwardKind: "beaten-hardcore",
    },
    {
      GameID: 2,
      Title: "Mastered Game",
      ConsoleName: "NES",
      MaxPossible: 5,
      NumAwarded: 5,
      HighestAwardKind: "mastered",
    },
    {
      GameID: 3,
      Title: "Completed Game",
      ConsoleName: "NES",
      MaxPossible: 10,
      NumAwarded: 9,
      HighestAwardKind: "completed-hardcore",
    },
  ] satisfies readonly RawRetroAchievementsCompletionProgressEntry[]);

  assert.equal(games.find((game) => game.title === "Beaten Game")?.status, "beaten");
  assert.equal(games.find((game) => game.title === "Mastered Game")?.status, "mastered");
  assert.equal(games.find((game) => game.title === "Completed Game")?.status, "completed");
});

test("retroachievements completion progress preserves parent game ids", () => {
  const games = normalizeRetroAchievementsCompletionProgressGames([
    {
      GameID: 1,
      Title: "Mega Man X",
      ConsoleName: "SNES",
      MaxPossible: 10,
      NumAwarded: 5,
      ParentGameID: null,
    },
    {
      GameID: 2,
      Title: "Mega Man X (Subset)",
      ConsoleName: "SNES",
      MaxPossible: 6,
      NumAwarded: 3,
      ParentGameID: 1,
    },
  ] satisfies readonly RawRetroAchievementsCompletionProgressEntry[]);

  assert.equal(games.find((game) => game.gameId === "1")?.parentGameId, undefined);
  assert.equal(games.find((game) => game.gameId === "2")?.parentGameId, "1");
});

test("completion progress groups explicit subsets under the parent game", () => {
  const groupedGames = groupCompletionProgressGames([
    {
      providerId: PROVIDER_ID,
      gameId: "base-game",
      title: "Mega Man X",
      platformLabel: "SNES",
      status: "in_progress",
      summary: {
        unlockedCount: 5,
        totalCount: 10,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_900,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-a",
      title: "Mega Man X (Subset)",
      platformLabel: "SNES",
      parentGameId: "base-game",
      status: "in_progress",
      summary: {
        unlockedCount: 3,
        totalCount: 6,
        completionPercent: 50,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_800,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "subset-b",
      title: "Mega Man X (Challenge Set)",
      platformLabel: "SNES",
      status: "beaten",
      summary: {
        unlockedCount: 6,
        totalCount: 6,
        completionPercent: 100,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_700,
    },
    {
      providerId: PROVIDER_ID,
      gameId: "other-game",
      title: "Donkey Kong Country",
      platformLabel: "SNES",
      status: "mastered",
      summary: {
        unlockedCount: 8,
        totalCount: 8,
        completionPercent: 100,
      },
      metrics: [],
      lastUnlockAt: 1_900_000_000_600,
    },
  ]);

  const groupedMegaManX = groupedGames.find(
    (group) => group.representativeGame.title === "Mega Man X",
  );

  assert.equal(groupedGames.length, 2);
  assert.equal(groupedMegaManX?.games.length, 3);
  assert.equal(groupedMegaManX?.subsetGames.length, 2);
  assert.deepStrictEqual(
    groupedMegaManX?.subsetGames.map((game) => game.title),
    ["Mega Man X (Subset)", "Mega Man X (Challenge Set)"],
  );
});

const DOCUMENTED_GAME_PROGRESS_RESPONSE = {
  ID: 14402,
  Title: "Dragster",
  ConsoleName: "Atari 2600",
  ImageIcon: "/Images/026368.png",
  Publisher: "Activision",
  Developer: "David Crane",
  Genre: "Racing",
  Released: "1992-06-02 00:00:00",
  NumAchievements: 2,
  NumAwardedToUser: 1,
  NumAwardedToUserHardcore: 1,
  UserCompletion: "50.00%",
  UserCompletionHardcore: "50.00%",
  UserTotalPlaytime: 60,
  HighestAwardDate: "2024-04-23T21:28:49+00:00",
  Achievements: {
    "79434": {
      ID: 79434,
      NumAwarded: 366,
      NumAwardedHardcore: 274,
      Title: "Novice Dragster Driver 1",
      Description: "Complete your very first race in game 1.",
      Points: 1,
      TrueRatio: 1,
      Author: "Boldewin",
      AuthorULID: "00003EMFWR7XB8SDPEHB3K56ZQ",
      DateModified: "2019-08-01 19:03:46",
      DateCreated: "2019-07-31 18:49:57",
      BadgeName: "85541",
      DisplayOrder: 0,
      MemAddr: "f5c41fa0b5fa0d5fbb8a74c598f18582",
      Type: "progression",
      DateEarned: "2024-04-23 21:28:49",
      DateEarnedHardcore: "2024-04-23 21:28:49",
    },
    "79435": {
      ID: 79435,
      NumAwarded: 100,
      NumAwardedHardcore: 50,
      Title: "Another Test Achievement",
      Description: "Do something else.",
      Points: 2,
      TrueRatio: 2,
      Author: "Boldewin",
      AuthorULID: "00003EMFWR7XB8SDPEHB3K56ZQ",
      DateModified: "2019-08-01 19:03:46",
      DateCreated: "2019-07-31 18:49:57",
      BadgeName: "85542",
      DisplayOrder: 1,
      MemAddr: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      Type: "progression",
    },
  },
} satisfies RawRetroAchievementsGameProgressResponse;

function createRetroAchievementsGameDetailClient(
  response: RawRetroAchievementsGameProgressResponse,
  counts?: Pick<CallCounts, "gameProgress" | "achievementsEarnedBetween">,
): RetroAchievementsClient {
  return {
    async loadProfile() {
      return {
        User: "Alice",
      };
    },

    async loadCompletionProgress() {
      return [];
    },

    async loadAchievementsEarnedBetween() {
      if (counts !== undefined) {
        counts.achievementsEarnedBetween += 1;
      }

      return [];
    },

    async loadRecentUnlocks() {
      return [];
    },

    async loadRecentlyPlayedGames() {
      return [];
    },

    async loadGameProgress() {
      if (counts !== undefined) {
        counts.gameProgress += 1;
      }

      return response;
    },
  };
}

function createThrowingProvider(counts: CallCounts): AchievementProvider {
  return {
    id: PROVIDER_ID,
    capabilities: PROVIDER_CAPABILITIES,
    async loadProfile() {
      counts.profile += 1;
      throw new Error("dashboard refresh failed");
    },
    async loadCompletionProgress() {
      counts.completionProgress += 1;
      throw new Error("completion progress refresh failed");
    },
    async loadAchievementsEarnedBetween() {
      counts.achievementsEarnedBetween += 1;
      throw new Error("achievement history refresh failed");
    },
    async loadRecentUnlocks() {
      counts.recentUnlocks += 1;
      throw new Error("dashboard refresh failed");
    },
    async loadRecentlyPlayedGames() {
      counts.recentlyPlayedGames += 1;
      throw new Error("dashboard refresh failed");
    },
    async loadGameProgress(_config, _gameId) {
      counts.gameProgress += 1;
      throw new Error("game detail refresh failed");
    },
  };
}

function createSuccessfulProvider(counts: CallCounts): AchievementProvider {
  return {
    id: PROVIDER_ID,
    capabilities: PROVIDER_CAPABILITIES,
    async loadProfile() {
      counts.profile += 1;
      return DASHBOARD_REFRESH_PROFILE;
    },
    async loadCompletionProgress() {
      counts.completionProgress += 1;
      return [];
    },
    async loadAchievementsEarnedBetween() {
      counts.achievementsEarnedBetween += 1;
      return [];
    },
    async loadRecentUnlocks() {
      counts.recentUnlocks += 1;
      return DASHBOARD_REFRESH_RECENT_UNLOCKS;
    },
    async loadRecentlyPlayedGames() {
      counts.recentlyPlayedGames += 1;
      return DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES;
    },
    async loadGameProgress() {
      counts.gameProgress += 1;
      return createGameDetailSnapshot();
    },
  };
}

function createHarness(options: {
  readonly cacheEntries?: readonly CacheEntry<unknown>[];
  readonly providerConfig?: unknown | undefined;
  readonly providerFactory?: (counts: CallCounts) => AchievementProvider;
  readonly platform?: PlatformServices;
}) {
  const counts: CallCounts = {
    config: 0,
    profile: 0,
    completionProgress: 0,
    recentUnlocks: 0,
    achievementsEarnedBetween: 0,
    recentlyPlayedGames: 0,
    gameProgress: 0,
  };

  const provider = options.providerFactory?.(counts) ?? createThrowingProvider(counts);
  const { cacheStore, writes } = createMemoryCacheStore(options.cacheEntries);
  const loadProviderConfig = async (): Promise<unknown | undefined> => {
    counts.config += 1;
    return options.providerConfig;
  };

  return {
    counts,
    writes,
    appServices: createAppServices({
      providerRegistry: createProviderRegistry([provider]),
      platform: options.platform ?? PLATFORM,
      cacheStore,
      loadProviderConfig,
    }),
  };
}

test("dashboard cache hit returns cached state without calling refresh path", async () => {
  const now = Date.now();
  const cachedSnapshot = createDashboardSnapshot();
  const cacheKey = createProviderDashboardCacheKey(PROVIDER_ID);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 1_000, now + 60_000),
    ],
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(counts.config, 0);
  assert.equal(counts.profile, 0);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(counts.recentlyPlayedGames, 0);
});

test("dashboard missing config returns auth error state", async () => {
  const { appServices, counts } = createHarness({
    providerConfig: undefined,
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "error");
  assert.equal(state.error?.kind, "auth");
  assert.match(state.error?.userMessage ?? "", /provider settings are missing/i);
  assert.equal(state.isStale, false);
  assert.equal(state.data, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 0);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(counts.recentlyPlayedGames, 0);
});

test("dashboard stale cached data is preserved when refresh fails", async () => {
  const now = Date.now();
  const cachedSnapshot = createDashboardSnapshot();
  const cacheKey = createProviderDashboardCacheKey(PROVIDER_ID);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 60_000, now - 1),
    ],
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID, {
    forceRefresh: true,
  });

  assert.equal(state.status, "stale");
  assert.equal(state.isStale, true);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(state.error?.kind, "unknown");
  assert.match(state.error?.userMessage ?? "", /refresh dashboard data/i);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
});

test("dashboard successful refresh writes normalized snapshot to cache", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: createSuccessfulProvider,
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
  assert.deepStrictEqual(state.data?.featuredGames, DASHBOARD_REFRESH_FEATURED_GAMES);
  assert.deepStrictEqual(state.data?.profile, DASHBOARD_REFRESH_PROFILE);
  assert.deepStrictEqual(state.data?.recentUnlocks, DASHBOARD_REFRESH_RECENT_UNLOCKS);
  assert.deepStrictEqual(state.data?.recentAchievements, DASHBOARD_REFRESH_RECENT_UNLOCKS);
  assert.deepStrictEqual(state.data?.recentlyPlayedGames, DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderDashboardCacheKey(PROVIDER_ID));
  assert.equal(writes[0]?.version, CACHE_VERSION);
  assert.equal(writes[0]?.storedAt, state.lastUpdatedAt);
  assert.deepStrictEqual(writes[0]?.value, state.data);
});

test("dashboard recent achievements and recently played games populate from provider data", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        callCounts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
      },
      async loadRecentUnlocks() {
        callCounts.recentUnlocks += 1;
        return DASHBOARD_REFRESH_RECENT_UNLOCKS;
      },
      async loadRecentlyPlayedGames() {
        callCounts.recentlyPlayedGames += 1;
        return DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES;
      },
      async loadGameProgress() {
        callCounts.gameProgress += 1;
        return createGameDetailSnapshot();
      },
    }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data?.recentAchievements, DASHBOARD_REFRESH_RECENT_UNLOCKS);
  assert.deepStrictEqual(state.data?.recentlyPlayedGames, DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.recentUnlocks, 1);
  assert.equal(counts.recentlyPlayedGames, 1);
});

test("dashboard honors decky settings counts for recent achievements and recently played games", async () => {
  const settingsStore = createMemoryKeyValueStore({
    [ACHIEVEMENT_COMPANION_SETTINGS_STORAGE_KEY]: JSON.stringify({
      recentAchievementsCount: 3,
      recentlyPlayedCount: 7,
      showCompletionProgressSubsets: false,
      defaultCompletionProgressFilter: "beaten",
    }),
  });

  const provider = {
    id: PROVIDER_ID,
    capabilities: PROVIDER_CAPABILITIES,
    async loadProfile() {
      return DASHBOARD_REFRESH_PROFILE;
    },
    async loadRecentUnlocks(_config: unknown, options?: { readonly limit?: number }) {
      assert.equal(options?.limit, 3);
      return Array.from({ length: 8 }, (_value, index) => createRecentUnlock(index + 1));
    },
    async loadRecentlyPlayedGames(_config: unknown, options?: { readonly count?: number }) {
      assert.equal(options?.count, 7);
      return Array.from({ length: 8 }, (_value, index) => ({
        providerId: PROVIDER_ID,
        gameId: `game-${index + 1}`,
        title: `Game ${index + 1}`,
        summary: {
          unlockedCount: index + 1,
        },
        lastPlayedAt: 1_700_000_000_000 + index * 1_000,
      }));
    },
    async loadCompletionProgress() {
      return [];
    },
    async loadAchievementsEarnedBetween() {
      return [];
    },
    async loadGameProgress() {
      return createGameDetailSnapshot();
    },
  } satisfies AchievementProvider;

  const { appServices } = createHarness({
    providerFactory: () => provider,
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
    platform: {
      ...PLATFORM,
      settingsStore,
    },
  });

  const state = await appServices.dashboard.loadDashboard(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.data?.recentAchievements.length, 8);
  assert.equal(state.data?.recentUnlocks.length, 8);
  assert.equal(state.data?.recentlyPlayedGames.length, 8);
});

test("achievement history service loads newest-first earned-between history and caches it", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: () => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        counts.profile += 1;
        return {
          ...DASHBOARD_REFRESH_PROFILE,
          metrics: [
            ...DASHBOARD_REFRESH_PROFILE.metrics,
            {
              key: "member-since",
              label: "Member Since",
              value: "2020-01-02 00:00:00",
            },
          ],
        };
      },
      async loadCompletionProgress() {
        counts.completionProgress += 1;
        return [];
      },
      async loadAchievementsEarnedBetween(_config, options) {
        counts.achievementsEarnedBetween += 1;
        assert.equal(options.fromEpochSeconds, Math.trunc(Date.parse("2020-01-02 00:00:00") / 1000));
        return [
          createRecentUnlockForGame("game-1", "Test Game", 1, 1_700_000_000_100),
          createRecentUnlockForGame("game-2", "Second Game", 1, 1_700_000_000_300),
          createRecentUnlockForGame("game-1", "Test Game", 2, 1_700_000_000_200),
        ];
      },
      async loadRecentUnlocks() {
        counts.recentUnlocks += 1;
        return [];
      },
      async loadRecentlyPlayedGames() {
        counts.recentlyPlayedGames += 1;
        return [];
      },
      async loadGameProgress() {
        counts.gameProgress += 1;
        return createGameDetailSnapshot();
      },
    }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.achievementHistory.loadAchievementHistory(PROVIDER_ID, {
    forceRefresh: true,
  });
  const cachedState = await appServices.achievementHistory.loadAchievementHistory(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data?.entries.map((entry) => entry.achievement.achievementId), [
    "game-2-ach-1",
    "game-1-ach-2",
    "game-1-ach-1",
  ]);
  assert.equal(state.data?.summary.unlockedCount, 3);
  assert.match(state.data?.sourceLabel ?? "", /Member since/i);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.achievementsEarnedBetween, 1);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(cachedState.status, "success");
  assert.deepStrictEqual(cachedState.data?.entries.map((entry) => entry.achievement.achievementId), [
    "game-2-ach-1",
    "game-1-ach-2",
    "game-1-ach-1",
  ]);
  assert.equal(counts.config, 1);
  assert.equal(counts.profile, 1);
  assert.equal(counts.achievementsEarnedBetween, 1);
  assert.equal(counts.recentUnlocks, 0);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderAchievementHistoryCacheKey(PROVIDER_ID));
});

test("completion progress service exposes played, unfinished, beaten, and mastered counts", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: (callCounts) => ({
      id: PROVIDER_ID,
      capabilities: PROVIDER_CAPABILITIES,
      async loadProfile() {
        callCounts.profile += 1;
        return DASHBOARD_REFRESH_PROFILE;
      },
      async loadCompletionProgress() {
        callCounts.completionProgress += 1;
        return [
          {
            providerId: PROVIDER_ID,
            gameId: "unfinished-game",
            title: "Unfinished Game",
            status: "in_progress",
            summary: {
              unlockedCount: 3,
              totalCount: 10,
              completionPercent: 30,
            },
            metrics: [],
          },
          {
            providerId: PROVIDER_ID,
            gameId: "completed-game",
            title: "Completed Game",
            status: "completed",
            summary: {
              unlockedCount: 9,
              totalCount: 10,
              completionPercent: 90,
            },
            metrics: [],
          },
          {
            providerId: PROVIDER_ID,
            gameId: "beaten-game",
            title: "Beaten Game",
            status: "beaten",
            summary: {
              unlockedCount: 10,
              totalCount: 10,
              completionPercent: 100,
            },
            metrics: [],
          },
          {
            providerId: PROVIDER_ID,
            gameId: "mastered-game",
            title: "Mastered Game",
            status: "mastered",
            summary: {
              unlockedCount: 12,
              totalCount: 12,
              completionPercent: 100,
            },
            metrics: [],
          },
        ] satisfies readonly NormalizedGame[];
      },
      async loadRecentUnlocks() {
        callCounts.recentUnlocks += 1;
        return DASHBOARD_REFRESH_RECENT_UNLOCKS;
      },
      async loadRecentlyPlayedGames() {
        callCounts.recentlyPlayedGames += 1;
        return DASHBOARD_REFRESH_RECENTLY_PLAYED_GAMES;
      },
      async loadGameProgress() {
        callCounts.gameProgress += 1;
        return createGameDetailSnapshot();
      },
    }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.completionProgress.loadCompletionProgress(PROVIDER_ID);

  assert.equal(state.status, "success");
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data?.summary, {
    playedCount: 4,
    unfinishedCount: 1,
    beatenCount: 1,
    masteredCount: 1,
  });
  assert.deepStrictEqual(state.data?.games.map((game) => game.status), [
    "in_progress",
    "completed",
    "beaten",
    "mastered",
  ]);
  assert.equal(counts.config, 1);
  assert.equal(counts.completionProgress, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderCompletionProgressCacheKey(PROVIDER_ID));
  assert.equal(writes[0]?.version, CACHE_VERSION);
  assert.equal(writes[0]?.storedAt, state.lastUpdatedAt);
  assert.deepStrictEqual(writes[0]?.value, state.data);
});

test("decky recent achievements persist the last ten observed unlocks", async () => {
  await withMockDeckyStorage(async () => {
    const seededSnapshot = createDashboardSnapshotWithRecentAchievements(
      [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(createRecentUnlock),
    );

    const seededState = applyDeckyRecentAchievementHistory(seededSnapshot);
    assert.deepStrictEqual(
      seededState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-5", "ach-4", "ach-3", "ach-2", "ach-1"],
    );

    const emptyWindowState = applyDeckyRecentAchievementHistory(
      createDashboardSnapshotWithRecentAchievements([]),
    );
    assert.deepStrictEqual(
      emptyWindowState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-5", "ach-4", "ach-3", "ach-2", "ach-1"],
    );

    const rolledState = applyDeckyRecentAchievementHistory(
      createDashboardSnapshotWithRecentAchievements([11].map(createRecentUnlock)),
    );
    assert.deepStrictEqual(
      rolledState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-11", "ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-5", "ach-4", "ach-3", "ach-2"],
    );
  });
});

test("decky recent achievements rank newer live entries ahead of stale cached history", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSnapshot = createDashboardSnapshotWithRecentAchievements(
      [5, 4, 3, 2, 1].map(createRecentUnlock),
    );
    applyDeckyRecentAchievementHistory(cachedSnapshot);

    const rankedState = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot: createDashboardSnapshotWithRecentAchievements(
        [101, 100].map(createRecentUnlock),
      ),
    });

    assert.deepStrictEqual(
      rankedState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-101", "ach-100", "ach-5", "ach-4", "ach-3", "ach-2", "ach-1"],
    );
  });
});

test("decky recent achievements fill remaining slots with fallback entries up to ten", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSnapshot = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlockWithoutTimestamp(1),
      createRecentUnlockWithoutTimestamp(2),
      createRecentUnlockWithoutTimestamp(3),
    ]);
    applyDeckyRecentAchievementHistory(cachedSnapshot);

    const rankedState = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot: createDashboardSnapshotWithRecentAchievements(
        [10, 9, 8, 7, 6].map(createRecentUnlock),
      ),
    });

    assert.deepStrictEqual(
      rankedState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-10", "ach-9", "ach-8", "ach-7", "ach-6", "ach-1", "ach-2", "ach-3"],
    );
  });
});

test("decky recent achievements keep missing timestamps behind trusted ones", async () => {
  await withMockDeckyStorage(async () => {
    const cachedSnapshot = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlockWithoutTimestamp(1),
      createRecentUnlock(2),
    ]);
    applyDeckyRecentAchievementHistory(cachedSnapshot);

    const rankedState = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot: createDashboardSnapshotWithRecentAchievements([100].map(createRecentUnlock)),
    });

    assert.deepStrictEqual(
      rankedState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["ach-100", "ach-2", "ach-1"],
    );
  });
});

test("decky recent achievements backfill from completion progress without dates", async () => {
  await withMockDeckyStorage(async () => {
    let completionProgressCalls = 0;
    let gameProgressCalls = 0;

    const state = await buildDeckyRecentAchievementHistory({
      provider: {
        async loadCompletionProgress() {
          completionProgressCalls += 1;
          return createBackfillCompletionProgressWithoutDates();
        },
        async loadGameProgress(_config, gameId) {
          gameProgressCalls += 1;
          if (gameId === "game-a") {
            return createBackfillGameDetail("game-a", "Game A", [
              1_700_000_000_500,
              1_700_000_000_400,
              1_700_000_000_300,
            ]);
          }

          return createBackfillGameDetail("game-b", "Game B", [
            1_700_000_000_200,
            1_700_000_000_100,
          ]);
        },
      },
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.deepStrictEqual(
      state.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["game-a-ach-1", "game-a-ach-2", "game-a-ach-3", "game-b-ach-1", "game-b-ach-2"],
    );
    assert.equal(completionProgressCalls, 1);
    assert.equal(gameProgressCalls, 2);
  });
});

test("decky recent achievements discover missing games from recently played history", async () => {
  await withMockDeckyStorage(async () => {
    let completionProgressCalls = 0;
    let recentlyPlayedCalls = 0;
    let gameProgressCalls = 0;

    const state = await buildDeckyRecentAchievementHistory({
      provider: {
        async loadCompletionProgress() {
          completionProgressCalls += 1;
          return createBackfillCompletionProgressWithoutDates();
        },
        async loadRecentlyPlayedGames() {
          recentlyPlayedCalls += 1;
          return [
            createBackfillRecentlyPlayedGame(
              "game-dkc",
              "Donkey Kong Country",
              5,
              1_700_000_000_900,
            ),
            createBackfillRecentlyPlayedGame("game-b", "Game B", 2, 1_700_000_000_200),
          ];
        },
        async loadGameProgress(_config, gameId) {
          gameProgressCalls += 1;
          if (gameId === "game-dkc") {
            return createBackfillGameDetail("game-dkc", "Donkey Kong Country", [
              1_700_000_000_900,
              1_700_000_000_800,
              1_700_000_000_700,
              1_700_000_000_600,
              1_700_000_000_500,
            ]);
          }

          if (gameId === "game-a") {
            return createBackfillGameDetail("game-a", "Game A", [
              1_699_000_000_400,
              1_699_000_000_300,
              1_699_000_000_200,
            ]);
          }

          return createBackfillGameDetail("game-b", "Game B", [
            1_699_000_000_100,
            1_699_000_000_000,
          ]);
        },
      },
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.deepStrictEqual(
      state.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-dkc-ach-1",
        "game-dkc-ach-2",
        "game-dkc-ach-3",
        "game-dkc-ach-4",
        "game-dkc-ach-5",
        "game-a-ach-1",
        "game-a-ach-2",
        "game-a-ach-3",
        "game-b-ach-1",
        "game-b-ach-2",
      ],
    );
    assert.equal(completionProgressCalls, 1);
    assert.equal(recentlyPlayedCalls, 1);
    assert.equal(gameProgressCalls, 3);
  });
});

test("decky recent achievements prefer date-range history and stay stable across reopen", async () => {
  await withMockDeckyStorage(async () => {
    const dateRangeAchievements = [
      createRecentUnlockForGame("game-dkc", "Donkey Kong Country", 1, 1_900_000_000_900),
      createRecentUnlockForGame("game-dkc", "Donkey Kong Country", 2, 1_900_000_000_800),
      createRecentUnlockForGame("game-pokemon", "Pokémon Gold Version", 1, 1_900_000_000_700),
      createRecentUnlockForGame("game-pokemon", "Pokémon Gold Version", 2, 1_900_000_000_600),
      createRecentUnlockForGame("game-mario", "Super Mario World", 1, 1_900_000_000_500),
      createRecentUnlockForGame("game-mario", "Super Mario World", 2, 1_900_000_000_400),
    ];

    let completionProgressCalls = 0;
    let dateRangeCalls = 0;
    let gameProgressCalls = 0;

    const provider = {
      async loadCompletionProgress() {
        completionProgressCalls += 1;
        throw new Error("completion progress should not be needed when date-range history is sufficient");
      },
      async loadAchievementsEarnedBetween() {
        dateRangeCalls += 1;
        return dateRangeAchievements;
      },
      async loadGameProgress() {
        gameProgressCalls += 1;
        throw new Error("game progress should not be needed when date-range history is sufficient");
      },
    };
    const snapshotWithRecentAchievements = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlockWithoutTimestamp(1),
      createRecentUnlockWithoutTimestamp(2),
      createRecentUnlockWithoutTimestamp(3),
    ]);
    const snapshot = {
      ...snapshotWithRecentAchievements,
      profile: {
        ...snapshotWithRecentAchievements.profile,
        metrics: [
          {
            key: "member-since",
            label: "Member Since",
            value: "2020-01-02 00:00:00",
          },
        ],
      },
    };

    const firstState = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot,
    });

    const secondState = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot,
    });

    assert.deepStrictEqual(
      firstState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-dkc-ach-1",
        "game-dkc-ach-2",
        "game-pokemon-ach-1",
        "game-pokemon-ach-2",
        "game-mario-ach-1",
        "game-mario-ach-2",
        "ach-1",
        "ach-2",
        "ach-3",
      ],
    );
    assert.deepStrictEqual(
      secondState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-dkc-ach-1",
        "game-dkc-ach-2",
        "game-pokemon-ach-1",
        "game-pokemon-ach-2",
        "game-mario-ach-1",
        "game-mario-ach-2",
        "ach-1",
        "ach-2",
        "ach-3",
      ],
    );
    assert.equal(completionProgressCalls, 2);
    assert.equal(dateRangeCalls, 2);
    assert.equal(gameProgressCalls, 0);
  });
});

test("decky overview recent achievements stay separate from persistent recent achievements", async () => {
  await withMockDeckyStorage(async () => {
    const persistentSnapshot = createDashboardSnapshotWithRecentAchievements([
      createRecentUnlock(1),
      createRecentUnlock(2),
      createRecentUnlock(3),
      createRecentUnlock(4),
      createRecentUnlock(5),
    ]);
    const snapshot = {
      ...persistentSnapshot,
      recentUnlocks: [createRecentUnlock(90), createRecentUnlock(91)],
    };

    const state = await buildDeckyRecentAchievementHistory({
      provider: undefined,
      providerConfig: undefined,
      snapshot,
    });

    assert.equal(state.recentAchievements.length, 5);
  });
});

test("decky recent achievements continue when one backfill game fails", async () => {
  await withMockDeckyStorage(async () => {
    const state = await buildDeckyRecentAchievementHistory({
      provider: {
        async loadCompletionProgress() {
          return createBackfillCompletionProgressWithoutDates();
        },
        async loadGameProgress(_config, gameId) {
          if (gameId === "game-a") {
            throw new Error("temporary backfill failure");
          }

          return createBackfillGameDetail("game-b", "Game B", [
            1_700_000_000_200,
            1_700_000_000_100,
          ]);
        },
      },
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.deepStrictEqual(
      state.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      ["game-b-ach-1", "game-b-ach-2"],
    );
  });
});

test("decky recent achievements can be backfilled from completion progress", async () => {
  await withMockDeckyStorage(async () => {
    const provider = {
      async loadCompletionProgress() {
        return createBackfillCompletionProgress();
      },
      async loadGameProgress(_config: unknown, gameId: string) {
        if (gameId === "game-a") {
          return createBackfillGameDetail("game-a", "Game A", [
            1_700_000_000_500,
            1_700_000_000_400,
            1_700_000_000_300,
          ]);
        }

        return createBackfillGameDetail("game-b", "Game B", [
          1_700_000_000_250,
          1_700_000_000_200,
          1_700_000_000_150,
        ]);
      },
    };

    const backfilledState = await buildDeckyRecentAchievementHistory({
      provider,
      providerConfig: {
        username: "alice",
        apiKey: "secret",
      },
      snapshot: createDashboardSnapshotWithRecentAchievements([]),
    });

    assert.equal(backfilledState.recentAchievements.length, 6);
    assert.deepStrictEqual(
      backfilledState.recentAchievements.map((recentUnlock) => recentUnlock.achievement.achievementId),
      [
        "game-a-ach-1",
        "game-a-ach-2",
        "game-a-ach-3",
        "game-b-ach-1",
        "game-b-ach-2",
        "game-b-ach-3",
      ],
    );
  });
});

test("retroachievements recently played games normalize badge art urls and progress", () => {
  const rawRecentlyPlayedGames: readonly RawRetroAchievementsRecentlyPlayedGameResponse[] = [
    {
      GameID: 1234,
      Title: "Test Game",
      ConsoleName: "NES",
      ImageIcon: "/Images/000001.png",
      LastPlayed: "2024-01-01 00:00:00",
      AchievementsTotal: 20,
      NumAchieved: 5,
    },
  ];

  const recentlyPlayedGames = normalizeRetroAchievementsRecentlyPlayedGames(rawRecentlyPlayedGames);

  assert.equal(recentlyPlayedGames[0]?.coverImageUrl, "https://i.retroachievements.org/Images/000001.png");
  assert.equal(recentlyPlayedGames[0]?.summary.unlockedCount, 5);
  assert.equal(recentlyPlayedGames[0]?.summary.totalCount, 20);
  assert.equal(recentlyPlayedGames[0]?.summary.completionPercent, 25);
  assert.equal(recentlyPlayedGames[0]?.lastPlayedAt, Date.parse("2024-01-01 00:00:00"));
});

test("game detail parses the documented RetroAchievements game-progress shape", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) =>
      createRetroAchievementsProvider({
        client: createRetroAchievementsGameDetailClient(DOCUMENTED_GAME_PROGRESS_RESPONSE, callCounts),
      }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "14402", {
    forceRefresh: true,
  });

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.equal(state.data?.game.gameId, "14402");
  assert.equal(state.data?.game.title, "Dragster");
  assert.equal(state.data?.game.summary.unlockedCount, 1);
  assert.equal(state.data?.game.summary.totalCount, 2);
  assert.equal(state.data?.game.summary.completionPercent, 50);
  assert.equal(state.data?.achievements.length, 2);
  assert.equal(state.data?.achievements[0]?.title, "Novice Dragster Driver 1");
  assert.equal(state.data?.achievements[0]?.isUnlocked, true);
  assert.equal(state.data?.achievements[1]?.title, "Another Test Achievement");
  assert.equal(state.data?.achievements[1]?.isUnlocked, false);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
});

test("game detail surfaces an error when the documented shape is unusable", async () => {
  const { appServices, counts } = createHarness({
    providerFactory: (callCounts) =>
      createRetroAchievementsProvider({
        client: createRetroAchievementsGameDetailClient(
          {} as RawRetroAchievementsGameProgressResponse,
          callCounts,
        ),
      }),
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "14402", {
    forceRefresh: true,
  });

  assert.equal(state.status, "error");
  assert.equal(state.error?.kind, "parse");
  assert.match(state.error?.userMessage ?? "", /unexpected response/i);
  assert.equal(state.data, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
});

test("game detail cache hit returns cached state without calling refresh path", async () => {
  const now = Date.now();
  const cachedSnapshot = createGameDetailSnapshot();
  const cacheKey = createProviderGameDetailCacheKey(PROVIDER_ID, cachedSnapshot.game.gameId);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 1_000, now + 60_000),
    ],
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, cachedSnapshot.game.gameId);

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(counts.config, 0);
  assert.equal(counts.gameProgress, 0);
});

test("game detail missing config returns auth error state", async () => {
  const { appServices, counts } = createHarness({
    providerConfig: undefined,
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "game-1");

  assert.equal(state.status, "error");
  assert.equal(state.error?.kind, "auth");
  assert.match(state.error?.userMessage ?? "", /provider settings are missing/i);
  assert.equal(state.isStale, false);
  assert.equal(state.data, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 0);
});

test("game detail stale cached data is preserved when refresh fails", async () => {
  const now = Date.now();
  const cachedSnapshot = createGameDetailSnapshot();
  const cacheKey = createProviderGameDetailCacheKey(PROVIDER_ID, cachedSnapshot.game.gameId);
  const { appServices, counts } = createHarness({
    cacheEntries: [
      createCacheEntry(cacheKey, cachedSnapshot, now - 60_000, now - 1),
    ],
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, cachedSnapshot.game.gameId, {
    forceRefresh: true,
  });

  assert.equal(state.status, "stale");
  assert.equal(state.isStale, true);
  assert.deepStrictEqual(state.data, cachedSnapshot);
  assert.equal(state.error?.kind, "unknown");
  assert.match(state.error?.userMessage ?? "", /refresh game detail data/i);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
});

test("game detail successful refresh writes normalized snapshot to cache", async () => {
  const { appServices, counts, writes } = createHarness({
    providerFactory: createSuccessfulProvider,
    providerConfig: {
      username: "alice",
      apiKey: "secret",
    },
  });

  const state = await appServices.gameDetail.loadGameDetail(PROVIDER_ID, "game-1");
  const expectedSnapshot = createGameDetailSnapshot();

  assert.equal(state.status, "success");
  assert.equal(state.isStale, false);
  assert.equal(state.error, undefined);
  assert.equal(counts.config, 1);
  assert.equal(counts.gameProgress, 1);
  assert.deepStrictEqual(state.data, expectedSnapshot);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.key, createProviderGameDetailCacheKey(PROVIDER_ID, "game-1"));
  assert.equal(writes[0]?.version, CACHE_VERSION);
  assert.equal(writes[0]?.storedAt, state.lastUpdatedAt);
  assert.deepStrictEqual(writes[0]?.value, state.data);
});
