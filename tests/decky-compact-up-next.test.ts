import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DashboardSnapshot, GameDetailSnapshot, NormalizedAchievement, RecentlyPlayedGame } from "../src/core/domain";
import {
  buildDeckyCompactUpNextModel,
  DECKY_COMPACT_UP_NEXT_CANDIDATE_LIMIT,
  selectDeckyCompactUpNextCandidates,
  shouldAdvanceDeckyCompactUpNextCandidate,
} from "../src/platform/decky/decky-compact-up-next-model";
import {
  clearDeckyCompactSessionResources,
  loadDeckyCompactDashboardState,
  loadDeckyCompactGameState,
  readDeckyCompactDashboardState,
  readDeckyCompactGameState,
} from "../src/platform/decky/decky-compact-session-resources";
import { getDeckyRetroAchievementsCompactFocusTargetKey } from "../src/platform/decky/decky-retroachievements-compact-focus-state";
import { getDeckySteamCompactFocusTargetKey } from "../src/platform/decky/decky-steam-compact-focus-state";
import { shouldRequestDeckyCompactDashboardFocusRestore } from "../src/platform/decky/decky-compact-navigation";
import {
  findRetroAchievementsActiveGame,
  getRetroAchievementsActiveGameId,
  prependRetroAchievementsActiveGame,
} from "../src/platform/decky/decky-retroachievements-current-game";

function game(gameId: string, unlockedCount = 0, totalCount = 10): RecentlyPlayedGame {
  return { providerId: "steam", gameId, title: `Game ${gameId}`, summary: { unlockedCount, totalCount } };
}

function achievement(id: string, patch: Partial<NormalizedAchievement> = {}): NormalizedAchievement {
  return { providerId: "steam", gameId: "1", achievementId: id, title: id, isUnlocked: false, metrics: [], ...patch };
}

function snapshot(achievements: readonly NormalizedAchievement[], providerId = "steam", award?: string): GameDetailSnapshot {
  return {
    game: {
      providerId, gameId: "1", title: "Game 1", status: "in_progress",
      summary: { unlockedCount: achievements.filter((item) => item.isUnlocked).length, totalCount: achievements.length },
      metrics: award === undefined ? [] : [{ key: "highest-award-kind", label: "Award", value: award }],
    },
    achievements,
  };
}

function dashboard(providerId: string): DashboardSnapshot {
  return {
    profile: {
      providerId,
      identity: { providerId, accountId: "account", displayName: "Player" },
      summary: { unlockedCount: 0 },
      metrics: [],
    },
    recentAchievements: [],
    recentlyPlayedGames: [],
    recentUnlocks: [],
    featuredGames: [],
  };
}

test("Steam candidate discovery prefers unfinished recent games and stays bounded", () => {
  const games = [game("complete", 10, 10), ...Array.from({ length: 8 }, (_, index) => game(String(index)))];
  const candidates = selectDeckyCompactUpNextCandidates({ providerId: "steam", games });
  assert.equal(candidates.length, DECKY_COMPACT_UP_NEXT_CANDIDATE_LIMIT);
  assert.deepEqual(candidates.map(({ gameId }) => gameId), ["0", "1", "2", "3", "4"]);
});

test("a reliably active game leads candidate order while duplicate entries stay deduplicated", () => {
  const games = [game("recent"), game("active"), game("active")];
  assert.deepEqual(selectDeckyCompactUpNextCandidates({ providerId: "retroachievements", games, activeGameId: "active" }).map(({ gameId }) => gameId), ["active", "recent"]);
});

