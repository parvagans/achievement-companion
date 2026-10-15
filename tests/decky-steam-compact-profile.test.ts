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

test("Steam compact XP progress keeps unavailable distinct from zero", () => {
  assert.match(compactProfileSource, /aria-valuenow=\{progress\.xpProgressPercent\}/u);
  assert.match(compactProfileSource, /aria-valuetext=\{progress\.xpProgressPercent === undefined \? "XP unavailable" : undefined\}/u);
  assert.match(compactProfileSource, /progress\.xpProgressPercent !== undefined \? <div style=\{getProgressFillStyle\(progress\.xpProgressPercent\)\} \/> : null/u);
  assert.doesNotMatch(compactProfileSource, /xpProgressPercent \?\? 0/u);
});

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
  assert.doesNotMatch(compactProfileSource, />Steam Settings</u);

  assert.match(compactProfileSource, /export function DeckySteamCompactAction/u);
  const compactActionStart = compactProfileSource.indexOf("export function DeckySteamCompactAction");
  const compactActionEnd = compactProfileSource.indexOf("function getIconStyle", compactActionStart);
  const compactActionSource = compactProfileSource.slice(compactActionStart, compactActionEnd);
  assert.ok(compactActionStart >= 0);
  assert.ok(compactActionEnd > compactActionStart);
  assert.ok(compactActionSource.includes("<Focusable"));
  assert.ok(compactActionSource.includes("onActivate={activate}"));
  assert.ok(compactActionSource.includes("onCancel={onCancel}"));
  assert.match(compactActionSource, /role="button"/u);
  assert.match(compactActionSource, /tabIndex=\{0\}/u);
  assert.match(compactActionSource, /onGamepadFocus=/u);
  assert.doesNotMatch(compactActionSource, /isNavigable/u);
  assert.match(compactProfileSource, /target\.scrollIntoView/u);
  assert.match(compactProfileSource, /scrollCompactViewToTop/u);
  assert.doesNotMatch(compactProfileSource, /getWideViewAllActionStyle/u);
  assert.doesNotMatch(compactProfileSource, /createElement\("audio"\)|\.focus\(\)|\/sounds\//u);
  assert.doesNotMatch(compactProfileSource, /hasEnteredActionNavigation/u);
  assert.match(compactProfileSource, /useQuickAccessVisible\(\)/u);
  assert.match(compactProfileSource, /subscribeToDeckySteamCompactFocusRestore/u);
  assert.match(compactProfileSource, /handledRestorationRequest\.current === restorationRequest/u);
  assert.match(compactProfileSource, /restorationElementRef\.current/u);
  assert.match(compactProfileSource, /!isQuickAccessVisible[\s\S]*handledRestorationRequest\.current === restorationRequest/u);
  assert.match(compactProfileSource, /requestDeckySteamGamepadFocusAfterMount\(target\)/u);
  assert.ok(compactProfileSource.includes("<DeckyGameArtwork compact src={artworkUrl} size={34} title={game.title} />"));
  assert.ok(compactProfileSource.includes('showSteamHuntersProfile ? "Steam and SteamHunters" : "Steam"'));
  assert.match(compactProfileSource, /visibleAchievements\.map/u);
  assert.match(compactProfileSource, /visibleGames\.map/u);
  const steamHuntersSection = compactProfileSource.indexOf('<SectionHeader title="SteamHunters Profile" />');
  const activityCalendar = compactProfileSource.indexOf("<CompactActivityCalendar", steamHuntersSection);
  const recentActivityHeader = compactProfileSource.indexOf('<SectionHeader title="Recent Activity" />');
  const recentActivityRows = compactProfileSource.indexOf('visibleAchievements.map', recentActivityHeader);
  const recentActivityViewAll = compactProfileSource.indexOf('<ViewAllAction', recentActivityRows);
  const recentlyPlayedHeader = compactProfileSource.indexOf('<SectionHeader title="Recently Played" />');
  const recentlyPlayedRows = compactProfileSource.indexOf('visibleGames.map', recentlyPlayedHeader);
  const recentlyPlayedViewAll = compactProfileSource.indexOf('<ViewAllAction', recentlyPlayedRows);
  assert.ok(steamHuntersSection >= 0 && steamHuntersSection < activityCalendar);
  assert.ok(activityCalendar < recentActivityHeader);
  assert.ok(recentActivityHeader >= 0 && recentActivityHeader < recentActivityRows);
  assert.ok(recentActivityRows < recentActivityViewAll && recentActivityViewAll < recentlyPlayedHeader);
  assert.ok(recentlyPlayedHeader < recentlyPlayedRows && recentlyPlayedRows < recentlyPlayedViewAll);

});

