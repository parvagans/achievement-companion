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
  getCompactAchievementLoadActions,
  matchesCompactAchievementFilter,
  matchesCompactAchievementModeFilter,
} from "../src/platform/decky/decky-compact-achievement-model";
import {
  readDeckyCompactAchievementPageState,
  resetDeckyCompactAchievementPageState,
  writeDeckyCompactAchievementPageState,
} from "../src/platform/decky/decky-compact-achievement-page-state";
import { buildRetroAchievementsCompactGamePresentation } from "../src/platform/decky/decky-retroachievements-compact-game-model";
import { getRaFocusStylesCss, raRecipes, raTheme } from "../src/platform/decky/ra-theme";
import { steamTheme } from "../src/platform/decky/steam-theme";
import { achievementCompanionAchievementRowRecipes } from "../src/platform/decky/decky-qam-theme";
import { getSteamAchievementCommunityPercent } from "../src/platform/decky/decky-achievement-row-presentation";
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
const compactAchievementListSource = readFileSync(
  "src/platform/decky/decky-compact-achievement-list.tsx",
  "utf8",
);
const fullScreenAchievementRowSource = readFileSync(
  "src/platform/decky/decky-full-screen-achievement-row.tsx",
  "utf8",
);

test("Steam and RA QAM game titles center within their game pages", () => {
  const steamGameSource = readFileSync("src/platform/decky/decky-steam-compact-game-overview.tsx", "utf8");
  assert.match(steamGameSource, /function getTitleStyle[\s\S]*?textAlign: "center"/u);
  assert.equal(raRecipes.compactGame.title.textAlign, "center");
});

test("Steam compact and full-screen achievement rows share the same locked status icon", () => {
  assert.match(compactAchievementListSource, /DeckySteamAchievementStatusIcon isUnlocked=\{false\} size=\{18\}/u);
  assert.match(fullScreenAchievementRowSource, /DeckySteamAchievementStatusIcon isUnlocked=\{isUnlocked\}/u);
  assert.doesNotMatch(compactAchievementListSource, /prohibited\.svg/u);
});

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
  assert.equal(raModel.initialVisibleCount, steamModel.initialVisibleCount);
  assert.equal(raUnlocked.stateIndicator, "unlocked");
  assert.equal(raUnlocked.metadataPlacement, "rail");
  assert.equal(raUnlocked.description, "Kill the Dreadnought without taking any damage.");
  assert.deepEqual(raUnlocked.metadata.map((item) => item.key), ["points", "rarity"]);
  assert.equal(raModel.rows.find((row) => row.achievementId === "ACH_LOCKED")?.stateIndicator, "locked");
  assert.equal(achievementCompanionAchievementRowRecipes.rarity.fill(39).width, "39%");
  assert.equal(achievementCompanionAchievementRowRecipes.rarity.fill(150).width, "100%");
  assert.equal(achievementCompanionAchievementRowRecipes.rarity.track("compact").height, 3);
});

test("Steam achievement rows use verified community rates and Steam-green earned rails", () => {
  const achievement = createSnapshot("steam").achievements[0]!;
  assert.equal(getSteamAchievementCommunityPercent(achievement, steamHuntersGameData.achievements[0]), 35.3);
  assert.equal(getSteamAchievementCommunityPercent({ metrics: [{ key: "global-percent", label: "Global Unlock Rate", value: "17.8" }] }, undefined), 17.8);
  assert.equal(getSteamAchievementCommunityPercent({ metrics: [] }, undefined), undefined);
  assert.equal(
    achievementCompanionAchievementRowRecipes.surface("compact", steamTheme.color.unlocked).borderLeft,
    `3px solid ${steamTheme.color.unlocked}`,
  );
  assert.notEqual(steamTheme.color.unlocked, steamTheme.color.rewardGold);
  assert.match(compactAchievementListSource, /item\.key === "rarity" \|\| item\.key === "community-percentage"/u);
  assert.match(compactAchievementListSource, /<DeckySteamHuntersIcon color=\{steamTheme\.color\.accent\} size=\{12\}/u);
});

test("QAM achievement badges use the shared Recently Played artwork size", () => {
  const source = readFileSync("src/platform/decky/decky-compact-achievement-list.tsx", "utf8");
  assert.match(source, /size=\{raTheme\.density\.compact\.artwork\}/u);
  assert.match(source, /gridTemplateColumns: "40px minmax\(0, 1fr\) minmax\(42px, auto\)"[\s\S]*alignItems: "center"[\s\S]*gap: 10/u);
  assert.match(source, /function getIconFrameStyle[\s\S]*alignItems: "center"[\s\S]*alignSelf: "center"[\s\S]*height: 40/u);
  assert.equal(raTheme.density.compact.artwork, 40);
});