test("a confirmed current RA game is never replaced by a fallback recommendation candidate", () => {
  assert.equal(shouldAdvanceDeckyCompactUpNextCandidate({
    providerId: "retroachievements",
    activeGameId: "portal",
    currentGameId: "portal",
    outcomeKind: "empty",
    hasFatalError: false,
    hasNextCandidate: true,
  }), false);
  assert.equal(shouldAdvanceDeckyCompactUpNextCandidate({
    providerId: "retroachievements",
    activeGameId: "portal",
    currentGameId: "portal",
    outcomeKind: "completed",
    hasFatalError: false,
    hasNextCandidate: true,
  }), false);
  assert.equal(shouldAdvanceDeckyCompactUpNextCandidate({
    providerId: "retroachievements",
    currentGameId: "recent",
    outcomeKind: "empty",
    hasFatalError: false,
    hasNextCandidate: true,
  }), false);
  assert.equal(shouldAdvanceDeckyCompactUpNextCandidate({
    providerId: "steam",
    currentGameId: "recent",
    outcomeKind: "empty",
    hasFatalError: false,
    hasNextCandidate: true,
  }), true);
});

test("RA current-game identity is fresh, explicit, and independent of recent-game ordering", () => {
  const now = Date.UTC(2026, 9, 26, 8, 30, 0);
  const profile = {
    providerId: "retroachievements",
    identity: { providerId: "retroachievements", accountId: "account", displayName: "Player" },
    summary: { unlockedCount: 0 },
    metrics: [],
    richPresenceGameId: "2",
    richPresenceMsgDate: now - 60_000,
  };
  const recent = [
    { ...game("recent"), providerId: "retroachievements" },
    { ...game("2"), providerId: "retroachievements" },
  ];
  const activeGameId = getRetroAchievementsActiveGameId(profile, now);
  const activeGame = findRetroAchievementsActiveGame(activeGameId, recent);

  assert.equal(activeGameId, "2");
  assert.equal(activeGame?.gameId, "2");
  assert.deepEqual(prependRetroAchievementsActiveGame(recent, activeGame).map(({ gameId }) => gameId), ["2", "recent"]);
  assert.equal(findRetroAchievementsActiveGame("missing", recent), undefined);
  assert.equal(getRetroAchievementsActiveGameId({ ...profile, richPresenceMsgDate: now - 11 * 60_000 }, now), undefined);
  assert.equal(getRetroAchievementsActiveGameId({ ...profile, richPresenceMsgDate: now + 1 }, now), undefined);
  assert.equal(getRetroAchievementsActiveGameId({ ...profile, richPresenceGameId: undefined }, now), undefined);
  assert.equal(getRetroAchievementsActiveGameId({ ...profile, richPresenceGameId: "3" }, now), "3");
  assert.equal(getRetroAchievementsActiveGameId({ ...profile, richPresenceGameId: "0" }, now), undefined);
  assert.equal(getRetroAchievementsActiveGameId({ ...profile, richPresenceGameId: "invalid" }, now), undefined);
});

test("shared Up Next model distinguishes recommendations, hidden suggestions, empty sets, and completion", () => {
  const source = snapshot([achievement("first"), achievement("second")]);
  assert.equal(buildDeckyCompactUpNextModel({ snapshot: source, hiddenAchievementIds: [], goal: "master", achievementMode: "both" }).outcome.kind, "suggestion");
  const hidden = buildDeckyCompactUpNextModel({ snapshot: source, hiddenAchievementIds: ["first", "second"], goal: "master", achievementMode: "both" });
  assert.equal(hidden.outcome.kind, "all-hidden");
  assert.deepEqual(hidden.hiddenAchievements.map(({ achievementId }) => achievementId), ["first", "second"]);
  assert.equal(buildDeckyCompactUpNextModel({ snapshot: snapshot([]), hiddenAchievementIds: [], goal: "master", achievementMode: "both" }).outcome.kind, "empty");
  assert.equal(buildDeckyCompactUpNextModel({ snapshot: snapshot([achievement("done", { isUnlocked: true })]), hiddenAchievementIds: [], goal: "master", achievementMode: "both" }).outcome.kind, "completed");
});

