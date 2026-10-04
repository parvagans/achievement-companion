import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ResourceState } from "../src/core/cache";
import type { GameDetailSnapshot, ProviderId } from "../src/core/domain";
import {
  buildRetroAchievementsCompactAchievementDetailModel,
  buildRetroAchievementsCompactAchievementListModel,
  buildSteamCompactAchievementDetailModel,
  buildSteamCompactAchievementListModel,
  getCompactAchievementFilterCounts,
  matchesCompactAchievementFilter,
} from "../src/platform/decky/decky-compact-achievement-model";
import {
  readDeckyCompactAchievementPageState,
  resetDeckyCompactAchievementPageState,
  writeDeckyCompactAchievementPageState,
} from "../src/platform/decky/decky-compact-achievement-page-state";
import {
  resolveDeckyCompactAchievementResource,
  type CompactAchievementResourceDependencies,
} from "../src/platform/decky/decky-compact-achievement-resource";
import {
  readDeckyCompactNavigation,
  resetDeckyCompactNavigationForTests,
  setDeckyCompactNavigation,
  getDeckyCompactParentDestination,
  returnFromDeckyCompactDestination,
} from "../src/platform/decky/decky-compact-navigation";
import { composeSteamGameDetailWithSteamHunters } from "../src/providers/steamhunters/compose-steam-game-detail";
import type { SteamHuntersGameData } from "../src/providers/steamhunters/types";

const UNLOCKED_AT = Date.UTC(2025, 10, 7, 17, 21);

function createSnapshot(providerId: ProviderId): GameDetailSnapshot {
  return {
    game: {
      providerId,
      ...(providerId === "steam" ? { appid: 2321470 } : {}),
      gameId: providerId === "steam" ? "2321470" : "100",
      title: providerId === "steam" ? "Deep Rock Galactic: Survivor" : "RA Game",
      platformLabel: providerId === "steam" ? "Steam" : "SNES",
      coverImageUrl: "https://example.invalid/game.jpg",
      status: "in_progress",
      summary: { unlockedCount: 1, totalCount: 2, completionPercent: 50 },
      metrics: providerId === "retroachievements"
        ? [{ key: "total-players", label: "Total Players", value: "5253" }]
        : [],
    },
    achievements: [
      {
        providerId,
        achievementId: "ACH_UNLOCKED",
        gameId: providerId === "steam" ? "2321470" : "100",
        title: "Still only counts as one!",
        description: "Kill the Dreadnought without taking any damage.",
        badgeImageUrl: "https://example.invalid/unlocked.png",
        isUnlocked: true,
        unlockedAt: UNLOCKED_AT,
        ...(providerId === "retroachievements"
          ? { unlockMode: "hardcore" as const, points: 24, classification: "missable" as const }
          : {}),
        metrics: providerId === "retroachievements"
          ? [
              { key: "true-ratio", label: "True Ratio", value: "32" },
              { key: "unlocked-count", label: "Total Players", value: "1082" },
              { key: "hardcore-unlocked-count", label: "Hardcore Unlocks", value: "688" },
            ]
          : [],
      },
      {
        providerId,
        achievementId: "ACH_LOCKED",
        gameId: providerId === "steam" ? "2321470" : "100",
        title: "Locked achievement",
        description: "This one is still locked.",
        isUnlocked: false,
        metrics: [],
      },
    ],
    achievementStateIsComplete: true,
    refreshedAt: UNLOCKED_AT,
  };
}

const steamHuntersGameData: SteamHuntersGameData = {
  app: { appId: 2321470, tags: [] },
  achievements: [
    {
      apiName: "ACH_UNLOCKED",
      points: 24,
      localPercentage: 35.3,
      obtainability: "obtainable",
    },
  ],
  groups: [],
};

function successState(snapshot: GameDetailSnapshot): ResourceState<GameDetailSnapshot> {
  return {
    status: "success",
    data: snapshot,
    isStale: false,
    isRefreshing: false,
  };
}

function errorState(): ResourceState<GameDetailSnapshot> {
  return {
    status: "error",
    error: { kind: "unknown", userMessage: "Unavailable", retryable: true },
    isStale: false,
    isRefreshing: false,
  };
}

