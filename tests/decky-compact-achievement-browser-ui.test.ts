import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getSupportedCompactAchievementSorts,
  matchesCompactAchievementFilter,
  matchesCompactAchievementModeFilter,
  matchesCompactAchievementSearch,
  normalizeCompactAchievementSearchText,
  sortCompactAchievementRows,
  type CompactAchievementRowViewModel,
} from "../src/platform/decky/decky-compact-achievement-model";

const controlsSource = readFileSync(
  "src/platform/decky/decky-compact-achievement-browser-controls.tsx",
  "utf8",
);
const listSource = readFileSync(
  "src/platform/decky/decky-compact-achievement-list.tsx",
  "utf8",
);
const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");

function row(
  achievementId: string,
  title: string,
  overrides: Partial<CompactAchievementRowViewModel> = {},
): CompactAchievementRowViewModel {
  const description = overrides.description;
  return {
    achievementId,
    title,
    ...(description === undefined ? {} : { description }),
    isUnlocked: overrides.isUnlocked ?? false,
    statusText: overrides.statusText ?? "Locked",
    searchText: normalizeCompactAchievementSearchText(
      description === undefined ? title : `${title}\n${description}`,
    ),
    metadata: overrides.metadata ?? [],
    metadataPlacement: overrides.metadataPlacement ?? "rail",
    tone: overrides.tone ?? "locked",
    ...overrides,
  };
}

test("QAM achievement browser uses one native search and Sort & View toolbar", () => {
  assert.match(controlsSource, /TextField/u);
  assert.match(controlsSource, /placeholder="Search achievements…"/u);
  assert.match(controlsSource, /aria-label="Search achievements"/u);
  assert.match(controlsSource, /bShowClearAction=\{query\.length > 0\}/u);
  assert.match(controlsSource, /flow-children="left-right"/u);
  assert.match(controlsSource, /<span>Sort &amp; View<\/span>/u);
  assert.doesNotMatch(controlsSource, />View\s*&amp;\s*View</u);
});

