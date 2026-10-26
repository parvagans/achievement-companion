import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  registerCompactProviderCancelCallback,
  removeDeckyCompactCancelBridges,
  setDeckyCompactCancelBridgesEnabled,
} from "../src/platform/decky/decky-full-screen-cancel-bridge";

const compactGameSource = readFileSync(
  "src/platform/decky/decky-steam-compact-game-overview.tsx",
  "utf8",
);
const gameDetailSource = readFileSync("src/platform/decky/decky-game-detail-view.tsx", "utf8");
const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
const compactOverviewActionsSource = readFileSync(
  "src/platform/decky/decky-compact-game-overview-actions.tsx",
  "utf8",
);
const compactOverviewUpNextSource = readFileSync(
  "src/platform/decky/decky-compact-game-overview-up-next.tsx",
  "utf8",
);
const steamHuntersSectionsSource = readFileSync(
  "src/platform/decky/decky-steam-hunters-game-sections.tsx",
  "utf8",
);

test("Steam compact game overview uses the refined narrow-panel hierarchy and optional SteamHunters enrichment", () => {
  assert.match(compactGameSource, /padding: "0 16px 4px"/u);
  assert.match(compactGameSource, /COMPACT_STEAM_BANNER_HEIGHT_PX = 108/u);
  assert.match(compactGameSource, /height=\{COMPACT_STEAM_BANNER_HEIGHT_PX\}/u);
  assert.match(compactGameSource, /function SteamCompactGameTitle/u);
  assert.match(compactGameSource, /DeckyResponsiveGameTitle[\s\S]*preferredFontSize=\{18\}[\s\S]*minimumFontSize=\{14\}/u);
  assert.doesNotMatch(compactGameSource, /<span>Steam<\/span>/u);
  assert.match(compactGameSource, /useLayoutEffect/u);
  assert.match(compactGameSource, /DeckyCompactGameOverviewActions/u);
  assert.match(compactGameSource, /DeckyCompactGameOverviewUpNext/u);
  assert.match(compactOverviewActionsSource, /Open Full-Screen/u);
  assert.match(compactOverviewActionsSource, /Achievements/u);
  assert.match(compactOverviewActionsSource, /DeckySteamCompactAction/u);
  assert.match(compactOverviewActionsSource, /requestDeckySteamGamepadFocusAfterMount\(target\)/u);
  assert.match(compactOverviewUpNextSource, /Your Progress/u);
  assert.match(compactOverviewUpNextSource, /limit: 3/u);
  assert.match(compactOverviewUpNextSource, /Show More Suggestions/u);
  assert.match(compactOverviewUpNextSource, /Show Less/u);
  assert.match(compactOverviewUpNextSource, /showCaption=\{false\}/u);
  assert.match(compactOverviewUpNextSource, /onSecondaryActionDescription: "Skip"/u);
  assert.match(compactOverviewUpNextSource, /onOptionsActionDescription: "List"/u);
  assert.match(compactGameSource, /Play Time/u);
  assert.match(compactGameSource, /Steam Deck/u);
  assert.match(compactGameSource, /steamDeckIconUrl/u);
  assert.match(compactGameSource, /gridTemplateColumns: "26px minmax\(0, 1fr\)"/u);
  assert.match(compactGameSource, /alignItems: "center", justifyContent: "center"/u);
  assert.match(compactGameSource, /Achievement Set Status \(SteamHunters\)/u);
  assert.match(compactGameSource, /No DLC required/u);
  assert.match(compactGameSource, /conditions/u);
  assert.match(compactGameSource, /broken but obtainable/u);
  assert.match(compactGameSource, /My SteamHunters Stats/u);
  assert.match(compactGameSource, /My Steam Stats/u);
  assert.match(compactGameSource, /Median 100%/u);
  assert.match(compactGameSource, /Fastest 100%/u);
  assert.match(compactGameSource, />Points<\/span>/u);
  assert.match(compactGameSource, /progressPoints\?\.earned/u);
  assert.match(compactGameSource, /settings\.steamHuntersPersonalDataEnabled/u);
  assert.match(compactGameSource, /hasMeaningfulSteamHuntersProfile\(steamHuntersProfileState\.data\)/u);
  assert.match(compactGameSource, /getDeckySteamHuntersProfileStateForFullScreenEntryInitial\(STEAM_PROVIDER_ID\)/u);
  assert.match(compactGameSource, /showSteamHuntersPoints \? <div/u);
  assert.match(compactGameSource, /Unlock %/u);
  assert.match(compactGameSource, /Duration/u);
  assert.match(compactGameSource, /getPersonalAchievementDuration/u);
  assert.match(compactOverviewActionsSource, /Game Info/u);
  assert.match(compactGameSource, /openDeckyOverviewDetails/u);
  assert.doesNotMatch(compactGameSource, /<CompactGameSectionFocusTarget label="Game Info">/u);
  assert.match(compactGameSource, /loadDeckySteamHuntersEnrichedGameDetail\(snapshot\)/u);
  assert.match(compactGameSource, /getSteamHuntersAchievementSetStatusPresentation/u);
  assert.match(compactGameSource, /registerCompactGameDetailCancelCallback/u);
  assert.doesNotMatch(compactGameSource, /<PanelSection title="GAME OVERVIEW"/u);

  assert.match(gameDetailSource, /DeckySteamCompactGameOverview/u);
  assert.match(gameDetailSource, /if \(isSteamGame\) \{/u);
  const steamBranchStart = gameDetailSource.indexOf("if (isSteamGame) {");
  const retroBranchStart = gameDetailSource.indexOf("return (", steamBranchStart + 1);
  const steamBranchSource = gameDetailSource.slice(steamBranchStart, retroBranchStart);
  assert.ok(steamBranchStart >= 0 && retroBranchStart > steamBranchStart);
  assert.doesNotMatch(steamBranchSource, /<PanelSection title="ACHIEVEMENTS">/u);
  assert.match(gameDetailSource, /onViewAchievements=\{onOpenCompactAchievements\}/u);
  assert.match(bootstrapSource, /kind: "achievement-list"/u);
  assert.match(bootstrapSource, /<CompactAchievementListScreen/u);
  assert.match(bootstrapSource, /openCompactAchievementModal/u);
  assert.match(bootstrapSource, /function CompactAchievementDetailScreen/u);
  assert.match(bootstrapSource, /<DeckyCompactLoadingState[\s\S]*Fetching the latest Steam game and SteamHunters data\./u);
  assert.match(steamHuntersSectionsSource, /export function getSteamHuntersAchievementSetStatusPresentation/u);
  assert.match(steamHuntersSectionsSource, /export function getSteamHuntersAchievementSetStatusSummary/u);
});

test("Steam compact game B handler is scoped to the mounted view instead of requiring a visible Back action", () => {
  const ownerWindow = new EventTarget() as Window;
  const ownerDocument = { defaultView: ownerWindow, querySelectorAll: () => [] } as unknown as Document;
  const createVisibleElement = () => ({
    ownerDocument,
    isConnected: true,
    getClientRects: () => [{}],
  }) as unknown as Element;
  const calls: string[] = [];

  try {
    const removeOld = registerCompactProviderCancelCallback(createVisibleElement(), () => calls.push("old"));
    registerCompactProviderCancelCallback(createVisibleElement(), () => calls.push("latest"));
    removeOld();

    const firstEvent = new Event("vgp_oncancel", { cancelable: true });
    ownerWindow.dispatchEvent(firstEvent);
    assert.deepStrictEqual(calls, ["latest"]);
    assert.equal(firstEvent.defaultPrevented, true);

    setDeckyCompactCancelBridgesEnabled(false);
    ownerWindow.dispatchEvent(new Event("vgp_oncancel", { cancelable: true }));
    assert.deepStrictEqual(calls, ["latest"]);
  } finally {
    removeDeckyCompactCancelBridges();
    setDeckyCompactCancelBridgesEnabled(true);
  }
});
