import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { GameDetailSnapshot, NormalizedAchievement } from "../src/core/domain";
import { selectGameOverviewSuggestions, isGameOverviewGoalComplete } from "../src/platform/decky/decky-game-overview-recommendations";
import { createGameOverviewPreferencesStore, gameOverviewPreferenceKey, parseGameOverviewPreferences } from "../src/platform/decky/decky-game-overview-preferences";
import { projectRetroAchievementsFullScreenAchievements } from "../src/platform/decky/decky-retroachievements-full-screen-achievement-data";
import { getDeckyOverviewDashboardColumns, getDeckyOverviewGridRows } from "../src/platform/decky/decky-full-screen-game-overview-layout";
import { getDeckySteamFullscreenArtworkFrameStyle, getDeckySteamFullscreenArtworkImageStyle } from "../src/platform/decky/decky-steam-fullscreen-game-artwork";
import {
  buildDeckyManageSuggestionsMenuItems,
  buildRetroAchievementsOverviewActionItems,
  getDeckyOverviewMenuParentFocusKey,
  getDeckyOverviewMenuParentPath,
  resolveDeckyOverviewMenuFrame,
  type DeckyGameOverviewActions,
  type DeckyOverviewMenuNavigation,
} from "../src/platform/decky/decky-overview-menu-model";
import { buildDeckyRetroAchievementsGameInfoRows, buildDeckySteamGameInfoRows, dedupeDeckyOverviewDetailRows, formatDeckyOverviewDate, formatDeckyOverviewDateTime } from "../src/platform/decky/decky-overview-format";

function achievement(id: string, patch: Partial<NormalizedAchievement> = {}): NormalizedAchievement {
  return { providerId: "steam", gameId: "1", achievementId: id, title: id, isUnlocked: false, metrics: [], ...patch };
}
function snapshot(achievements: readonly NormalizedAchievement[], providerId = "steam", award?: string): GameDetailSnapshot {
  return { game: { providerId, gameId: "1", title: "Test", status: "in_progress", summary: { unlockedCount: achievements.filter((a) => a.isUnlocked).length, totalCount: achievements.length }, metrics: award ? [{ key: "highest-award-kind", label: "Award", value: award }] : [] }, achievements, refreshedAt: 1 };
}
const ids = (value: ReturnType<typeof selectGameOverviewSuggestions>) => value.map((item) => item.achievement.achievementId);

test("suggestions preserve source sequence without assuming numeric IDs or difficulty", () => {
  const source = snapshot([achievement("z", { isUnlocked: true }), achievement("story-z"), achievement("a"), achievement("99"), achievement("1")]);
  assert.deepEqual(ids(selectGameOverviewSuggestions({ snapshot: source })), ["story-z", "a", "99"]);
  assert.deepEqual(ids(selectGameOverviewSuggestions({ snapshot: source, hiddenAchievementIds: ["a"] })), ["story-z", "99", "1"]);
  assert.equal(source.achievements.length, 5, "hiding recommendations never filters the source achievement list");
  assert.deepEqual(ids(selectGameOverviewSuggestions({ snapshot: source, hiddenAchievementIds: ["story-z", "a", "99", "1"] })), []);
});

test("Steam eligibility preserves unknown/conditional data, excludes confirmed unobtainable, and respects add-on groups", () => {
  const source = snapshot([achievement("dlc"), achievement("broken"), achievement("blocked"), achievement("conditional"), achievement("unknown")]);
  const steamHunters = { app: { appId: 1, tags: [] }, achievements: [
    { apiName: "blocked", obtainability: "unobtainable" as const },
    { apiName: "broken", obtainability: "broken-but-obtainable" as const, steamPercentage: 21, localPercentage: 90 },
    { apiName: "conditional", obtainability: "conditionally-obtainable" as const },
  ], groups: [{ dlcAppId: 2, dlcAppName: "Expansion", achievementApiNames: ["dlc"] }] };
  const result = selectGameOverviewSuggestions({ snapshot: source, steamHunters });
  assert.deepEqual(ids(result), ["broken", "conditional", "unknown"]);
  assert.equal(result[0]?.rarityPercent, 21);
  assert.equal(result[0]?.availabilityLabel, "Broken but obtainable");
  assert.equal(result[1]?.availabilityLabel, "Conditional");
  assert.equal(result[2]?.rarityPercent, undefined);
  assert.equal(selectGameOverviewSuggestions({ snapshot: source, steamHunters, hiddenAchievementIds: ["broken", "conditional", "unknown"] })[0]?.groupLabel, "Expansion");
});