test("compact achievement filters derive counts and filter locally", () => {
  const rows = buildSteamCompactAchievementListModel(createSnapshot("steam")).rows;
  assert.deepStrictEqual(getCompactAchievementFilterCounts(rows), { all: 2, unlocked: 1, locked: 1 });
  assert.deepStrictEqual(rows.filter((row) => matchesCompactAchievementFilter(row, "all")).length, 2);
  assert.deepStrictEqual(rows.filter((row) => matchesCompactAchievementFilter(row, "unlocked")).length, 1);
  assert.deepStrictEqual(rows.filter((row) => matchesCompactAchievementFilter(row, "locked")).length, 1);
  assert.deepEqual(getCompactAchievementLoadActions(12, 17), { showFiveMore: true, showAll: true });
  assert.deepEqual(getCompactAchievementLoadActions(17, 17), { showFiveMore: false, showAll: false });
});

test("Steam detail exposes verified SteamHunters fields and omits unsupported sections", () => {
  const snapshot = composeSteamGameDetailWithSteamHunters(createSnapshot("steam"), steamHuntersGameData);
  const detail = buildSteamCompactAchievementDetailModel(snapshot, "ACH_UNLOCKED");
  assert.ok(detail !== undefined);
  assert.equal(detail.description, "Kill the Dreadnought without taking any damage.");
  assert.equal(detail.game.providerId, "steam");
  assert.equal(detail.game.gameId, "2321470");
  assert.equal(detail.showLegacyActions, false);
  assert.deepStrictEqual(detail.badges, []);
  const steamHuntersBlock = detail.blocks.find(
    (block) => block.kind === "stats" && block.title === "SteamHunters",
  );
  assert.ok(steamHuntersBlock?.kind === "stats");
  assert.deepStrictEqual(
    steamHuntersBlock.stats.map((stat) => [stat.label, stat.value]),
    [["Points", "24"], ["Community", "35.3%"], ["Players Unlocked", "—"]],
  );

  const source = readFileSync("src/platform/decky/decky-achievement-detail-view.tsx", "utf8");
  const listSource = readFileSync("src/platform/decky/decky-compact-achievement-list.tsx", "utf8");
  assert.equal((source.match(/<p style=\{getDescriptionStyle\(isSteam\)\}>/gu) ?? []).length, 1);
  assert.doesNotMatch(source, /View on Steam|View on SteamHunters|No tips available|Tips \(SteamHunters\)|title="Links"/u);
  assert.doesNotMatch(listSource, /Search achievements|type="search"|searchQuery/u);
  assert.equal((listSource.match(/role="img"/gu) ?? []).length, 1);
});

test("RA detail keeps verified RA data in the Steam compact hierarchy", () => {
  const detail = buildRetroAchievementsCompactAchievementDetailModel(
    createSnapshot("retroachievements"),
    "ACH_UNLOCKED",
  );
  assert.ok(detail !== undefined);
  assert.equal(detail.showLegacyActions, false);
  assert.equal(detail.gamePlacement, "after-details");
  assert.equal(detail.classification, "missable");
  const labels = detail.blocks.flatMap((block) =>
    block.kind === "stats" || block.kind === "rarity" ? block.stats.map((stat) => stat.label) : []);
  assert.ok(labels.includes("Points"));
  assert.ok(labels.includes("RetroPoints"));
  assert.ok(labels.includes("Softcore Unlocks"));
  assert.ok(labels.includes("Hardcore Unlocks"));
  assert.ok(labels.includes("Players Unlocked"));
  assert.ok(labels.includes("Community"));
  assert.equal(detail.blocks[0]?.kind, "timestamp");
  assert.equal(detail.blocks[1]?.kind, "stats");
});