test("SteamHunters Points centers as a passive focus stop and Recently Played shows recency", () => {
  const metricStart = compactProfileSource.indexOf("function SteamProfileMetric(");
  const metricEnd = compactProfileSource.indexOf("function getListStyle", metricStart);
  const metricSource = compactProfileSource.slice(metricStart, metricEnd);
  assert.ok(metricStart >= 0 && metricEnd > metricStart);
  assert.match(metricSource, /if \(targetProps === undefined\) return <div/u);
  assert.match(metricSource, /<Focusable[\s\S]*noFocusRing[\s\S]*role="group"/u);
  assert.match(metricSource, /scrollIntoView\(\{ block: "center", inline: "nearest" \}\)/u);
  assert.match(metricSource, /getQamPassiveCardFocusStyle\(focused\)/u);
  assert.match(compactProfileSource, /label="Points"[\s\S]*targetProps=\{targetProps\(\{ kind: "steamhunters-points" \}\)\}/u);
  assert.match(compactProfileSource, /const lastPlayed = formatRelativeTime\(game\.lastPlayedAt\)/u);
  assert.match(compactProfileSource, /getLastPlayedStyle\(\)\}>\{lastPlayed\}/u);
  assert.match(compactProfileSource, /getPlaytimeStyle\(\)\}>\{playtime\}/u);
  assert.doesNotMatch(compactProfileSource, /\$\{playtime\} today/u);
});

test("Steam compact Activity calendar overrides configured list limits until its date is cleared", () => {
  assert.match(compactProfileSource, /STEAM_COMPACT_ACTIVITY_CALENDAR_WEEKS/u);
  assert.match(compactProfileSource, /buildSteamActivityStats\(activityEntries\)/u);
  assert.match(compactProfileSource, /filterSteamActivityEntriesForDay\(activityEntries, selectedActivityDay\)/u);
  assert.match(compactProfileSource, /buildSteamCompactActivityGamesForDay\(visibleAchievements, activityKnownGames\)/u);
  assert.match(compactProfileSource, /selectedActivityDay === day \? undefined : day/u);
  assert.match(compactProfileSource, /setDeckySteamCompactActivityDay\(nextDay\)/u);
  assert.match(compactProfileSource, /data-steam-compact-activity-calendar-day="true"/u);
  assert.match(compactProfileSource, /data-steam-compact-activity-calendar-active=\{active \? "true" : "false"\}/u);
  assert.match(compactProfileSource, /aria-label=\{`Activity calendar, \$\{status\}\. \$\{active \? "Press B to exit\." : "Press A to use\."\}`\}/u);
  assert.match(compactProfileSource, /const enterCalendar[\s\S]*setActive\(true\)/u);
  assert.match(compactProfileSource, /const exitCalendar[\s\S]*setActive\(false\)/u);
  assert.match(compactProfileSource, /onCancel=\{exitCalendar\}/u);
  assert.match(compactProfileSource, /gridTemplateColumns: `18px repeat\(\$\{weeks\}, minmax\(0, 1fr\)\)`/u);
  assert.match(compactProfileSource, /<SectionHeader title="Activity Calendar" \/>/u);
  assert.match(compactProfileSource, /<span>Press<\/span>[\s\S]*>A<\/span>[\s\S]*<span>to use<\/span>/u);
  assert.match(compactProfileSource, /onGamepadDirection=\{handleCompactCalendarDirection\}/u);
  assert.match(compactProfileSource, /data-steam-compact-profile-action/u);
  assert.match(compactProfileSource, /data-steam-compact-recent-activity-count=\{visibleAchievements\.length\}/u);
  assert.match(compactProfileSource, /data-steam-compact-recently-played-count=\{visibleGames\.length\}/u);
  assert.match(dashboardSource, /activityEntries=\{steamActivityEntries \?\? recentAchievements\}/u);
  assert.match(bootstrapSource, /loadDeckyAchievementHistoryStateForFullScreenEntry\(providerId\)/u);
});