test("Beat prioritizes source-classified progression and win conditions; Master retains missable warnings", () => {
  const source = snapshot([
    achievement("missable", { classification: "missable" }),
    achievement("final", { classification: "win-condition", metrics: [{ key: "display-order", label: "Order", value: "20" }] }),
    achievement("progress", { classification: "progression", metrics: [{ key: "display-order", label: "Order", value: "10" }] }),
    achievement("regular"),
  ], "retroachievements");
  assert.deepEqual(ids(selectGameOverviewSuggestions({ snapshot: source, goal: "beat" })), ["progress", "final", "missable"]);
  assert.equal(selectGameOverviewSuggestions({ snapshot: source, goal: "master" })[0]?.warning, "Missable — check your current save");
});

test("RA recorded awards and achievement mode, not the goal or 100 percent, determine milestone completion", () => {
  const source = snapshot([achievement("locked")], "retroachievements", "beaten-hardcore");
  assert.equal(isGameOverviewGoalComplete(source, "beat", "hardcore"), true);
  assert.equal(isGameOverviewGoalComplete(source, "master", "hardcore"), false);
  assert.equal(isGameOverviewGoalComplete(source, "beat", "softcore"), false);
  assert.equal(selectGameOverviewSuggestions({ snapshot: source, goal: "beat", achievementMode: "hardcore" }).length, 0);
  assert.equal(selectGameOverviewSuggestions({ snapshot: source, goal: "master", achievementMode: "hardcore" }).length, 1);
  for (const award of ["mastered", "mastered-hardcore", "completed-softcore"]) {
    assert.equal(isGameOverviewGoalComplete(snapshot([], "retroachievements", award), "master"), true);
  }
  assert.equal(isGameOverviewGoalComplete(snapshot([], "retroachievements", "mastered-hardcore"), "beat", "hardcore"), true, "Mastered exceeds a Beat goal");
  assert.equal(isGameOverviewGoalComplete(snapshot([achievement("all", { isUnlocked: true })], "retroachievements"), "master"), false);
});

test("mode-projected softcore unlock remains eligible toward hardcore, and fewer than three stays honest", () => {
  const raw = snapshot([achievement("soft", { providerId: "retroachievements", isUnlocked: true, unlockMode: "softcore", softcoreUnlockedAt: 100 })], "retroachievements");
  const projected = { ...raw, achievements: projectRetroAchievementsFullScreenAchievements(raw, "hardcore") };
  assert.deepEqual(ids(selectGameOverviewSuggestions({ snapshot: projected, achievementMode: "hardcore" })), ["soft"]);
  assert.equal(selectGameOverviewSuggestions({ snapshot: raw }).length, 0);
  assert.equal(selectGameOverviewSuggestions({ snapshot: snapshot([]) }).length, 0);
});