test("Steam and RA adapters normalize shared rows without leaking provider metadata", () => {
  const steamSnapshot = composeSteamGameDetailWithSteamHunters(
    createSnapshot("steam"),
    steamHuntersGameData,
  );
  const steamModel = buildSteamCompactAchievementListModel(steamSnapshot);
  const steamUnlocked = steamModel.rows.find((row) => row.achievementId === "ACH_UNLOCKED");
  const steamLocked = steamModel.rows.find((row) => row.achievementId === "ACH_LOCKED");
  assert.ok(steamUnlocked !== undefined && steamLocked !== undefined);
  assert.equal(steamModel.supportsModeFilter, false);
  assert.equal(steamUnlocked.stateIndicator, "unlocked");
  assert.match(steamUnlocked.timestampText ?? "", /^Unlocked /u);
  assert.deepStrictEqual(steamUnlocked.metadata.map((item) => item.value), ["24 pts", "35.3%"]);
  assert.equal(steamLocked.stateIndicator, "locked");
  assert.equal(steamLocked.timestampText, undefined);

  const raModel = buildRetroAchievementsCompactAchievementListModel(createSnapshot("retroachievements"));
  const raUnlocked = raModel.rows.find((row) => row.achievementId === "ACH_UNLOCKED");
  assert.ok(raUnlocked !== undefined);
  assert.equal(raModel.supportsModeFilter, true);
  assert.equal(raModel.initialVisibleCount, 3);
  assert.equal(raUnlocked.stateIndicator, undefined);
  assert.equal(raUnlocked.metadataPlacement, "stack");
  assert.ok(raUnlocked.metadata.some((item) => item.value.includes("24")));
  assert.ok(raUnlocked.metadata.every((item) => !item.key.includes("community")));
});

test("compact achievement filters derive counts and filter locally", () => {
  const rows = buildSteamCompactAchievementListModel(createSnapshot("steam")).rows;
  assert.deepStrictEqual(getCompactAchievementFilterCounts(rows), { all: 2, unlocked: 1, locked: 1 });
  assert.deepStrictEqual(rows.filter((row) => matchesCompactAchievementFilter(row, "all")).length, 2);
  assert.deepStrictEqual(rows.filter((row) => matchesCompactAchievementFilter(row, "unlocked")).length, 1);
  assert.deepStrictEqual(rows.filter((row) => matchesCompactAchievementFilter(row, "locked")).length, 1);
});

test("Steam detail exposes verified SteamHunters fields and omits unsupported sections", () => {
  const snapshot = composeSteamGameDetailWithSteamHunters(createSnapshot("steam"), steamHuntersGameData);
  const detail = buildSteamCompactAchievementDetailModel(snapshot, "ACH_UNLOCKED");
  assert.ok(detail !== undefined);
  assert.equal(detail.description, "Kill the Dreadnought without taking any damage.");
  assert.equal(detail.game.providerId, "steam");
  assert.equal(detail.game.gameId, "2321470");
  assert.equal(detail.showLegacyActions, false);
  const steamHuntersBlock = detail.blocks.find(
    (block) => block.kind === "stats" && block.title === "SteamHunters",
  );
  assert.ok(steamHuntersBlock?.kind === "stats");
  assert.deepStrictEqual(
    steamHuntersBlock.stats.map((stat) => [stat.label, stat.value]),
    [["Points", "24"], ["Community", "35.3%"], ["Obtainability", "Obtainable"]],
  );

  const source = readFileSync("src/platform/decky/decky-achievement-detail-view.tsx", "utf8");
  const listSource = readFileSync("src/platform/decky/decky-compact-achievement-list.tsx", "utf8");
  assert.equal((source.match(/<p style=\{getDescriptionStyle\(\)\}>/gu) ?? []).length, 1);
  assert.doesNotMatch(source, /View on Steam|View on SteamHunters|No tips available|Tips \(SteamHunters\)|title="Links"/u);
  assert.doesNotMatch(listSource, /Search achievements|type="search"|searchQuery/u);
  assert.equal((listSource.match(/role="img"/gu) ?? []).length, 1);
});

test("RA detail retains points, RetroPoints, rarity, counts, and legacy actions", () => {
  const detail = buildRetroAchievementsCompactAchievementDetailModel(
    createSnapshot("retroachievements"),
    "ACH_UNLOCKED",
  );
  assert.ok(detail !== undefined);
  assert.equal(detail.showLegacyActions, true);
  assert.equal(detail.gamePlacement, "before-achievement");
  assert.equal(detail.classification, "missable");
  const labels = detail.blocks.flatMap((block) =>
    block.kind === "stats" || block.kind === "rarity" ? block.stats.map((stat) => stat.label) : []);
  assert.ok(labels.includes("Points"));
  assert.ok(labels.includes("RetroPoints"));
  assert.ok(labels.includes("Softcore unlocks"));
  assert.ok(labels.includes("Hardcore unlocks"));
  assert.ok(labels.includes("Total players"));
  assert.ok(detail.blocks.some((block) => block.kind === "rarity"));
});