test("RA Up Next uses verified goals and projects softcore unlocks back into hardcore recommendations", () => {
  const achievedSoftcore = achievement("soft", { providerId: "retroachievements", isUnlocked: true, unlockMode: "softcore", softcoreUnlockedAt: 10 });
  const source = snapshot([achievedSoftcore], "retroachievements");
  assert.equal(buildDeckyCompactUpNextModel({ snapshot: source, hiddenAchievementIds: [], goal: "master", achievementMode: "hardcore" }).outcome.kind, "suggestion");
  const beaten = snapshot([achievement("locked", { providerId: "retroachievements" })], "retroachievements", "beaten-hardcore");
  assert.equal(buildDeckyCompactUpNextModel({ snapshot: beaten, hiddenAchievementIds: [], goal: "beat", achievementMode: "hardcore" }).outcome.kind, "completed");
  assert.equal(buildDeckyCompactUpNextModel({ snapshot: beaten, hiddenAchievementIds: [], goal: "master", achievementMode: "hardcore" }).outcome.kind, "suggestion");
});

test("compact game resources deduplicate per provider and are cleared with the QAM session", async () => {
  clearDeckyCompactSessionResources();
  let calls = 0;
  const loader = async () => { calls += 1; return { status: "success" as const, data: snapshot([achievement("one")]), isStale: false, isRefreshing: false }; };
  await Promise.all([loadDeckyCompactGameState("steam", "1", loader), loadDeckyCompactGameState("steam", "1", loader)]);
  assert.equal(calls, 1);
  assert.equal(readDeckyCompactGameState("steam", "1")?.status, "success");
  assert.equal(readDeckyCompactGameState("retroachievements", "1"), undefined);
  clearDeckyCompactSessionResources();
  assert.equal(readDeckyCompactGameState("steam", "1"), undefined);
});

test("compact dashboard resources retain both providers across child-route Back", async () => {
  clearDeckyCompactSessionResources();
  let steamCalls = 0;
  let retroCalls = 0;
  const steamLoader = async () => {
    steamCalls += 1;
    return { status: "success" as const, data: dashboard("steam"), isStale: false, isRefreshing: false };
  };
  const retroLoader = async () => {
    retroCalls += 1;
    return { status: "success" as const, data: dashboard("retroachievements"), isStale: false, isRefreshing: false };
  };

  await loadDeckyCompactDashboardState("steam", steamLoader, true);
  await loadDeckyCompactDashboardState("retroachievements", retroLoader, true);
  await loadDeckyCompactDashboardState("steam", steamLoader);
  await loadDeckyCompactDashboardState("retroachievements", retroLoader);

  assert.equal(steamCalls, 1);
  assert.equal(retroCalls, 1);
  assert.equal(readDeckyCompactDashboardState("steam")?.data?.profile.providerId, "steam");
  assert.equal(readDeckyCompactDashboardState("retroachievements")?.data?.profile.providerId, "retroachievements");

  clearDeckyCompactSessionResources();
  assert.equal(readDeckyCompactDashboardState("steam"), undefined);
  assert.equal(readDeckyCompactDashboardState("retroachievements"), undefined);
});

test("Up Next focus keys preserve the control and game without retaining obsolete achievement IDs", () => {
  assert.equal(getDeckySteamCompactFocusTargetKey({ kind: "up-next", control: "recommendation", gameId: "10" }), "up-next:recommendation:10");
  assert.equal(getDeckyRetroAchievementsCompactFocusTargetKey({ kind: "up-next", control: "options", gameId: "20" }), "up-next:options:20");
});

test("returning from an Up Next achievement list requests dashboard focus restoration", () => {
  assert.equal(shouldRequestDeckyCompactDashboardFocusRestore(
    { kind: "achievement-list", providerId: "steam", gameId: "10", gameTitle: "Game", parent: "provider-dashboard" },
    { kind: "provider-dashboard", providerId: "steam" },
  ), true);
  assert.equal(shouldRequestDeckyCompactDashboardFocusRestore(
    { kind: "achievement-list", providerId: "retroachievements", gameId: "20", gameTitle: "Game", parent: "provider-dashboard" },
    { kind: "provider-dashboard", providerId: "retroachievements" },
  ), true);
  assert.equal(shouldRequestDeckyCompactDashboardFocusRestore(
    { kind: "achievement-list", providerId: "steam", gameId: "10", gameTitle: "Game", parent: "game" },
    { kind: "game", providerId: "steam", gameId: "10", gameTitle: "Game" },
  ), false);
});