test("Steam Perfected follows exact authoritative progress, not stale status or a rounded percentage", () => {
  const complete = snapshot([achievement("one", { isUnlocked: true })]);
  assert.equal(isGameOverviewGoalComplete(complete), true, "an exact non-zero summary is complete even if status lags");
  assert.equal(isGameOverviewGoalComplete({ ...complete, game: { ...complete.game, status: "completed", summary: { unlockedCount: 99, totalCount: 100, completionPercent: 100 } } }), false);
  assert.equal(isGameOverviewGoalComplete({ ...complete, game: { ...complete.game, status: "completed", summary: { unlockedCount: 0, totalCount: 0, completionPercent: 100 } } }), false);
  assert.equal(isGameOverviewGoalComplete({ ...complete, game: { ...complete.game, summary: { unlockedCount: 21, totalCount: 20 } } }), false, "internally mismatched Steam totals are not treated as complete");
  assert.equal(isGameOverviewGoalComplete({ ...complete, game: { ...complete.game, summary: { unlockedCount: 20, totalCount: 20 }, metrics: [{ key: "steamhunters-total", label: "SteamHunters total", value: "19" }] } }), true, "enrichment mismatch does not redefine Steam progress");
});

test("durable preferences survive store recreation, isolate providers/games, and restore individually or all", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = createGameOverviewPreferencesStore(storage);
  first.hideSuggestion("steam", "1", "a"); first.hideSuggestion("steam", "1", "b"); first.hideSuggestion("steam", "1", "a");
  first.hideSuggestion("retroachievements", "1", "ra"); first.hideSuggestion("steam", "2", "other");
  first.setGlobalRetroAchievementsGoal("beat"); first.setRetroAchievementsGameGoal("1", "master");
  const restarted = createGameOverviewPreferencesStore(storage);
  assert.deepEqual(restarted.read().hiddenSuggestions[gameOverviewPreferenceKey("steam", "1")], ["a", "b"]);
  assert.equal(restarted.read().globalRetroAchievementsGoal, "beat");
  assert.equal(restarted.read().retroAchievementsGameGoals["1"], "master");
  restarted.restoreSuggestion("steam", "1", "a");
  assert.deepEqual(restarted.read().hiddenSuggestions[gameOverviewPreferenceKey("steam", "1")], ["b"]);
  restarted.restoreAllSuggestions("steam", "1"); restarted.setRetroAchievementsGameGoal("1", undefined);
  assert.equal(restarted.read().hiddenSuggestions[gameOverviewPreferenceKey("steam", "1")], undefined);
  assert.deepEqual(restarted.read().hiddenSuggestions[gameOverviewPreferenceKey("retroachievements", "1")], ["ra"]);
  assert.deepEqual(restarted.read().hiddenSuggestions[gameOverviewPreferenceKey("steam", "2")], ["other"]);
  assert.equal(restarted.read().retroAchievementsGameGoals["1"], undefined);
});

test("invalid or unavailable storage does not create fake successful persistence", () => {
  assert.equal(parseGameOverviewPreferences("broken").globalRetroAchievementsGoal, "master");
  assert.equal(parseGameOverviewPreferences('{"version":2,"globalRetroAchievementsGoal":"beat"}').globalRetroAchievementsGoal, "master");
  assert.equal(createGameOverviewPreferencesStore(undefined).hideSuggestion("steam", "1", "x"), false);
  assert.equal(createGameOverviewPreferencesStore({ getItem: () => null, setItem: () => { throw Error("full"); } }).setGlobalRetroAchievementsGoal("beat"), false);
  assert.notEqual(gameOverviewPreferenceKey("a:b", "c"), gameOverviewPreferenceKey("a", "b:c"));
});

function menuActions(overrides: Partial<DeckyGameOverviewActions> = {}): DeckyGameOverviewActions {
  return {
    suggestions: [
      { achievement: achievement("a", { title: "Craftier than Witchcraft" }) },
      { achievement: achievement("b", { title: "Twisted Madness" }) },
    ],
    hiddenSuggestions: [achievement("hidden", { title: "Copper Stopper" })],
    onOpenAchievement: () => undefined,
    onJumpToAchievement: () => undefined,
    onDismissSuggestion: () => undefined,
    onRestoreSuggestion: () => undefined,
    onRestoreAllSuggestions: () => undefined,
    onFocusedSuggestionChange: () => undefined,
    ...overrides,
  };
}