test("Steam compact resolver waits for SteamHunters terminal success before resolving", async () => {
  let releaseSteamHunters: ((value: SteamHuntersGameData | undefined) => void) | undefined;
  const steamHuntersPending = new Promise<SteamHuntersGameData | undefined>((resolve) => {
    releaseSteamHunters = resolve;
  });
  const options: boolean[] = [];
  const dependencies: CompactAchievementResourceDependencies = {
    loadGameDetail: async (_providerId, _gameId, request) => {
      options.push(request.forceRefresh);
      return successState(createSnapshot("steam"));
    },
    loadSteamHuntersGameData: async () => steamHuntersPending,
  };
  let settled = false;
  const resolution = resolveDeckyCompactAchievementResource("steam", "2321470", dependencies)
    .then((state) => {
      settled = true;
      return state;
    });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  releaseSteamHunters?.(steamHuntersGameData);
  const state = await resolution;
  assert.equal(state.status, "success");
  assert.deepStrictEqual(options, [false]);
  assert.equal(
    buildSteamCompactAchievementListModel(state.data as GameDetailSnapshot).rows[0]?.metadata.length,
    2,
  );
});

test("Steam compact resolver treats SteamHunters failure or unavailability as terminal", async () => {
  for (const loadSteamHuntersGameData of [
    async () => undefined,
    async () => Promise.reject(new Error("SteamHunters unavailable")),
  ]) {
    const state = await resolveDeckyCompactAchievementResource("steam", "2321470", {
      loadGameDetail: async () => successState(createSnapshot("steam")),
      loadSteamHuntersGameData,
    });
    assert.equal(state.status, "success");
    assert.deepStrictEqual(
      buildSteamCompactAchievementListModel(state.data as GameDetailSnapshot).rows[0]?.metadata,
      [],
    );
  }
});

test("Steam compact resolver returns terminal Steam failure after both sources settle", async () => {
  for (const loadSteamHuntersGameData of [
    async () => steamHuntersGameData,
    async () => Promise.reject(new Error("SteamHunters unavailable")),
  ]) {
    const state = await resolveDeckyCompactAchievementResource("steam", "2321470", {
      loadGameDetail: async () => errorState(),
      loadSteamHuntersGameData,
    });
    assert.equal(state.status, "error");
    assert.equal(state.data, undefined);
  }

  const nonTerminalWithoutData = await resolveDeckyCompactAchievementResource("steam", "2321470", {
    loadGameDetail: async () => ({
      status: "loading",
      isStale: false,
      isRefreshing: false,
    }),
    loadSteamHuntersGameData: async () => steamHuntersGameData,
  });
  assert.equal(nonTerminalWithoutData.status, "error");
});

test("compact resolver uses valid cached state and refreshes stale state without changing TTL policy", async () => {
  const validCalls: boolean[] = [];
  await resolveDeckyCompactAchievementResource("steam", "2321470", {
    loadGameDetail: async (_providerId, _gameId, options) => {
      validCalls.push(options.forceRefresh);
      return successState(createSnapshot("steam"));
    },
    loadSteamHuntersGameData: async () => undefined,
  });
  assert.deepStrictEqual(validCalls, [false]);

  const staleCalls: boolean[] = [];
  await resolveDeckyCompactAchievementResource("steam", "2321470", {
    loadGameDetail: async (_providerId, _gameId, options) => {
      staleCalls.push(options.forceRefresh);
      return options.forceRefresh
        ? successState(createSnapshot("steam"))
        : { ...successState(createSnapshot("steam")), status: "stale", isStale: true };
    },
    loadSteamHuntersGameData: async () => undefined,
  });
  assert.deepStrictEqual(staleCalls, [false, true]);
});

