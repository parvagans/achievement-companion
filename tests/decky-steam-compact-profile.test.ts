import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compactProfileSource = readFileSync(
  "src/platform/decky/decky-steam-compact-profile.tsx",
  "utf8",
);
const compactSettingsSource = readFileSync(
  "src/platform/decky/decky-steam-compact-settings.tsx",
  "utf8",
);
const compactLoadingSource = readFileSync(
  "src/platform/decky/decky-compact-loading-state.tsx",
  "utf8",
);
const dashboardSource = readFileSync("src/platform/decky/decky-dashboard-view.tsx", "utf8");
const bootstrapSource = readFileSync("src/platform/decky/bootstrap.tsx", "utf8");
const compactNavigationSource = readFileSync(
  "src/platform/decky/decky-compact-navigation.ts",
  "utf8",
);
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
  assert.match(compactProfileSource, /label="Legendary Unlocks"[\s\S]*tone="gold"/u);
  assert.match(compactProfileSource, /label="Completed Games"/u);
  assert.match(compactProfileSource, /title="Recent Activity"/u);
  assert.match(compactProfileSource, /title="Recently Played"/u);
  assert.match(compactProfileSource, />Steam Settings</u);

  assert.match(compactProfileSource, /export function DeckySteamCompactAction/u);
  const compactActionStart = compactProfileSource.indexOf("export function DeckySteamCompactAction");
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