test("Manage Suggestions is hierarchical and restores the originating achievement action", () => {
  let modalClose: (() => void) | undefined;
  const calls: string[] = [];
  const items = buildDeckyManageSuggestionsMenuItems(menuActions({
    onOpenAchievement: (id, onClose) => { calls.push(`details:${id}`); modalClose = onClose; },
  }));
  assert.deepEqual(items.map((item) => item.label), ["Craftier than Witchcraft", "Twisted Madness", "Hidden Suggestions (1)", "Restore All Hidden"]);
  const achievementFrame = resolveDeckyOverviewMenuFrame("Manage Suggestions", items, ["visible:a"]);
  assert.deepEqual(achievementFrame?.items.map((item) => item.label), ["View Details", "Show in Achievements", "Hide Suggestion"]);
  let restoredKey: string | undefined;
  achievementFrame?.items[0]?.onSelect?.({ restoreCurrent: (key) => { restoredKey = key; }, restoreParent: () => undefined });
  assert.deepEqual(calls, ["details:a"]);
  modalClose?.();
  assert.equal(restoredKey, "details");
});

test("Manage Suggestions dismissal and hidden restoration choose a surviving adjacent item", () => {
  const calls: string[] = [];
  const items = buildDeckyManageSuggestionsMenuItems(menuActions({
    onDismissSuggestion: (id) => calls.push(`hide:${id}`),
    onRestoreSuggestion: (id) => calls.push(`restore:${id}`),
    onRestoreAllSuggestions: () => calls.push("restore-all"),
  }));
  const restored: string[] = [];
  const navigation: DeckyOverviewMenuNavigation = {
    restoreCurrent: (key) => restored.push(`current:${key ?? ""}`),
    restoreParent: (key) => restored.push(`parent:${key ?? ""}`),
  };
  resolveDeckyOverviewMenuFrame("Manage Suggestions", items, ["visible:a"])?.items.find((item) => item.key === "hide")?.onSelect?.(navigation);
  resolveDeckyOverviewMenuFrame("Manage Suggestions", items, ["hidden", "hidden:hidden"])?.items.find((item) => item.key === "restore")?.onSelect?.(navigation);
  items.find((item) => item.key === "restore-all")?.onSelect?.(navigation);
  assert.deepEqual(calls, ["hide:a", "restore:hidden", "restore-all"]);
  assert.deepEqual(restored, ["parent:visible:b", "parent:", "current:visible:a"]);
});

test("nested menu Back unwinds one frame at a time with the prior item selected", () => {
  const items = buildRetroAchievementsOverviewActionItems({
    globalGoal: "master",
    gameGoalOverride: "beat",
    onOpenExternal: () => undefined,
    onOpenGameInfo: () => undefined,
    onSetGlobalGoal: () => undefined,
    onSetGameGoalOverride: () => undefined,
  });
  const deepest = ["goal-settings", "this-game"];
  assert.equal(resolveDeckyOverviewMenuFrame("Actions", items, deepest)?.label, "This Game · Beat");
  assert.deepEqual(getDeckyOverviewMenuParentPath(deepest), ["goal-settings"]);
  assert.equal(getDeckyOverviewMenuParentFocusKey(deepest), "this-game");
  assert.deepEqual(getDeckyOverviewMenuParentPath(["goal-settings"]), []);
  assert.equal(getDeckyOverviewMenuParentFocusKey(["goal-settings"]), "goal-settings");
  assert.equal(getDeckyOverviewMenuParentPath([]), undefined);
});

