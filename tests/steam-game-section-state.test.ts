import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { GameDetailSnapshot } from "../src/core/domain";
import { composeSteamGameDetailWithSteamHunters } from "../src/providers/steamhunters";
import {
  readSteamGameSectionPageState,
  resetSteamGameSectionActiveSection,
  requestSteamGameSectionRestoration,
  resetSteamGameSectionPageStatesForTests,
  selectSteamAchievementRestorationTarget,
  updateSteamGameSectionPageState,
} from "../src/platform/decky/decky-steam-game-section-state";
import {
  DECKY_FULLSCREEN_FOOTER_SHOULDER_BUTTON,
  handleDeckyFullScreenFooterShoulderButtonDown,
} from "../src/platform/decky/decky-full-screen-footer-overlay";
import {
  getAdjacentFullScreenGameSectionId,
  type DeckyFullScreenGameSection,
} from "../src/platform/decky/decky-full-screen-game-section-navigation";
import { isDeckySteamFullscreenEnrichmentPending } from "../src/platform/decky/decky-steam-fullscreen-enrichment";
import { isSteamHuntersSetFullyObtainable } from "../src/platform/decky/decky-steam-hunters-set-status";

test("Steam section state preserves filters and stable achievement ids by game", () => {
  resetSteamGameSectionPageStatesForTests();
  updateSteamGameSectionPageState("steam", "42", (current) => ({
    ...current,
    activeSection: "achievements",
    achievements: {
      ...current.achievements,
      scrollTop: 760,
      focusedId: "API_37",
      achievementFilter: "locked",
      achievementGroupFilter: "missable",
      achievementAvailabilityFilter: "unobtainable",
      visibleAchievementIds: ["API_36", "API_37", "API_38"],
    },
    "achievement-groups": {
      ...current["achievement-groups"],
      scrollTop: 320,
      expandedGroupIds: ["base-game", "dlc:123:1"],
      focusedGroupId: "dlc:123:1",
    },
  }));

  const state = readSteamGameSectionPageState("steam", "42");
  assert.equal(state.activeSection, "achievements");
  assert.equal(state.achievements.scrollTop, 760);
  assert.equal(state.achievements.focusedId, "API_37");
  assert.equal(state.achievements.achievementFilter, "locked");
  assert.equal(state.achievements.achievementGroupFilter, "missable");
  assert.equal(state.achievements.achievementAvailabilityFilter, "unobtainable");
  assert.equal(state["achievement-groups"].scrollTop, 320);
  assert.deepEqual(state["achievement-groups"].expandedGroupIds, ["base-game", "dlc:123:1"]);
  assert.equal(state["achievement-groups"].focusedGroupId, "dlc:123:1");
  assert.equal(readSteamGameSectionPageState("steam", "other").activeSection, "overview");
});

test("SteamHunters uses the fully obtainable state only when every restriction is explicitly clear", () => {
  assert.equal(isSteamHuntersSetFullyObtainable({
    hasPaidDlc: false,
    unobtainableCount: 0,
    conditionalCount: 0,
    brokenButObtainableCount: 0,
  }), true);
  assert.equal(isSteamHuntersSetFullyObtainable({
    hasPaidDlc: true,
    unobtainableCount: 0,
    conditionalCount: 0,
    brokenButObtainableCount: 0,
  }), false);
  assert.equal(isSteamHuntersSetFullyObtainable({
    hasPaidDlc: false,
    unobtainableCount: 1,
    conditionalCount: 0,
    brokenButObtainableCount: 0,
  }), false);
  assert.equal(isSteamHuntersSetFullyObtainable({}), false);
});