test("provider and Steam use explicit native entry scopes without changing RetroAchievements", () => {
  const providerLauncherStart = bootstrapSource.indexOf("function ProviderLauncherCard");
  const providerLauncherEnd = bootstrapSource.indexOf("function formatSteamLibraryScanUpdatedLabel", providerLauncherStart);
  const providerLauncherSource = bootstrapSource.slice(providerLauncherStart, providerLauncherEnd);
  const steamActionStart = compactProfileSource.indexOf("export function DeckySteamCompactAction");
  const steamActionEnd = compactProfileSource.indexOf("function getIconStyle", steamActionStart);
  const steamActionSource = compactProfileSource.slice(steamActionStart, steamActionEnd);
  const retroProfileEntryStart = dashboardSource.indexOf("function OverviewProfileEntry");
  const retroProfileEntryEnd = dashboardSource.indexOf("function ProviderIdentityRow", retroProfileEntryStart);
  const retroProfileEntrySource = dashboardSource.slice(retroProfileEntryStart, retroProfileEntryEnd);

  assert.ok(providerLauncherStart >= 0 && providerLauncherEnd > providerLauncherStart);
  assert.ok(steamActionStart >= 0 && steamActionEnd > steamActionStart);
  assert.ok(retroProfileEntryStart >= 0 && retroProfileEntryEnd > retroProfileEntryStart);

  assert.match(bootstrapSource, /NavEntryPositionPreferences/u);
  assert.match(compactProfileSource, /NavEntryPositionPreferences/u);
  assert.match(
    bootstrapSource,
    /navEntryPreferPosition=\{NavEntryPositionPreferences\.PREFERRED_CHILD\}[\s\S]*preferredFocus/u,
  );
  assert.match(
    providerLauncherSource,
    /preferredFocus=\{preferredFocus\}/u,
    "provider cards preserve their controller focusability while accepting the entry target marker",
  );
  assert.match(bootstrapSource, /preferredFocus=\{index === 0\}/u);
  assert.match(bootstrapSource, /preferredFocus=\{visibleProviders\.length === 0\}/u);
  assert.match(bootstrapSource, /index === 0 \? \{ elementRef: setProviderInitialFocusTarget \} : \{\}/u);
  assert.match(
    bootstrapSource,
    /visibleProviders\.length === 0 \? \{ elementRef: setProviderInitialFocusTarget \} : \{\}/u,
  );

  assert.match(
    compactProfileSource,
    /<Focusable[\s\S]*navEntryPreferPosition=\{NavEntryPositionPreferences\.PREFERRED_CHILD\}[\s\S]*preferredFocus/u,
  );
  assert.match(steamActionSource, /preferredFocus=\{preferredFocus\}/u);
  assert.match(compactProfileSource, /ariaLabel="Open Steam profile full-screen"[\s\S]*preferredFocus/u);

  assert.doesNotMatch(retroProfileEntrySource, /navEntryPreferPosition|preferredFocus/u);

  assert.match(providerLauncherSource, /onActivate=\{onClick\}/u);
  assert.match(steamActionSource, /onCancel=\{onCancel\}/u);
  assert.match(retroProfileEntrySource, /onCancel=\{\(\) => \{/u);
});

test("Steam compact settings reuse the provider configuration and keep API credentials full-screen", () => {
  assert.match(dashboardSource, /DeckySteamCompactSettings/u);
  assert.match(dashboardSource, /isShowingSteamCompactSettings/u);
  assert.match(dashboardSource, /onOpenSettings=\{onOpenSteamCompactSettings\}/u);
  assert.match(dashboardSource, /onOpenApiSettings=\{onOpenSettings\}/u);
  assert.match(bootstrapSource, /includePlayedFreeGames/u);
  assert.match(compactSettingsSource, /data-achievement-companion-steam-compact-settings/u);
  assert.match(compactSettingsSource, /padding: "0 16px 4px"/u);
  assert.match(compactSettingsSource, /data-achievement-companion-steam-settings-initial-focus/u);
  assert.match(compactSettingsSource, /scrollTop = 0/u);
  assert.match(compactSettingsSource, /writeValidatedDeckySteamProviderConfig/u);
  assert.doesNotMatch(compactSettingsSource, /apiKeyDraft/u, "settings must not contain a second API-key field");
  assert.match(compactSettingsSource, /Recent Activity/u);
  assert.match(compactSettingsSource, /Recently Played/u);
  assert.match(compactSettingsSource, /Show free games/u);
  assert.match(compactSettingsSource, /API Settings/u);
  assert.match(compactSettingsSource, /getCompactSettingLabelStyle/u);
  assert.match(compactSettingsSource, /getCompactSettingDescriptionStyle/u);
  assert.match(compactSettingsSource, /getToggleFieldWrapperStyle/u);
  assert.match(compactSettingsSource, /function SteamCompactCountPicker/u);
  assert.match(compactSettingsSource, /data-achievement-companion-count-picker-option/u);
  assert.match(compactSettingsSource, /margin: "4px 12px 10px"/u);
  assert.match(compactSettingsSource, /padding: "7px 12px"/u);
  assert.doesNotMatch(compactSettingsSource, /DropdownItem/u);
});

test("Steam compact profile loads optional SteamHunters data and preserves compact state across fullscreen handoff", () => {
  const steamDashboardStart = dashboardSource.indexOf("profile.providerId === STEAM_PROVIDER_ID");
  const compactProfileUsage = dashboardSource.indexOf("<DeckySteamCompactProfile", steamDashboardStart);
  assert.ok(steamDashboardStart >= 0);
  assert.ok(compactProfileUsage > steamDashboardStart);
  assert.ok(dashboardSource.includes("steamHuntersProfile={steamHuntersProfile}"));
  assert.match(dashboardSource, /onOpenAchievementHistory\(profile\.providerId\)/u);
  assert.match(dashboardSource, /onOpenCompletionProgress\(profile\.providerId\)/u);

  assert.match(bootstrapSource, /loadDeckySteamHuntersProfileState\(steamId\)/u);
  assert.match(bootstrapSource, /useDeckyCompactNavigation\(\)/u);
  assert.match(bootstrapSource, /setDeckyCompactNavigation\(\{ kind: "provider-dashboard", providerId/u);
  assert.doesNotMatch(bootstrapSource, /preserveCompactSelectionForFullscreen|preserveCompactSelectionAfterFullscreen/u);
  assert.match(compactNavigationSource, /useSyncExternalStore/u);
  assert.match(compactNavigationSource, /kind: "provider-dashboard"/u);
  assert.match(bootstrapSource, /openProviderFullScreenView\(providerId, "achievement-history"\)/u);
  assert.match(bootstrapSource, /openProviderFullScreenView\(providerId, "completion-progress"\)/u);
});

test("Steam compact entry waits for fresh Steam and SteamHunters data before rendering the profile", () => {
  assert.match(bootstrapSource, /dashboardForceRefreshNextLoad = useRef\(providerId === STEAM_PROVIDER_ID\)/u);
  assert.match(bootstrapSource, /steamHuntersForceRefreshNextLoad = useRef\(providerId === STEAM_PROVIDER_ID\)/u);
  assert.match(bootstrapSource, /refreshDeckySteamHuntersProfileState\(steamId\)/u);
  assert.match(bootstrapSource, /const isSteamCompactProfileLoading =/u);
  assert.match(
    bootstrapSource,
    /isSteamCompactProfileLoading[\s\S]*steamHuntersProfileState\.status === "idle"[\s\S]*steamHuntersProfileState\.status === "loading"[\s\S]*steamHuntersProfileState\.status === "refreshing"/u,
  );
  assert.match(
    bootstrapSource,
    /isRenderableDashboardState\(visibleState\) && !isSteamCompactProfileLoading[\s\S]*<DeckyDashboardView/u,
  );
  assert.match(bootstrapSource, /<DeckyCompactLoadingState[\s\S]*Loading Steam profile\.\.\./u);
  assert.match(bootstrapSource, /Fetching the latest Steam profile and SteamHunters data\./u);
  assert.match(bootstrapSource, /<TopAlignedScrollViewport scrollKey="dashboard">/u);

  assert.match(compactLoadingSource, /data-achievement-companion-compact-loading-state/u);
  assert.match(compactLoadingSource, /justifyContent: "center"/u);
  assert.match(compactLoadingSource, /flex: "1 1 auto"/u);
  assert.match(compactLoadingSource, /findDeckyScrollContainerAncestor\(surface\)/u);
  assert.match(compactLoadingSource, /scrollContainer\.getBoundingClientRect\(\)\.bottom - surface\.getBoundingClientRect\(\)\.top/u);
  assert.match(compactLoadingSource, /padding: "18px 16px"/u);
  assert.match(compactLoadingSource, /spinner\?\.ownerDocument\.defaultView/u);
  assert.match(compactLoadingSource, /prefers-reduced-motion/u);
  assert.match(compactLoadingSource, /aria-busy=\{!isError\}/u);
  assert.doesNotMatch(compactLoadingSource, /actions|DeckyCompactPillAction/u);
});