test("RA goal selections return to Goal Settings with the updated parent focused and labeled", () => {
  const mutations: string[] = [];
  const restored: string[] = [];
  let globalGoal: "beat" | "master" = "master";
  let gameGoalOverride: "beat" | "master" | undefined;
  const build = () => buildRetroAchievementsOverviewActionItems({
    globalGoal,
    ...(gameGoalOverride !== undefined ? { gameGoalOverride } : {}),
    onOpenExternal: () => undefined,
    onOpenGameInfo: () => undefined,
    onSetGlobalGoal: (goal) => { globalGoal = goal; mutations.push(`global:${goal}`); },
    onSetGameGoalOverride: (goal) => { gameGoalOverride = goal; mutations.push(`game:${goal ?? "global"}`); },
  });
  const navigation: DeckyOverviewMenuNavigation = { restoreCurrent: (key) => restored.push(`current:${key ?? ""}`), restoreParent: (key) => restored.push(`parent:${key ?? ""}`) };
  const thisGame = resolveDeckyOverviewMenuFrame("Actions", build(), ["goal-settings", "this-game"]);
  assert.equal(thisGame?.items.find((item) => item.key === "use-global")?.selected, true);
  thisGame?.items.find((item) => item.key === "beat")?.onSelect?.(navigation);
  assert.equal(resolveDeckyOverviewMenuFrame("Actions", build(), ["goal-settings"])?.items.find((item) => item.key === "this-game")?.label, "This Game · Beat");
  const global = resolveDeckyOverviewMenuFrame("Actions", build(), ["goal-settings", "global-default"]);
  assert.equal(global?.items.find((item) => item.key === "master")?.selected, true);
  global?.items.find((item) => item.key === "beat")?.onSelect?.(navigation);
  assert.equal(resolveDeckyOverviewMenuFrame("Actions", build(), ["goal-settings"])?.items.find((item) => item.key === "global-default")?.label, "Global Default · Beat");
  resolveDeckyOverviewMenuFrame("Actions", build(), ["goal-settings", "this-game"])?.items.find((item) => item.key === "use-global")?.onSelect?.(navigation);
  resolveDeckyOverviewMenuFrame("Actions", build(), ["goal-settings", "this-game"])?.items.find((item) => item.key === "master")?.onSelect?.(navigation);
  resolveDeckyOverviewMenuFrame("Actions", build(), ["goal-settings", "global-default"])?.items.find((item) => item.key === "master")?.onSelect?.(navigation);
  assert.deepEqual(mutations, ["game:beat", "global:beat", "game:global", "game:master", "global:master"]);
  assert.equal(gameGoalOverride, "master");
  assert.deepEqual(restored, ["parent:this-game", "parent:global-default", "parent:this-game", "parent:this-game", "parent:global-default"]);
});

test("Game Info date formatting respects source precision", () => {
  assert.equal(formatDeckyOverviewDate("2026", "year"), "2026");
  assert.match(formatDeckyOverviewDate("2026-09", "month"), /2026/u);
  assert.match(formatDeckyOverviewDate("2026-09-29T00:00:00Z", "day"), /2026/u);
  assert.equal(formatDeckyOverviewDate("Coming soon"), "Coming soon");
  const concise = formatDeckyOverviewDateTime(new Date(2026, 9, 25, 11, 13, 47));
  assert.match(concise ?? "", /2026/u);
  assert.doesNotMatch(concise ?? "", /:47(?:\s|$)/u);
});

test("Game Info exposes only the approved compact provider metadata", () => {
  const steamRows = buildDeckySteamGameInfoRows({ appId: "123", releaseDate: "Oct 2026", steamPlaytime: "10h", deckPlaytime: "4h", setPoints: "3,080", lastRefreshed: "Oct 25, 2026 · 11:13 AM" });
  assert.deepEqual(steamRows.map((row) => row.label), ["Steam App ID", "Release Date", "Steam Playtime", "Deck Playtime", "SteamHunters Set Points", "Last Refreshed"]);
  assert.equal(steamRows.length, 6);
  const raRows = buildDeckyRetroAchievementsGameInfoRows({ gameId: "42", system: "Nintendo 64", releaseDate: "1997", lastSync: "Oct 25, 2026 · 11:13 AM", totalSetPoints: "106", awardDate: "Oct 24, 2026 · 9:10 PM" });
  assert.deepEqual(raRows.map((row) => row.label), ["Game ID", "System", "Release Date", "Last Sync", "Total Set Points", "Award Date"]);
  assert.equal(raRows.find((row) => row.label === "Total Set Points")?.value, "106");
  assert.deepEqual(buildDeckyRetroAchievementsGameInfoRows({ gameId: "42", totalSetPoints: "106" }).map((row) => row.label), ["Game ID", "Total Set Points"], "missing award dates are omitted");
});