test("Sort & View is a native compact popup with independent sections and focus return", () => {
  assert.match(controlsSource, /showContextMenu\(/u);
  assert.match(controlsSource, /<MenuGroup label="SORT BY">/u);
  assert.match(controlsSource, /<MenuSeparator \/>/u);
  assert.match(controlsSource, /<MenuGroup label="DISPLAY">/u);
  assert.match(controlsSource, /selected=\{sort === option\.value\}/u);
  assert.match(controlsSource, /selected=\{displayMode === option\.value\}/u);
  assert.match(controlsSource, /beginDeckyCompactPopup\(\)/u);
  assert.match(controlsSource, /releasePopupRef\.current\?\.\(\)/u);
  assert.match(controlsSource, /requestDeckySteamGamepadFocusAfterMount\(triggerRef\.current\)/u);
  assert.match(controlsSource, /\{ bModal: true, bFitToWindow: true, bShiftToFitWindow: true \}/u);
});

test("browser presents game context without a redundant provider badge", () => {
  const headingIndex = listSource.indexOf("<h2 style={getHeadingStyle(isSteam)}>Achievements</h2>");
  const gameTitleIndex = listSource.indexOf("aria-label={`Game: ${model.gameTitle}`}");
  const filtersIndex = listSource.indexOf("aria-label=\"Achievement filters\"");
  assert.ok(headingIndex >= 0);
  assert.ok(gameTitleIndex > headingIndex);
  assert.ok(filtersIndex > gameTitleIndex);
  assert.match(listSource, /title=\{model\.gameTitle\}/u);
  assert.doesNotMatch(listSource, /DeckyProviderBadge|provider-badge|Steam icon and Steam label/u);
});

test("compact presentation keeps two-line titles and removes only description and timestamp", () => {
  assert.match(listSource, /minHeight: compact \? 58 : undefined/u);
  assert.match(listSource, /WebkitLineClamp: 2/u);
  assert.match(listSource, /displayMode === "detailed" && model\.description !== undefined/u);
  assert.match(listSource, /displayMode === "detailed" && model\.timestampText !== undefined/u);
  assert.match(listSource, /model\.metadata\.map/u);
  assert.match(listSource, /model\.stateIndicator/u);
  assert.match(listSource, /DeckyAchievementTypeBadge/u);
});

test("search composes with RetroAchievements mode and status filters", () => {
  const rows = [
    row("hardcore-portal", "Portal Champion", {
      description: "Finish every chamber.",
      isUnlocked: true,
      statusText: "Unlocked",
      unlockMode: "hardcore",
      tone: "hardcore",
    }),
    row("softcore-portal", "Portal Tourist", {
      description: "Visit the test chambers.",
      isUnlocked: true,
      statusText: "Unlocked",
      unlockMode: "softcore",
      tone: "softcore",
    }),
    row("locked-portal", "Portal Master", {
      description: "Complete the final portal challenge.",
    }),
    row("hardcore-other", "Speed Runner", {
      description: "Finish quickly.",
      isUnlocked: true,
      statusText: "Unlocked",
      unlockMode: "hardcore",
      tone: "hardcore",
    }),
  ];

  const apply = (mode: "all" | "hardcore" | "softcore", status: "all" | "unlocked" | "locked", query: string) =>
    rows.filter((candidate) =>
      matchesCompactAchievementModeFilter(candidate, mode)
      && matchesCompactAchievementFilter(candidate, status)
      && matchesCompactAchievementSearch(candidate, query));

  assert.deepEqual(apply("hardcore", "unlocked", "portal").map(({ achievementId }) => achievementId), [
    "hardcore-portal",
  ]);
  assert.deepEqual(apply("softcore", "unlocked", "test chambers").map(({ achievementId }) => achievementId), [
    "softcore-portal",
  ]);
  assert.deepEqual(apply("hardcore", "locked", "portal").map(({ achievementId }) => achievementId), [
    "locked-portal",
  ]);
  assert.equal(apply("hardcore", "unlocked", "").length, 2);
});

test("sort availability follows real metadata and missing values remain last", () => {
  const rows = [
    row("complete", "Complete", { rarityPercent: 8, pointsValue: 12, unlockedAt: 500 }),
    row("rarity-only", "Rarity", { rarityPercent: 2 }),
    row("missing", "Missing"),
  ];
  const supported = getSupportedCompactAchievementSorts(rows);
  assert.ok(supported.includes("rarity-asc"));
  assert.ok(supported.includes("points-desc"));
  assert.ok(supported.includes("recently-unlocked"));
  assert.deepEqual(sortCompactAchievementRows(rows, "rarity-asc").map(({ achievementId }) => achievementId), [
    "rarity-only", "complete", "missing",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "points-desc").map(({ achievementId }) => achievementId), [
    "complete", "rarity-only", "missing",
  ]);
  assert.deepEqual(sortCompactAchievementRows(rows, "recently-unlocked").map(({ achievementId }) => achievementId), [
    "complete", "rarity-only", "missing",
  ]);
  assert.deepEqual(getSupportedCompactAchievementSorts([row("plain", "Plain")]), [
    "default", "name-asc", "name-desc",
  ]);
});

test("Up Next list navigation requests a temporary reveal without resetting browser state", () => {
  assert.ok((bootstrapSource.match(/requestDeckyCompactAchievementReveal\(/gu) ?? []).length >= 2);
  assert.ok((bootstrapSource.match(/clearDeckyCompactAchievementRevealRequest\(/gu) ?? []).length >= 2);
  assert.doesNotMatch(bootstrapSource, /writeDeckyCompactAchievementPageState/u);
  assert.match(listSource, /const visibleRows = revealOverrideActive && revealTarget !== undefined \? \[revealTarget\] : sortedRows/u);
  assert.match(listSource, /Showing selected achievement/u);
  assert.match(listSource, /if \(revealRequestRef\.current\?\.achievementId === achievementId\) return/u);
  assert.match(listSource, /clearDeckyCompactAchievementRevealRequest\(model\.providerId, model\.gameId, request\.requestId\)/u);
});