test("Steam compact achievement details focus a child control instead of trapping QAM navigation on the page wrapper", () => {
  const surfaceStart = bootstrapSource.indexOf("function DeckySteamCompactAchievementDetailSurface");
  const surfaceEnd = bootstrapSource.indexOf("function CompactAchievementDetailScreen", surfaceStart);
  const surfaceSource = bootstrapSource.slice(surfaceStart, surfaceEnd);

  assert.ok(surfaceStart >= 0 && surfaceEnd > surfaceStart);
  assert.match(surfaceSource, /The page wrapper must not own focus[\s\S]*\[role='group'\]\[aria-label\^='Achievement '\]/u);
  assert.match(surfaceSource, /<div[\s\S]*aria-label="Achievement details"[\s\S]*\{children\}[\s\S]*<\/div>/u);
  assert.doesNotMatch(surfaceSource, /<Focusable/u);
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
    /providerListHasReceivedFocus[\s\S]*navEntryPreferPosition: NavEntryPositionPreferences\.PREFERRED_CHILD[\s\S]*preferredFocus/u,
  );
  assert.match(bootstrapSource, /onFocused=\{\(\) => setProviderListHasReceivedFocus\(true\)\}/u);
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
  assert.match(
    compactProfileSource,
    /ariaLabel="Open Steam profile full-screen"[\s\S]*\.\.\.targetProps\(\{ kind: "profile" \}\)/u,
  );
  assert.match(compactProfileSource, /preferredFocus: key === restorationKey/u);

  assert.doesNotMatch(retroProfileEntrySource, /navEntryPreferPosition|preferredFocus/u);

  assert.match(providerLauncherSource, /onActivate=\{onClick\}/u);
  assert.match(steamActionSource, /onCancel=\{onCancel\}/u);
  assert.match(retroProfileEntrySource, /onCancel=\{\(\) => \{/u);
});

test("Steam compact settings reuse the provider configuration and keep API credentials full-screen", () => {
  assert.match(dashboardSource, /DeckySteamCompactSettings/u);
  assert.match(dashboardSource, /isShowingSteamCompactSettings/u);
  assert.doesNotMatch(dashboardSource, /onOpenSettings=\{onOpenSteamCompactSettings\}/u);
  assert.match(dashboardSource, /onOpenApiSettings=\{onOpenSettings\}/u);
  assert.doesNotMatch(bootstrapSource, /includePlayedFreeGames/u);
  assert.match(compactSettingsSource, /data-achievement-companion-steam-compact-settings/u);
  assert.match(compactSettingsSource, /padding: "0 16px 4px"/u);
  assert.match(compactSettingsSource, /data-achievement-companion-steam-settings-initial-focus/u);
  assert.match(compactSettingsSource, /autoFocus=\{isInitialFocusTarget\}/u);
  assert.match(compactSettingsSource, /preferredFocus=\{isInitialFocusTarget\}/u);
  assert.doesNotMatch(compactSettingsSource, /takeDeckySteamGamepadFocus|\.focus\(\)|requestAnimationFrame|scrollTop = 0/u);
  assert.match(compactSettingsSource, /writeValidatedDeckySteamProviderConfig/u);
  assert.doesNotMatch(compactSettingsSource, /apiKeyDraft/u, "settings must not contain a second API-key field");
  assert.match(compactSettingsSource, /Recent Activity/u);
  assert.match(compactSettingsSource, /Recently Played/u);
  assert.match(compactSettingsSource, /label="Activity Calendar"/u);
  assert.match(compactSettingsSource, /options=\{ACTIVITY_CALENDAR_WEEK_OPTIONS\}/u);
  assert.match(compactSettingsSource, /steamCompactActivityCalendarWeeks/u);
  assert.doesNotMatch(compactSettingsSource, /Show free games/u);
  assert.match(compactSettingsSource, /API Settings/u);
  assert.match(compactSettingsSource, /getCompactSettingLabelStyle/u);
  assert.match(compactSettingsSource, /getCompactSettingDescriptionStyle/u);
  assert.doesNotMatch(compactSettingsSource, /getToggleFieldWrapperStyle/u);
  assert.match(compactSettingsSource, /const persistSettings = \(\): void =>/u);
  assert.match(compactSettingsSource, /saveQueueRef\.current = saveQueueRef\.current\.then/u);
  assert.match(compactSettingsSource, /onChange=\{updateRecentAchievementsCount\}/u);
  assert.match(compactSettingsSource, /onChange=\{updateRecentlyPlayedCount\}/u);
  assert.match(compactSettingsSource, /onChange=\{updateActivityCalendarWeeks\}/u);
  assert.doesNotMatch(compactSettingsSource, /Save Settings|Back to Steam Profile|Saving\.\.\./u);
  assert.match(bootstrapSource, /recentlyPlayedGames: state\.data\.recentlyPlayedGames\.slice\(0, dashboardPreferences\.recentlyPlayedCount\)/u);
  assert.match(bootstrapSource, /const dashboardSettingsSignature = providerId;/u);
  assert.doesNotMatch(bootstrapSource, /dashboardSettingsSignature = `[^`]*recentlyPlayedCount/u);
  assert.match(compactSettingsSource, /function SteamCompactCountPicker/u);
  assert.match(compactSettingsSource, /showContextMenu/u);
  assert.match(compactSettingsSource, /requestDeckySteamGamepadFocusAfterMount\(triggerRef\.current\)/u);
  assert.match(compactSettingsSource, /<Menu label=\{label\} onCancel=\{closeMenu\}>/u);
  assert.match(compactSettingsSource, /<MenuItem/u);
  assert.match(compactSettingsSource, /\{ bModal: true, bMatchWidth: true \}/u);
  assert.doesNotMatch(compactSettingsSource, /data-achievement-companion-count-picker-option/u);
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

  assert.match(bootstrapSource, /loadDeckySteamHuntersProfileStateForFullScreenEntry\(STEAM_PROVIDER_ID\)/u);
  assert.match(bootstrapSource, /useDeckyCompactNavigation\(\)/u);
  assert.match(bootstrapSource, /setDeckyCompactNavigation\(\{ kind: "provider-dashboard", providerId/u);
  assert.doesNotMatch(bootstrapSource, /preserveCompactSelectionForFullscreen|preserveCompactSelectionAfterFullscreen/u);
  assert.match(compactNavigationSource, /useSyncExternalStore/u);
  assert.match(compactNavigationSource, /kind: "provider-dashboard"/u);
  assert.match(bootstrapSource, /openProviderFullScreenView\(providerId, "achievement-history"\)/u);
  assert.match(bootstrapSource, /openProviderFullScreenView\(providerId, "completion-progress"\)/u);
});

test("Steam compact entry waits for enabled personal SteamHunters data before rendering", () => {
  assert.match(bootstrapSource, /initialProviderRefresh = useRef<boolean \| undefined>\(undefined\)/u);
  assert.match(bootstrapSource, /claimDeckyCompactSteamDashboardRefresh\(\)/u);
  assert.match(bootstrapSource, /dashboardForceRefreshNextLoad = useRef\(initialProviderRefresh\.current\)/u);
  assert.match(bootstrapSource, /if \(forceRefresh\) \{\s*startDeckyProviderProfileDataSession\(providerId\)/u);
  assert.match(bootstrapSource, /const steamHuntersProfileLoader = useMemo[\s\S]*loadDeckySteamHuntersProfileStateForFullScreenEntry\(STEAM_PROVIDER_ID\)/u);
  assert.match(bootstrapSource, /const isSteamCompactProfileLoading =/u);
  const steamLoadingGate = bootstrapSource.slice(
    bootstrapSource.indexOf("const isSteamCompactProfileLoading ="),
    bootstrapSource.indexOf("const isRetroAchievementsCompactProfileLoading ="),
  );
  assert.match(steamLoadingGate, /steamHuntersPersonalDataEnabled && steamId !== undefined/u);
  assert.match(steamLoadingGate, /steamHuntersProfileState\.status === "loading"/u);
  assert.match(
    bootstrapSource,
    /isRenderableDashboardState\(visibleState\) && !isCompactProfileLoading[\s\S]*<DeckyDashboardView/u,
  );
  assert.match(bootstrapSource, /<DeckyCompactLoadingState[\s\S]*Loading Steam profile\.\.\./u);
  assert.match(bootstrapSource, /Fetching the latest Steam profile and SteamHunters data\./u);
  assert.match(
    bootstrapSource,
    /<TopAlignedScrollViewport[\s\S]*restoreAfterLayout=\{selectedProviderId === STEAM_PROVIDER_ID \|\| selectedProviderId === "retroachievements"\}[\s\S]*scrollKey="dashboard"/u,
  );

  assert.match(compactLoadingSource, /data-achievement-companion-compact-loading-state/u);
  assert.match(compactLoadingSource, /justifyContent: "center"/u);
  assert.match(compactLoadingSource, /flex: "1 1 auto"/u);
  assert.match(compactLoadingSource, /findDeckyScrollContainerAncestor\(surface\)/u);
  assert.match(compactLoadingSource, /scrollContainer\.style\.overflowY = "hidden"/u);
  assert.match(compactLoadingSource, /scrollContainer\.style\.overflowY = previousOverflowY/u);
  assert.match(compactLoadingSource, /touchAction: "none"/u);
  assert.match(compactLoadingSource, /scrollContainer\.getBoundingClientRect\(\)\.bottom - surface\.getBoundingClientRect\(\)\.top/u);
  assert.match(compactLoadingSource, /ownerWindow\.requestAnimationFrame\(updateVisibleHeight\)/u);
  assert.match(compactLoadingSource, /ownerWindow\.cancelAnimationFrame\(updateFrame\)/u);
  assert.match(compactLoadingSource, /isError \? onCancel \?\? consumeCompactLoadingBack : consumeCompactLoadingBack/u);
  assert.match(compactLoadingSource, /registerCompactProviderCancelCallback\([\s\S]*surfaceRef\.current,[\s\S]*isError \? onCancel/u);
  assert.match(compactLoadingSource, /padding: "18px 16px"/u);
  assert.match(compactLoadingSource, /DeckyLoadingBrandMark compact isLoading=\{!isError\}/u);
  assert.match(compactLoadingSource, /aria-busy=\{!isError\}/u);
  assert.doesNotMatch(compactLoadingSource, /actions|DeckyCompactPillAction/u);
  assert.match(bootstrapSource, /Loading Steam profile\.\.\.[\s\S]*onCancel=\{onBackToProviders\}|onCancel=\{onBackToProviders\}[\s\S]*Loading Steam profile\.\.\./u);
  assert.match(bootstrapSource, /Fetching the latest Steam game and SteamHunters data\.[\s\S]*onCancel=\{onBackToDashboard\}|onCancel=\{onBackToDashboard\}[\s\S]*Fetching the latest Steam game and SteamHunters data\./u);
});

test("Steam compact profile uses a validated Steam scan or omits the personal metrics section", () => {
  assert.match(compactProfileSource, /settings\.steamHuntersPersonalDataEnabled\s*&& hasMeaningfulSteamHuntersProfile\(steamHuntersProfile\)/u);
  assert.match(compactProfileSource, /steamLibraryAchievementScanSummary\.scannedGameCount > 0/u);
  assert.match(compactProfileSource, /showSteamHuntersProfile \? <section[\s\S]*showSteamLibraryFallback \? <section/u);
  assert.match(compactProfileSource, /<SectionHeader title="Steam Library Scan"/u);
  assert.match(compactProfileSource, /showSteamLibraryFallback \? "steam-profile-metric" : "profile"/u);
  assert.match(dashboardSource, /steamLibraryAchievementScanSummary !== undefined \? \{ steamLibraryAchievementScanSummary \} : \{\}/u);
});