test("Game Info deduplicates semantic provider identifiers rather than label text alone", () => {
  assert.deepEqual(dedupeDeckyOverviewDetailRows([
    { key: "steam-app-id", label: "Steam App ID", value: "123" },
    { key: "appid", label: "Application", value: "123" },
    { key: "total-achievements", label: "Total achievements", value: "20" },
    { key: "achievement-total", label: "Achievement count", value: "20" },
    { key: "release-date", label: "Release date", value: "2026" },
  ]).map((row) => row.label), ["Steam App ID", "Total achievements", "Release date"]);
  assert.deepEqual(dedupeDeckyOverviewDetailRows([
    { key: "provider-game-id", label: "RA Game ID", value: "42" },
    { key: "game-id", label: "Game Identifier", value: "42" },
    { label: "System", value: "Nintendo 64" },
    { label: "Platform", value: "Nintendo 64" },
  ]).map((row) => row.label), ["RA Game ID", "System"]);
});

test("Overview focus groups, popup guard, and modal callbacks retain native navigation ownership", () => {
  const shared = readFileSync("src/platform/decky/decky-full-screen-game-overview-content.tsx", "utf8");
  const steam = readFileSync("src/platform/decky/decky-steam-game-overview.tsx", "utf8");
  const modal = readFileSync("src/platform/decky/decky-standard-modal.tsx", "utf8");
  assert.match(shared, /flow-children="left-right"[\s\S]*label="Game Info"[\s\S]*label="Community"/u);
  assert.match(steam, /flow-children="left-right"[\s\S]*label="Play Game"[\s\S]*label="Actions"/u);
  assert.match(shared, /function DeckyOverviewMenuPopup/u);
  assert.match(shared, /bInteractableItem=\{keepsPopupOpen\}/u);
  assert.match(shared, /onUnmount\(\);[\s\S]*menuRef\.current = undefined;/u);
  assert.match(shared, /keepMenuOpenOnSelect === true[\s\S]*setRevision/u);
  assert.doesNotMatch(shared, /closeFrame\(false, true\)[\s\S]*restoreFrame/u);
  assert.match(shared, /registerDeckyFullscreenPopupCancel/u);
  assert.match(modal, /closeModal=\{closeModal\}[\s\S]*onOK=\{closeModal\}[\s\S]*onCancel=\{closeModal\}/u);
  assert.match(modal, /bNeverPopOut: true/u);
  assert.match(shared, /maxHeight: "min\(228px, calc\(100vh - 300px\)\)"/u);
  assert.match(modal, /popupWidth: 720, popupHeight: 420/u);
});

test("Overview milestone panels use the protected provider status icons and authoritative RA award date", () => {
  const shared = readFileSync("src/platform/decky/decky-full-screen-game-overview-content.tsx", "utf8");
  const steam = readFileSync("src/platform/decky/decky-steam-game-overview.tsx", "utf8");
  const retro = readFileSync("src/platform/decky/decky-retroachievements-game-overview.tsx", "utf8");
  assert.match(steam, /DeckyGameStatusIcon kind="perfected"/u);
  assert.match(retro, /DeckyGameStatusIcon kind=\{mastered \? "mastered" : "beaten"\}/u);
  assert.match(retro, /metric\.key === "highest-award-date"/u);
  assert.doesNotMatch(retro, /award !== undefined && game\.lastUnlockAt/u);
  assert.match(shared, /data-ac-milestone-showcase=\{kind\}/u);
  assert.match(shared, /data-ac-milestone-watermark="true"[\s\S]*aria-hidden="true"/u);
  assert.match(shared, /pointerEvents: "none"/u);
  assert.match(shared, /opacity: 0\.1/u);
  assert.match(retro, /primaryLabel=\{mastered \? "MASTERY ACHIEVED" : "GOAL ACHIEVED"\}/u);
  assert.match(retro, /Award recorded \{awardDate\}/u);
  assert.match(steam, /primaryLabel="ALL ACHIEVEMENTS UNLOCKED"/u);
  assert.match(steam, /Final recorded unlock:/u);
  assert.doesNotMatch(steam, /Perfected (?:award|at)/iu);
  assert.match(shared, /\{completed \? history : null\}/u, "unfinished goals never render a completed-state watermark");
});