test("shared QAM card is theme-token driven and exposes controller, touch, and menu actions", () => {
  const source = readFileSync("src/platform/decky/decky-compact-up-next-card.tsx", "utf8");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}|rgba?\(|\bcyan\b|\bgreen\b/iu);
  assert.match(source, /theme\.surface\.contentCard/u);
  assert.match(source, /theme\.surface\.focusedContentStat/u);
  assert.match(source, /onSecondaryButton:/u);
  assert.match(source, /onOptionsButton:/u);
  assert.match(source, /onClick=\{activateRecommendation\}/u);
  assert.doesNotMatch(source, /A Details · X Skip · Y Achievements/u);
  assert.match(source, /onSecondaryActionDescription: "Skip"/u);
  assert.match(source, /onOptionsActionDescription: "List"/u);
  assert.match(source, /buildRetroAchievementsGoalSettingsMenuItem/u);
  assert.match(source, /globalGoal: preferences\.globalRetroAchievementsGoal/u);
  assert.match(source, /gameGoalOverride: preferences\.retroAchievementsGoalOverride/u);
  assert.doesNotMatch(source, /key: "goal-beat"|key: "goal-master"/u);
  assert.match(source, /Manage Suggestions/u);
  assert.match(source, /Restore All Suggestions/u);
  assert.match(source, /Skip Current Suggestion/u);
  assert.match(source, /preserveCompactSession/u);
});

test("shared QAM card gives game titles the full header width and keeps provider-neutral progress geometry", () => {
  const source = readFileSync("src/platform/decky/decky-compact-up-next-card.tsx", "utf8");
  assert.match(source, /gridTemplateColumns: "46px minmax\(0, 1fr\)"/u);
  assert.doesNotMatch(source, /gridTemplateColumns: "46px minmax\(0, 1fr\) auto"/u);
  assert.match(source, /<strong title=\{displayedGame\.title\} style=\{\{ \.\.\.lineClamp\(2\), fontSize: 13/u);
  assert.match(source, /justifyContent: "space-between"/u);
  assert.match(source, /width: "100%", height: 4/u);
  assert.doesNotMatch(source, /richPresence/u);
  assert.match(source, /providerId === "steam" \? "Steam" : "RetroAchievements"/u);
  assert.match(source, /`UP NEXT · \$\{preferences\.retroAchievementsGoal\.toUpperCase\(\)\}`/u);
  assert.match(source, /: "UP NEXT"/u);
  assert.match(source, /suggestion === undefined \|\| !recommendationFocused \? \{\} : \{/u);
  assert.match(source, /loadedGameKey === currentGameKey/u);
  assert.match(source, /return \(\) => \{ active = false; \}/u);
  assert.match(source, /shouldAdvanceDeckyCompactUpNextCandidate/u);
});

test("Steam and RetroAchievements profiles mount the same Up Next component in the intended position", () => {
  const steam = readFileSync("src/platform/decky/decky-steam-compact-profile.tsx", "utf8");
  const retro = readFileSync("src/platform/decky/decky-retroachievements-compact-profile.tsx", "utf8");
  assert.match(steam, /<DeckyCompactUpNextCard[\s\S]*showSteamHuntersProfile/u);
  assert.match(retro, /<DeckyCompactUpNextCard/u);
  assert.equal((steam.match(/<DeckyCompactUpNextCard/gu) ?? []).length, 1);
  assert.equal((retro.match(/<DeckyCompactUpNextCard/gu) ?? []).length, 1);
});
