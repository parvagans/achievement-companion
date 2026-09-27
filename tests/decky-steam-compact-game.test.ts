import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compactGameSource = readFileSync(
  "src/platform/decky/decky-steam-compact-game-overview.tsx",
  "utf8",
);
const gameDetailSource = readFileSync("src/platform/decky/decky-game-detail-view.tsx", "utf8");
const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
const steamHuntersSectionsSource = readFileSync(
  "src/platform/decky/decky-steam-hunters-game-sections.tsx",
  "utf8",
);
const compactCancelBridgeSource = readFileSync(
  "src/platform/decky/decky-full-screen-cancel-bridge.ts",
  "utf8",
);

test("Steam compact game overview uses the refined narrow-panel hierarchy and optional SteamHunters enrichment", () => {
  assert.match(compactGameSource, /padding: "0 16px 4px"/u);
  assert.match(compactGameSource, /height: 124/u);
  assert.match(compactGameSource, /MIN_TITLE_FONT_SIZE_PX = 12/u);
  assert.match(compactGameSource, /function SteamCompactGameTitle/u);
  assert.match(compactGameSource, /useLayoutEffect/u);
  assert.match(compactGameSource, /Open Full-Screen/u);
  assert.match(compactGameSource, /View Achievements/u);
  assert.match(compactGameSource, /DeckySteamCompactAction/u);
  assert.match(compactGameSource, /Your Progress/u);
  assert.match(compactGameSource, /Play Time/u);
  assert.match(compactGameSource, /Steam Deck/u);
  assert.match(compactGameSource, /steamDeckIconUrl/u);
  assert.match(compactGameSource, /gridTemplateColumns: "26px minmax\(0, 1fr\)"/u);
  assert.match(compactGameSource, /alignItems: "center", justifyContent: "center"/u);
  assert.match(compactGameSource, /Achievement Set Status \(SteamHunters\)/u);
  assert.match(compactGameSource, /No DLC required/u);
  assert.match(compactGameSource, /conditions/u);
  assert.match(compactGameSource, /broken but obtainable/u);
  assert.match(compactGameSource, /SteamHunters Stats/u);
  assert.match(compactGameSource, /My Points/u);
  assert.match(compactGameSource, /progressPoints\?\.earned/u);
  assert.match(compactGameSource, /My Unlock %/u);
  assert.match(compactGameSource, /Duration/u);
  assert.match(compactGameSource, /getPersonalAchievementDuration/u);
  assert.match(compactGameSource, /Game Info/u);
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
  assert.match(gameDetailSource, /onViewAchievements=\{onOpenFullScreenAchievements\}/u);
  assert.match(bootstrapSource, /updateSteamGameSectionPageState\(game\.providerId, game\.gameId/u);
  assert.match(bootstrapSource, /activeSection: "achievements"/u);
  assert.match(bootstrapSource, /<DeckyCompactLoadingState[\s\S]*Fetching the latest Steam game and SteamHunters data\./u);
  assert.match(steamHuntersSectionsSource, /export function getSteamHuntersAchievementSetStatusPresentation/u);
  assert.match(steamHuntersSectionsSource, /export function getSteamHuntersAchievementSetStatusSummary/u);
});

test("Steam compact game B handler is scoped to the mounted view instead of requiring a visible Back action", () => {
  assert.match(compactCancelBridgeSource, /const compactProviderCancelCallbacks = new Map<Window, \(\) => void>\(\)/u);
  assert.match(compactCancelBridgeSource, /export function registerCompactProviderCancelCallback/u);
  assert.match(compactCancelBridgeSource, /compactProviderCancelCallbacks\.set\(ownerWindow, onCancel\)/u);
  assert.match(compactCancelBridgeSource, /compactProviderCancelCallbacks\.delete\(ownerWindow\)/u);
  assert.match(compactCancelBridgeSource, /const compactGameDetailCancelCallbacks = new Map<Window, \(\) => void>\(\)/u);
  assert.match(compactCancelBridgeSource, /export function registerCompactGameDetailCancelCallback/u);
  assert.match(compactCancelBridgeSource, /compactGameDetailCancelCallbacks\.set\(ownerWindow, onCancel\)/u);
  assert.match(compactCancelBridgeSource, /compactGameDetailCancelCallbacks\.delete\(ownerWindow\)/u);
  assert.match(compactCancelBridgeSource, /callback\(\);\s*return;/u);
});