test("Overview remains a fixed-height dashboard with structured provider metrics", () => {
  const layout = readFileSync("src/platform/decky/decky-full-screen-game-overview-layout.tsx", "utf8");
  const shared = readFileSync("src/platform/decky/decky-full-screen-game-overview-content.tsx", "utf8");
  assert.match(layout, /height: "100%"/u);
  assert.match(layout, /gridTemplateRows/u);
  assert.doesNotMatch(layout, /overflowY:\s*"(?:auto|scroll)"/u);
  assert.match(shared, /data-ac-overview-provider-metrics="true"/u);
  assert.match(shared, /gridTemplateColumns: "repeat\(2, minmax\(0, 1fr\)\)"/u);
  assert.match(shared, /LATEST UNLOCK/u);
  assert.match(shared, /DeckyAchievementTypeBadge classification=\{achievement\.classification\}/u);
  assert.match(shared, /data-ac-up-next-rarity="true"/u);
  assert.match(shared, /data-ac-overview-header-indicators="true"/u);
  assert.match(shared, /data-ac-latest-unlock="true"/u);
  assert.match(shared, /marginTop: "auto"/u);
  assert.match(shared, /\{Math\.round\(suggestion\.rarityPercent\)\}% players/u);
  assert.doesNotMatch(shared, /suggestion\.rarityLabel/u);
  const retro = readFileSync("src/platform/decky/decky-retroachievements-game-overview.tsx", "utf8");
  const steam = readFileSync("src/platform/decky/decky-steam-game-overview.tsx", "utf8");
  assert.doesNotMatch(retro, /No provider milestone recorded yet/u);
  assert.doesNotMatch(retro, /player population, mastery rate/u);
  assert.doesNotMatch(steam, /population and points context/u);
  assert.match(steam, /\.join\("\\n"\)/u);
  assert.ok(getDeckyOverviewGridRows(425).dashboard >= 260, "the supported-height dashboard reserves the expanded progress row");
  assert.ok(getDeckyOverviewGridRows(400).dashboard >= 240, "the compact supported-height dashboard remains non-scrolling");
  assert.equal(getDeckyOverviewDashboardColumns(false), "minmax(0, 2fr) minmax(0, 3fr)");
  assert.equal(getDeckyOverviewDashboardColumns(true), "minmax(0, 9fr) minmax(0, 11fr)");
});

test("Steam Overview artwork fills its rounded frame while fallbacks can preserve their content", () => {
  const frame = getDeckySteamFullscreenArtworkFrameStyle(false, false, true);
  assert.equal(frame.padding, 0);
  assert.equal(frame.height, 64);
  assert.equal(frame.background, "transparent");
  assert.equal(frame.border, "none");
  assert.equal(frame.overflow, "hidden");
  assert.equal(getDeckySteamFullscreenArtworkImageStyle("cover", false).objectFit, "cover");
  assert.equal(getDeckySteamFullscreenArtworkImageStyle("contain", false).objectFit, "contain");
  const steam = readFileSync("src/platform/decky/decky-steam-game-overview.tsx", "utf8");
  assert.match(steam, /overview imageFit="cover" fallbackImageFit="contain"/u);
});