test("Steam overview title fitting is one-line measured sizing and set status has no legacy card grid", async () => {
  const [overviewSource, sharedOverviewSource, statusSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-steam-game-overview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-game-overview-layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-steam-hunters-game-sections.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(sharedOverviewSource, /MIN_GAME_TITLE_FONT_SIZE_PX = 15/u);
  assert.match(sharedOverviewSource, /element\.scrollWidth <= element\.clientWidth/u);
  assert.match(sharedOverviewSource, /whiteSpace: "nowrap"/u);
  assert.match(sharedOverviewSource, /textOverflow: "ellipsis"/u);
  assert.match(sharedOverviewSource, /maxLines = 1/u);
  assert.match(sharedOverviewSource, /maxLines > 1[\s\S]*WebkitLineClamp: maxLines[\s\S]*whiteSpace: "normal"/u);
  assert.match(overviewSource, /DeckyFullScreenGameOverviewLayout/u);
  assert.match(overviewSource, /title="Achievement Set Status"/u);
  assert.match(overviewSource, /Game data refreshed \$\{refreshTime\}/u);
  assert.doesNotMatch(overviewSource, /releaseDate=\{releaseDate\}/u);
  assert.ok(
    overviewSource.indexOf("<DeckySteamHuntersSetDetailsSection") <
      overviewSource.indexOf("<DeckySteamHuntersCompletionHealthSection"),
  );
  assert.match(statusSource, /getSteamHuntersAchievementSetStatusPresentation/u);
  assert.doesNotMatch(statusSource, /<DeckyFullScreenGameProgressStatGrid columns=\{4\} gap=\{6\}>/u);
});

test("Steam restoration target prefers exact, then nearest previous id, then first current id", () => {
  assert.equal(selectSteamAchievementRestorationTarget({
    focusedAchievementId: "API_37",
    previousVisibleAchievementIds: ["API_36", "API_37", "API_38"],
    currentVisibleAchievementIds: ["API_36", "API_37"],
  }), "API_37");
  assert.equal(selectSteamAchievementRestorationTarget({
    focusedAchievementId: "API_37",
    previousVisibleAchievementIds: ["API_36", "API_37", "API_38"],
    currentVisibleAchievementIds: ["API_36", "API_38"],
  }), "API_36");
  assert.equal(selectSteamAchievementRestorationTarget({
    focusedAchievementId: "API_37",
    previousVisibleAchievementIds: ["API_36", "API_37", "API_38"],
    currentVisibleAchievementIds: ["API_99"],
  }), "API_99");
});

test("Steam fullscreen loading waits for its SteamHunters follow-up result", () => {
  const snapshot: GameDetailSnapshot = {
    game: {
      providerId: "steam",
      appid: 1672970,
      gameId: "1672970",
      title: "Minecraft Dungeons",
      status: "in_progress",
      summary: { unlockedCount: 1, totalCount: 2, completionPercent: 50 },
      metrics: [],
    },
    achievements: [],
  };
  const enrichedSnapshot = composeSteamGameDetailWithSteamHunters(snapshot, {
    app: { appId: 1672970, achievementCount: 2, tags: [] },
    achievements: [],
    groups: [],
  });
  const retroSnapshot: GameDetailSnapshot = {
    ...snapshot,
    game: { ...snapshot.game, providerId: "retroachievements" },
  };

  assert.equal(isDeckySteamFullscreenEnrichmentPending(snapshot, undefined), true);
  assert.equal(isDeckySteamFullscreenEnrichmentPending(snapshot, snapshot), false);
  assert.equal(isDeckySteamFullscreenEnrichmentPending(enrichedSnapshot, undefined), false);
  assert.equal(isDeckySteamFullscreenEnrichmentPending(retroSnapshot, undefined), false);
});

test("Steam detail return restoration is explicitly requested per game", () => {
  resetSteamGameSectionPageStatesForTests();
  requestSteamGameSectionRestoration("steam", "42");
  assert.equal(readSteamGameSectionPageState("steam", "42").restoreRequested, true);
});

test("leaving a Steam game page returns its next visit to Overview", () => {
  resetSteamGameSectionPageStatesForTests();
  updateSteamGameSectionPageState("steam", "42", (current) => ({
    ...current,
    activeSection: "achievements",
    achievements: {
      ...current.achievements,
      achievementFilter: "locked",
      scrollTop: 760,
    },
  }));

  resetSteamGameSectionActiveSection("steam", "42");

  const state = readSteamGameSectionPageState("steam", "42");
  assert.equal(state.activeSection, "overview");
  assert.equal(state.achievements.achievementFilter, "locked");
  assert.equal(state.achievements.scrollTop, 760);
});

test("full-screen footer shoulder navigation consumes handled GamepadUI presses", () => {
  const navigations: string[] = [];
  const cancellations: string[] = [];
  const createEvent = (button: number, isRepeat = false) => ({
    detail: { button, source: 0, is_repeat: isRepeat },
    preventDefault: () => cancellations.push("default"),
    stopPropagation: () => cancellations.push("propagation"),
    stopImmediatePropagation: () => cancellations.push("immediate"),
  });
  const actions = {
    onPrevious: () => navigations.push("previous"),
    onNext: () => navigations.push("next"),
  };

  assert.equal(handleDeckyFullScreenFooterShoulderButtonDown(
    createEvent(DECKY_FULLSCREEN_FOOTER_SHOULDER_BUTTON.right),
    actions,
  ), true);
  assert.equal(handleDeckyFullScreenFooterShoulderButtonDown(
    createEvent(DECKY_FULLSCREEN_FOOTER_SHOULDER_BUTTON.left),
    actions,
  ), true);
  assert.equal(handleDeckyFullScreenFooterShoulderButtonDown(
    createEvent(DECKY_FULLSCREEN_FOOTER_SHOULDER_BUTTON.right, true),
    actions,
  ), true);
  assert.deepEqual(navigations, ["next", "previous"]);
  assert.deepEqual(cancellations, [
    "default",
    "propagation",
    "immediate",
    "default",
    "propagation",
    "immediate",
    "default",
    "propagation",
    "immediate",
  ]);
});

test("full-screen footer shoulder navigation ignores unrelated GamepadUI presses", () => {
  const calls: string[] = [];
  const handled = handleDeckyFullScreenFooterShoulderButtonDown({
    detail: { button: 1, source: 0 },
    preventDefault: () => calls.push("default"),
    stopPropagation: () => calls.push("propagation"),
    stopImmediatePropagation: () => calls.push("immediate"),
  }, {
    onPrevious: () => calls.push("previous"),
    onNext: () => calls.push("next"),
  });

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});

test("Steam section navigation advances every rapid shoulder press from the latest target", () => {
  const sections: readonly DeckyFullScreenGameSection[] = [
    { id: "overview", label: "Overview" },
    { id: "achievements", label: "Achievements" },
    { id: "achievement-groups", label: "DLC / Groups" },
    { id: "community", label: "Community" },
  ];
  let activeSection: DeckyFullScreenGameSection["id"] = "overview";

  activeSection = getAdjacentFullScreenGameSectionId(sections, activeSection, "next");
  activeSection = getAdjacentFullScreenGameSectionId(sections, activeSection, "next");
  activeSection = getAdjacentFullScreenGameSectionId(sections, activeSection, "next");

  assert.equal(activeSection, "community");
  assert.equal(getAdjacentFullScreenGameSectionId(sections, activeSection, "next"), "overview");
  assert.equal(getAdjacentFullScreenGameSectionId(sections, activeSection, "previous"), "achievement-groups");
});

test("Steam game sections unmount inactive focus trees behind one stable footer owner", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /visitedSteamSections/u);
  assert.match(source, /isSteamProvider && activeSteamSection === "overview"/u);
  assert.match(source, /activeSteamSection === "achievements"/u);
  assert.match(source, /activeSteamSection === "achievement-groups"/u);
  assert.match(source, /activeSteamSection === "community"/u);
  assert.doesNotMatch(source, /display: activeSteamSection/u);
  assert.match(source, /restorationOrderedAchievements = useMemo/u);
  assert.match(source, /loadedSnapshot === undefined \|\| isWaitingForSteamHuntersEnrichment/u);
  assert.match(source, /forceRefresh: initialSectionState\?\.restoreRequested !== true/u);
  assert.match(source, /restorationSteamHuntersViewModel = useMemo/u);
  assert.match(source, /MemoizedDeckyFullScreenAchievementBrowser = memo/u);
  assert.match(source, /onAchievementFilterChange=\{handleAchievementFilterChange\}/u);
  assert.match(source, /MemoizedDeckySteamAchievementGroupsSection/u);
  assert.match(source, /activeSectionRoot[\s\S]*activeSectionRoot\?\.querySelectorAll/u);
  assert.match(source, /jumpSteamAchievementsToTop[\s\S]*data-achievement-companion-steam-filter-control/u);
  assert.match(source, /onJumpToTop=\{jumpSteamAchievementsToTop\}/u);
  assert.equal(
    (source.match(/<DeckyFullScreenGameSectionNavigation/gu) ?? []).length,
    1,
    "the Steam game page must keep one stable global footer/input owner",
  );
});