test("RA community split stays independent of mode preference and lone mode tiles fill the row", () => {
  const snapshot = createSnapshot("retroachievements");
  const expectedHardcore = 688 / 5253 * 100;
  const expectedSoftcore = (1082 - 688) / 5253 * 100;
  for (const preference of ["both", "hardcore", "softcore"] as const) {
    const detail = buildRetroAchievementsCompactAchievementDetailModel(snapshot, "ACH_UNLOCKED", preference);
    const block = detail?.blocks.find((item) => item.kind === "stats");
    assert.ok(block?.kind === "stats");
    const community = block.stats.find((item) => item.key === "rarity");
    assert.equal(community?.fullWidth, true);
    assert.equal(community?.value, "20.60%");
    assert.ok(community?.communityProgress !== undefined);
    assert.ok(Math.abs(community.communityProgress.hardcorePercent - expectedHardcore) < 0.001);
    assert.ok(Math.abs(community.communityProgress.softcorePercent - expectedSoftcore) < 0.001);
    const modes = block.stats.filter((item) => item.key.endsWith("-unlocks"));
    assert.deepEqual(modes.map((item) => [item.key, item.fullWidth]), preference === "both"
      ? [["hardcore-unlocks", false], ["softcore-unlocks", false]]
      : [[`${preference}-unlocks`, true]]);
  }
  assert.equal(raRecipes.compactAchievementCommunity.segment("hardcore", 10).background, raTheme.color.hardcore);
  assert.equal(raRecipes.compactAchievementCommunity.segment("softcore", 10).background, raTheme.color.softcore);
});

test("RA mode preference reclassifies unlocks without removing locked achievements", () => {
  const base = createSnapshot("retroachievements");
  const snapshot = {
    ...base,
    achievements: base.achievements.map((achievement, index) => index === 0 ? {
      ...achievement,
      hardcoreUnlockedAt: UNLOCKED_AT,
      softcoreUnlockedAt: UNLOCKED_AT - 86_400_000,
    } : achievement),
  };
  const both = buildRetroAchievementsCompactAchievementListModel(snapshot, "both");
  const hardcore = buildRetroAchievementsCompactAchievementListModel(snapshot, "hardcore");
  const softcore = buildRetroAchievementsCompactAchievementListModel(snapshot, "softcore");
  assert.equal(both.supportsModeFilter, true);
  assert.equal(hardcore.supportsModeFilter, false);
  assert.equal(softcore.supportsModeFilter, false);
  assert.deepEqual([both.rows.length, hardcore.rows.length, softcore.rows.length], [2, 2, 2]);
  assert.equal(hardcore.rows.find((row) => row.achievementId === "ACH_UNLOCKED")?.tone, "hardcore");
  assert.equal(softcore.rows.find((row) => row.achievementId === "ACH_UNLOCKED")?.tone, "softcore");
  assert.equal(softcore.rows.find((row) => row.achievementId === "ACH_LOCKED")?.isUnlocked, false);
  assert.deepEqual(getCompactAchievementFilterCounts(softcore.rows), { all: 2, unlocked: 1, locked: 1 });
  assert.equal(softcore.rows.filter((row) => matchesCompactAchievementFilter(row, "locked")).length, 1);
  assert.equal(both.rows.filter((row) => matchesCompactAchievementModeFilter(row, "softcore")).length, 1);

  const gameHardcore = buildRetroAchievementsCompactGamePresentation(snapshot, "hardcore");
  const gameSoftcore = buildRetroAchievementsCompactGamePresentation(snapshot, "softcore");
  const gameBoth = buildRetroAchievementsCompactGamePresentation(snapshot, "both");
  assert.deepEqual(gameHardcore.modes.map((item) => item.mode), ["hardcore"]);
  assert.deepEqual(gameSoftcore.modes.map((item) => item.mode), ["softcore"]);
  assert.deepEqual(gameBoth.modes.map((item) => item.mode), ["hardcore", "softcore"]);
});

test("RA detail follows selected mode for unlock state and timestamp", () => {
  const base = createSnapshot("retroachievements");
  const snapshot = {
    ...base,
    achievements: base.achievements.map((achievement, index) => index === 0 ? {
      ...achievement,
      hardcoreUnlockedAt: UNLOCKED_AT,
    } : achievement),
  };
  const hardcore = buildRetroAchievementsCompactAchievementDetailModel(snapshot, "ACH_UNLOCKED", "hardcore");
  const softcore = buildRetroAchievementsCompactAchievementDetailModel(snapshot, "ACH_UNLOCKED", "softcore");
  assert.equal(hardcore?.isUnlocked, true);
  assert.equal(hardcore?.unlockMode, "hardcore");
  assert.equal(hardcore?.blocks[0]?.kind, "timestamp");
  assert.equal(softcore?.isUnlocked, false);
  assert.equal(softcore?.unlockMode, undefined);
  assert.equal(softcore?.blocks.some((block) => block.kind === "timestamp"), false);
  assert.equal(softcore?.blocks.some((block) => block.kind === "stats" && block.stats.some((stat) => stat.label === "Hardcore Unlocks")), false);
});