test("achievement-list destination and page state preserve deterministic return context", () => {
  resetDeckyCompactNavigationForTests();
  resetDeckyCompactAchievementPageState();
  setDeckyCompactNavigation({
    kind: "achievement-list",
    providerId: "steam",
    gameId: "2321470",
    gameTitle: "Deep Rock Galactic: Survivor",
    parent: "game",
  });
  assert.deepStrictEqual(readDeckyCompactNavigation(), {
    kind: "achievement-list",
    providerId: "steam",
    gameId: "2321470",
    gameTitle: "Deep Rock Galactic: Survivor",
    parent: "game",
  });
  writeDeckyCompactAchievementPageState("steam", "2321470", {
    filter: "locked",
    modeFilter: "all",
    visibleCount: 52,
    focusedAchievementId: "ACH_47",
    scrollTop: 734,
  });
  assert.deepStrictEqual(readDeckyCompactAchievementPageState("steam", "2321470", 12), {
    filter: "locked",
    modeFilter: "all",
    visibleCount: 52,
    focusedAchievementId: "ACH_47",
    scrollTop: 734,
  });

  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  const compactNavigationSource = readFileSync("src/platform/decky/decky-compact-navigation.ts", "utf8");
  assert.match(bootstrapSource, /returnFromDeckyCompactDestination\(compactNavigation\)/u);
  assert.match(compactNavigationSource, /if \(compactNavigation !== destination\)[\s\S]*getDeckyCompactParentDestination\(destination\)/u);
  assert.match(bootstrapSource, /parent: "achievement-list"/u);
  assert.match(bootstrapSource, /onOpenCompactGame=\{\(\) => \{[\s\S]*kind: "game"/u);
  assert.match(bootstrapSource, /parent: "provider-dashboard"/u);

  const destination = readDeckyCompactNavigation();
  assert.equal(destination.kind, "achievement-list");
  if (destination.kind === "achievement-list") {
    assert.deepStrictEqual(getDeckyCompactParentDestination(destination), {
      kind: "game",
      providerId: "steam",
      gameId: "2321470",
      gameTitle: "Deep Rock Galactic: Survivor",
    });
    returnFromDeckyCompactDestination(destination);
    assert.deepStrictEqual(readDeckyCompactNavigation(), getDeckyCompactParentDestination(destination));
    returnFromDeckyCompactDestination(destination);
    assert.deepStrictEqual(readDeckyCompactNavigation(), getDeckyCompactParentDestination(destination));
  }
});

test("View Achievements checkpoints remain scoped to the selected game", () => {
  resetDeckyCompactAchievementPageState();
  writeDeckyCompactAchievementPageState("steam", "game-a", {
    filter: "locked",
    modeFilter: "all",
    visibleCount: 40,
    focusedAchievementId: "achievement-a",
    scrollTop: 612,
  });
  writeDeckyCompactAchievementPageState("steam", "game-b", {
    filter: "unlocked",
    modeFilter: "all",
    visibleCount: 12,
    focusedAchievementId: "achievement-b",
    scrollTop: 88,
  });

  assert.deepEqual(readDeckyCompactAchievementPageState("steam", "game-a", 12), {
    filter: "locked",
    modeFilter: "all",
    visibleCount: 40,
    focusedAchievementId: "achievement-a",
    scrollTop: 612,
  });
  assert.deepEqual(readDeckyCompactAchievementPageState("steam", "game-b", 12), {
    filter: "unlocked",
    modeFilter: "all",
    visibleCount: 12,
    focusedAchievementId: "achievement-b",
    scrollTop: 88,
  });

  const listSource = readFileSync("src/platform/decky/decky-compact-achievement-list.tsx", "utf8");
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  assert.match(listSource, /data-achievement-companion-compact-achievement-id=\{model\.achievementId\}/u);
  assert.match(listSource, /restoreAchievementIdRef = useRef\(pageState\.focusedAchievementId\)/u);
  assert.match(listSource, /element\?\.ownerDocument\?\.defaultView\?\.HTMLElement/u);
  assert.match(listSource, /model\.providerId === "steam"\s*\? readSteamScrollTop/u);
  assert.match(
    listSource,
    /onOpen=\{\(target\) => \{[\s\S]*focusedAchievementId: row\.achievementId,[\s\S]*scrollTop: model\.providerId === "steam"[\s\S]*readSteamScrollTop\(target, current\.scrollTop\)/u,
  );
  assert.match(listSource, /requestDeckySteamGamepadFocusAfterMount\(target\)/u);
  assert.match(listSource, /!focusRestorationReady \|\| embedded/u);
  assert.match(listSource, /\(embedded \|\| model\.providerId !== "steam"\) &&/u);
  assert.match(listSource, /\}, \[embedded, focusRestorationReady, model\.gameId, model\.providerId\]\);/u);
  assert.match(bootstrapSource, /onRestoreAfterLayoutComplete=\{handleScrollRestoreComplete\}/u);
  assert.match(bootstrapSource, /focusRestorationReady=\{focusRestorationReady\}/u);
  assert.match(bootstrapSource, /restoreAfterLayout=\{destination\.providerId === STEAM_PROVIDER_ID\}/u);
});

test("loading completion is render-owned and stale hook completion is ignored after unmount", () => {
  const resolverSource = readFileSync("src/platform/decky/decky-compact-achievement-resource.ts", "utf8");
  const asyncHookSource = readFileSync("src/platform/decky/useAsyncResourceState.ts", "utf8");
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  assert.doesNotMatch(resolverSource, /setDeckyCompactNavigation|window\.history|location\.|hash/u);
  assert.match(asyncHookSource, /let cancelled = false/u);
  assert.match(asyncHookSource, /if \(!cancelled\)/u);
  assert.match(asyncHookSource, /cancelled = true/u);
  assert.match(bootstrapSource, /<DeckyCompactLoadingState[\s\S]*onCancel=\{onBack\}/u);
});