test("Steam achievements and groups use nested GamepadUI focus primitives", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-steam-achievement-groups-section.tsx", import.meta.url),
    "utf8",
  );
  const browserSource = await readFile(
    new URL("../src/platform/decky/decky-full-screen-achievement-browser.tsx", import.meta.url),
    "utf8",
  );
  const rowSource = await readFile(
    new URL("../src/platform/decky/decky-full-screen-achievement-row.tsx", import.meta.url),
    "utf8",
  );
  const gamePageSource = await readFile(
    new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /flow-children="vertical"/u);
  assert.match(source, /navEntryPreferPosition=\{NavEntryPositionPreferences\.FIRST\}/u);
  assert.match(source, /sectionIndex === 0 \? \{ onGamepadDirection: handleFirstGroupDirection \} : \{\}/u);
  assert.match(source, /GamepadButton\.DIR_UP[\s\S]*GamepadButton\.DIR_DOWN/u);
  assert.match(source, /groupControls\[1\][\s\S]*takeDeckySteamGamepadFocus\(target\)/u);
  assert.match(source, /deck_ui_navigation\.wav[\s\S]*sound\.play\(\)/u);
  assert.doesNotMatch(source, /groupControlsRef|stopImmediatePropagation/u);
  assert.match(browserSource, /onJumpToTop !== undefined \? \{ onJumpToTop \}/u);
  assert.match(rowSource, /onOptionsActionDescription: "Top"[\s\S]*onOptionsButton:[\s\S]*onJumpToTop\(\)/u);
  assert.match(browserSource, /onOptionsActionDescription: "Top"[\s\S]*onOptionsButton:[\s\S]*onJumpToTop\(\)/u);
  assert.match(gamePageSource, /activeSteamSection === "achievements" \? \{ secondaryActionLabel: "Top", onSecondaryAction: jumpSteamAchievementsToTop \} : \{\}/u);
  assert.match(browserSource, /flow-children="vertical"/u);
});

test("achievement modal reuses the loaded game snapshot", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-achievement-detail-modal.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /loadDeckyGameDetailState\(providerId, gameId, \{ forceRefresh: false \}\)/u);
});