test("RA semantic achievement rails remain distinct under focus styling", () => {
  const css = getRaFocusStylesCss();
  for (const [tone, color] of [
    ["hardcore", raTheme.color.hardcore],
    ["softcore", raTheme.color.softcore],
    ["locked", raTheme.color.locked],
  ] as const) {
    assert.ok(css.includes(`[data-ac-ra-achievement-tone="${tone}"]`));
    assert.ok(css.includes("border-left-width: 3px !important"));
    assert.ok(css.includes(`border-left-color: ${color} !important`));
    assert.equal(achievementCompanionAchievementRowRecipes.surface("compact", color, true).borderLeft, `3px solid ${color}`);
  }
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

test("RA current-game View achievements opens the QAM list and returns to the dashboard", () => {
  const profileSource = readFileSync("src/platform/decky/decky-retroachievements-compact-profile.tsx", "utf8");
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  assert.ok(profileSource.includes('label={`View achievements for ${game.title}`} primary onActivate={() => onOpenGameAchievements(game)}'));
  assert.match(bootstrapSource, /onOpenGameAchievements=\{\(providerId, gameId, gameTitle\) => \{[\s\S]*?kind: "achievement-list",[\s\S]*?parent: "provider-dashboard"/u);

  resetDeckyCompactNavigationForTests();
  const list = {
    kind: "achievement-list" as const,
    providerId: "retroachievements" as const,
    gameId: "759",
    gameTitle: "Test Game",
    parent: "provider-dashboard" as const,
  };
  setDeckyCompactNavigation(list);
  assert.deepEqual(getDeckyCompactParentDestination(list), {
    kind: "provider-dashboard",
    providerId: "retroachievements",
  });

  const achievement = {
    kind: "achievement" as const,
    providerId: "retroachievements" as const,
    gameId: "759",
    gameTitle: "Test Game",
    achievementId: "123",
    parent: "achievement-list" as const,
    achievementListParent: "provider-dashboard" as const,
  };
  assert.deepEqual(getDeckyCompactParentDestination(achievement), list);
  const game = {
    kind: "game" as const,
    providerId: "retroachievements" as const,
    gameId: "759",
    gameTitle: "Test Game",
    returnToAchievement: {
      achievementId: "123",
      parent: "achievement-list" as const,
      achievementListParent: "provider-dashboard" as const,
    },
  };
  assert.deepEqual(getDeckyCompactParentDestination(game), achievement);
  returnFromDeckyCompactDestination(list);
  assert.deepEqual(readDeckyCompactNavigation(), {
    kind: "provider-dashboard",
    providerId: "retroachievements",
  });
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

  writeDeckyCompactAchievementPageState("retroachievements", "game-a", {
    filter: "locked",
    modeFilter: "softcore",
    visibleCount: 52,
    focusedAchievementId: "achievement-47",
    scrollTop: 1832,
  });
  assert.deepEqual(readDeckyCompactAchievementPageState("retroachievements", "game-a", 12), {
    filter: "locked",
    modeFilter: "softcore",
    visibleCount: 52,
    focusedAchievementId: "achievement-47",
    scrollTop: 1832,
  });
  assert.deepEqual(readDeckyCompactAchievementPageState("retroachievements", "game-b", 12), {
    filter: "all",
    modeFilter: "all",
    visibleCount: 12,
    focusedAchievementId: undefined,
    scrollTop: 0,
  });
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
  const compactLoadingSource = readFileSync("src/platform/decky/decky-compact-loading-state.tsx", "utf8");
  assert.match(compactLoadingSource, /isError \? onCancel \?\? consumeCompactLoadingBack : consumeCompactLoadingBack/u);
});

test("provider dashboard switches start a fresh resource session and restore chooser focus", () => {
  const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
  assert.match(bootstrapSource, /const returnToProviderChooser = useCallback\(\(\) => \{[\s\S]*clearDeckyCompactSessionResources\(\);[\s\S]*returnFromDeckyCompactDestination\(compactNavigation\)/u);
  assert.match(bootstrapSource, /returnToProviderChooser = useCallback[\s\S]*setProviderChooserFocusRequest\(\(request\) => request \+ 1\)/u);
  assert.match(bootstrapSource, /const openProviderDashboard = useCallback\(\(providerId: ProviderId\) => \{[\s\S]*clearDeckyCompactSessionResources\(\);[\s\S]*setDeckyCompactNavigation\(\{ kind: "provider-dashboard", providerId \}\)/u);
  assert.match(bootstrapSource, /<DashboardScreen[\s\S]*key=\{selectedProviderId\}[\s\S]*onBackToProviders=\{\(\) => \{[\s\S]*returnToProviderChooser\(\)/u);
  assert.match(bootstrapSource, /selectedProviderId !== undefined \|\| providerChooserFocusRequest === 0 \|\| providerInitialFocusTargetRef\.current === null/u);
});
