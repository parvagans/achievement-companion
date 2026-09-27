import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compactProfileSource = readFileSync(
  "src/platform/decky/decky-steam-compact-profile.tsx",
  "utf8",
);
const dashboardSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
const indexSource = readFileSync("src/index.tsx", "utf8");

test("Steam compact profile matches the refined controller-first information hierarchy", () => {
  assert.match(compactProfileSource, /data-achievement-companion-steam-compact-profile/u);
  assert.match(compactProfileSource, /width: "100%"/u);
  assert.match(compactProfileSource, /padding: "0 16px 4px"/u);
  assert.doesNotMatch(compactProfileSource, /width: 352/u);
  assert.match(indexSource, /AC_decky_compact_logo\.png/u);
  assert.doesNotMatch(indexSource, /AC_main_logo\.png/u);

  assert.match(compactProfileSource, /<SectionHeader title="Profile"/u);
  assert.match(compactProfileSource, /Open Profile Full-Screen/u);
  assert.match(compactProfileSource, /title="SteamHunters Profile"/u);
  assert.match(compactProfileSource, /label="Points"/u);
  assert.match(compactProfileSource, /label="Points Rank"/u);
  assert.match(compactProfileSource, /label="Legendary Unlocks"/u);
  assert.match(compactProfileSource, /label="Completed Games"/u);
  assert.match(compactProfileSource, /title="Recent Activity"/u);
  assert.match(compactProfileSource, /title="Recently Played"/u);
  assert.match(compactProfileSource, />Profile Settings</u);

  assert.match(compactProfileSource, /function SteamCompactAction/u);
  const compactActionStart = compactProfileSource.indexOf("function SteamCompactAction");
  const compactActionEnd = compactProfileSource.indexOf("function getIconStyle", compactActionStart);
  const compactActionSource = compactProfileSource.slice(compactActionStart, compactActionEnd);
  assert.ok(compactActionStart >= 0);
  assert.ok(compactActionEnd > compactActionStart);
  assert.ok(compactActionSource.includes("<Focusable"));
  assert.ok(compactActionSource.includes("onActivate={onActivate}"));
  assert.ok(compactActionSource.includes("onCancel={onCancel}"));
  assert.match(compactActionSource, /role="button"/u);
  assert.match(compactActionSource, /tabIndex=\{0\}/u);
  assert.match(compactActionSource, /onGamepadFocus=/u);
  assert.match(compactActionSource, /if \(!isNavigable\)/u);
  assert.match(compactProfileSource, /scrollDeckyFocusTargetIntoView/u);
  assert.match(compactProfileSource, /scrollSteamCompactProfileToTop/u);
  assert.doesNotMatch(compactProfileSource, /getWideViewAllActionStyle/u);
  assert.doesNotMatch(compactProfileSource, /onGamepadDirection|createElement\("audio"\)|\.focus\(\)|\/sounds\//u);
  assert.match(compactProfileSource, /hasEnteredActionNavigation/u);
  assert.match(compactProfileSource, /onFocused=\{\(\) => \{/u);
  assert.ok(compactProfileSource.includes("<DeckyGameArtwork compact src={artworkUrl} size={34} title={game.title} />"));
  assert.ok(compactProfileSource.includes("Steam and SteamHunters refreshed ${refreshTime}"));
  assert.match(compactProfileSource, /recentAchievements\.map/u);
  assert.match(compactProfileSource, /recentlyPlayedGames\.map/u);
  const recentActivityHeader = compactProfileSource.indexOf('<SectionHeader title="Recent Activity" />');
  const recentActivityRows = compactProfileSource.indexOf('recentAchievements.map', recentActivityHeader);
  const recentActivityViewAll = compactProfileSource.indexOf('<ViewAllAction', recentActivityRows);
  const recentlyPlayedHeader = compactProfileSource.indexOf('<SectionHeader title="Recently Played" />');
  const recentlyPlayedRows = compactProfileSource.indexOf('recentlyPlayedGames.map', recentlyPlayedHeader);
  const recentlyPlayedViewAll = compactProfileSource.indexOf('<ViewAllAction', recentlyPlayedRows);
  assert.ok(recentActivityHeader >= 0 && recentActivityHeader < recentActivityRows);
  assert.ok(recentActivityRows < recentActivityViewAll && recentActivityViewAll < recentlyPlayedHeader);
  assert.ok(recentlyPlayedHeader < recentlyPlayedRows && recentlyPlayedRows < recentlyPlayedViewAll);

});

test("Steam compact profile loads optional SteamHunters data and preserves full-screen return context", () => {
  const steamDashboardStart = dashboardSource.indexOf("profile.providerId === STEAM_PROVIDER_ID");
  const compactProfileUsage = dashboardSource.indexOf("<DeckySteamCompactProfile", steamDashboardStart);
  assert.ok(steamDashboardStart >= 0);
  assert.ok(compactProfileUsage > steamDashboardStart);
  assert.ok(dashboardSource.includes("steamHuntersProfile={steamHuntersProfile}"));
  assert.match(dashboardSource, /onOpenAchievementHistory\(profile\.providerId\)/u);
  assert.match(dashboardSource, /onOpenCompletionProgress\(profile\.providerId\)/u);

  assert.match(bootstrapSource, /loadDeckySteamHuntersProfileState\(steamId\)/u);
  assert.match(bootstrapSource, /createDeckyFullscreenReturnContextForProviderDashboard\(providerId\)/u);
  assert.match(bootstrapSource, /openProviderFullScreenView\(providerId, "achievement-history"\)/u);
  assert.match(bootstrapSource, /openProviderFullScreenView\(providerId, "completion-progress"\)/u);
});
