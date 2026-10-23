import { Focusable, NavEntryPositionPreferences, type FocusableProps } from "@decky/ui";
import type { AchievementHistorySnapshot, RecentUnlock } from "@core/domain";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FocusEventHandler, type JSX, type RefCallback, type RefObject } from "react";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { registerDeckyFullscreenSubviewNavigation } from "./decky-full-screen-subview-navigation";
import { DeckyRetroAchievementsGameIcon, DECKY_RA_FULLSCREEN_GAME_ICON_COLUMN_WIDTH } from "./decky-retroachievements-game-icon";
import { DeckyFullScreenFooterOverlay, RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS } from "./decky-full-screen-footer-overlay";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView, scrollDeckyFocusTargetToTop } from "./decky-focus-scroll";
import { DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS, type SteamActivityCalendarWeeks } from "./decky-steam-activity-calendar-model";
import { getSteamFullscreenGameArtworkUrlByGameId, STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT, STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH, STEAM_FULLSCREEN_GAME_ROW_HEIGHT } from "./decky-steam-game-artwork";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { jumpDeckySteamProfileTabToTop } from "./decky-steam-profile-jump-top";
import { steamTheme } from "./steam-theme";
import { useDeckySettings } from "./decky-settings";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { raTheme } from "./ra-theme";
import { ActivityAnalytics } from "./decky-full-screen-activity-analytics";
import { ActivityFilterButton, ActivityDropdown, getCardStyle, handleActivityRowDirection } from "./decky-full-screen-activity-controls";
import { ACTIVITY_TIME_OPTIONS, getActivityUnlockTime as getUnlockTime, groupActivityEntries, pageActivityGroups, isActivityPresetAvailable, selectActivityHistory, sortActivityEntries } from "./decky-full-screen-activity-model";
import { clearDeckyActivityFilters, hasActivityTemporaryFilters, readDeckyActivityPageState, subscribeDeckyActivityPageState, rememberDeckyActivityAnalyticsFocus, rememberDeckyActivityFilter, rememberDeckyActivityFocusTarget, rememberDeckyActivityGame, rememberDeckyActivityMode, rememberDeckyActivityPeriod, rememberDeckyActivityRenderLimit, rememberDeckyActivityScrollTop, rememberDeckyActivitySort, rememberDeckyActivitySubview, type ActivitySelectedPeriod, type ActivitySubview } from "./decky-steam-full-screen-activity-state";

type ActivityGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;
const ACTIVITY_TOP_PADDING_PX = 43;
const ACTIVITY_FOOTER_CLEARANCE_PX = 48;
const ACTIVITY_CONTENT_GUTTER_PX = 4;
const ACTIVITY_LIST_RIGHT_GUTTER_PX = 5;
const ACTIVITY_DATE_GROUP_PADDING_PX = 6;
const ACTIVITY_DATE_GROUP_BORDER_PX = 1;
const STEAM_ACTIVITY_RENDER_STEP = 24;
const triggerHintStyle: CSSProperties = {
  display: "grid", placeItems: "center", minHeight: 24, borderRadius: steamTheme.radius.small,
  border: `1px solid ${steamTheme.color.borderStrong}`, color: steamTheme.color.textSecondary,
  background: steamTheme.surface.contentStat, fontSize: 11, fontWeight: 800,
};

function formatUnlockDate(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return "Date unavailable";
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPageStyle(): CSSProperties {
  return {
    height: "100%",
    minHeight: 0,
    padding: `${ACTIVITY_TOP_PADDING_PX}px 12px ${ACTIVITY_FOOTER_CLEARANCE_PX}px`,
    boxSizing: "border-box",
    overflow: "clip",
    background: steamTheme.surface.page,
    color: steamTheme.color.textPrimary,
  };
}

function AchievementActivityRow({ elementRef, entry, rowIndex, providerId, listRef, onOpenAchievementDetail, onBack, onRevealMore }: {
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly entry: RecentUnlock;
  readonly rowIndex: number;
  readonly providerId: string;
  readonly listRef: RefObject<HTMLDivElement | null>;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onBack: () => void;
  readonly onRevealMore: (lastRowIndex: number) => boolean;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const timestamp = getUnlockTime(entry);
  const isRa = providerId === RETROACHIEVEMENTS_PROVIDER_ID;
  const heroArtworkUrl = isRa
    ? entry.game.coverImageUrl
    : getSteamFullscreenGameArtworkUrlByGameId(entry.game.gameId, {
        ...(entry.game.coverImageUrl !== undefined ? { coverImageUrl: entry.game.coverImageUrl } : {}),
      });
  const focusGeneration = useRef(0);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const focusRow = (target: EventTarget | null): void => {
    const generation = ++focusGeneration.current;
    const isStillFocused = (): boolean => focusGeneration.current === generation;
    setFocused(true);
    if (rowIndex === 0) {
      scrollDeckyFocusTargetToTop(rowRef.current ?? target, isStillFocused, listRef.current);
      rememberDeckyActivityScrollTop(providerId, 0);
    } else scrollDeckyFocusTargetIntoView(rowRef.current ?? target, listRef.current, isStillFocused);
  };
  const blurRow = (): void => { focusGeneration.current += 1; setFocused(false); };
  const onFocus: FocusEventHandler<HTMLElement> = (event) => focusRow(event.currentTarget);
  const onGamepadFocus: ActivityGamepadFocusHandler = (event) => focusRow(event.currentTarget);
  const rememberFocus = (): void => {
    rememberDeckyActivityFocusTarget(providerId, {
      gameId: entry.game.gameId,
      achievementId: entry.achievement.achievementId,
      ...(entry.achievement.unlockMode !== undefined ? { unlockMode: entry.achievement.unlockMode } : {}),
      ...(timestamp !== undefined ? { unlockedAt: timestamp } : {}),
    });
  };
  const openAchievement = (): void => {
    rememberFocus();
    rememberDeckyActivityScrollTop(providerId, listRef.current?.scrollTop ?? 0);
    onOpenAchievementDetail(entry.game.gameId, entry.achievement.achievementId);
  };
  return (
    <Focusable ref={(node) => { rowRef.current = node; elementRef?.(node); }} className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} noFocusRing role="button" data-steam-activity-row="true" data-steam-activity-row-index={rowIndex} aria-label={`Open ${entry.achievement.title}`} onActivate={openAchievement} onClick={openAchievement} onCancel={onBack} onGamepadDirection={(event) => handleActivityRowDirection(event, onRevealMore)} onFocus={(event) => { rememberFocus(); onFocus(event); }} onGamepadFocus={(event) => { rememberFocus(); onGamepadFocus(event); }} onBlur={blurRow} onGamepadBlur={blurRow} style={{ ...getCardStyle(), display: "grid", gridTemplateColumns: `${isRa ? DECKY_RA_FULLSCREEN_GAME_ICON_COLUMN_WIDTH : STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}px 48px minmax(0, 1fr) 128px 16px`, alignItems: "center", gap: 8, scrollMarginBlock: 0, flex: `0 0 ${STEAM_FULLSCREEN_GAME_ROW_HEIGHT}px`, minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT, padding: "2px 7px 2px 3px", boxSizing: "border-box", ...(focused ? { outline: "none", background: steamTheme.surface.focusedContentCard, boxShadow: steamTheme.focus.shadow } : {}) }}>
      {isRa ? <DeckyRetroAchievementsGameIcon
        game={entry.game}
        src={heroArtworkUrl}
        size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT}
      /> : <DeckyGameArtwork compact height={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT} size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT} width={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH} {...(/^\d+$/u.test(entry.game.gameId) ? { steamAppId: Number(entry.game.gameId) } : {})} {...(heroArtworkUrl !== undefined ? { src: heroArtworkUrl } : {})} title={entry.game.title} />}
      {entry.achievement.badgeImageUrl !== undefined ? <DeckyGameArtwork compact size={46} src={entry.achievement.badgeImageUrl} title={entry.achievement.title} /> : <span style={{ width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 7, background: steamTheme.color.surfaceRaised, color: steamTheme.color.textPrimary, fontWeight: 800 }}>{entry.achievement.title.slice(0, 1)}</span>}
      <div style={{ minWidth: 0 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 800 }}>{entry.achievement.title}</div><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: steamTheme.color.textSecondary, fontSize: 10 }}>{entry.achievement.description ?? entry.game.title}</div>{providerId === RETROACHIEVEMENTS_PROVIDER_ID && entry.achievement.unlockMode !== undefined ? <div style={{ color: entry.achievement.unlockMode === "hardcore" ? raTheme.color.hardcore : raTheme.color.softcore, fontSize: 9, fontWeight: 800 }}>{entry.achievement.unlockMode === "hardcore" ? "Hardcore" : "Softcore"}</div> : null}</div>
      <div style={{ borderLeft: `1px solid ${steamTheme.color.borderSubtle}`, paddingLeft: 10, color: steamTheme.color.textSecondary, fontSize: 10, textAlign: "right" }}><div>Unlocked</div><div>{formatUnlockDate(timestamp)}</div></div>
      <span style={{ color: steamTheme.color.textPrimary, fontSize: 27, lineHeight: 1 }}>›</span>
    </Focusable>
  );
}

export function DeckySteamFullScreenActivityDashboard({
  snapshot,
  calendarWeeks = DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS,
  isActive = true,
  showSteamProfileFooter = true,
  onBack,
  onOpenAchievementDetail,
  onOpenGames,
  onOpenProfile,
  onOpenSettings,
}: {
  readonly snapshot: AchievementHistorySnapshot;
  readonly calendarWeeks?: SteamActivityCalendarWeeks;
  readonly isActive?: boolean;
  readonly showSteamProfileFooter?: boolean;
  readonly onBack: () => void;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onOpenGames: () => void;
  readonly onOpenProfile?: () => void;
  readonly onOpenSettings: () => void;
}): JSX.Element {
  const providerId = snapshot.providerId;
  const isRa = providerId === RETROACHIEVEMENTS_PROVIDER_ID;
  const settings = useDeckySettings();
  const state = useSyncExternalStore(subscribeDeckyActivityPageState, () => readDeckyActivityPageState(providerId));
  const { filter, selectedGameId, selectedPeriod, subview, sort, renderLimit } = state;
  const hasCompleteHistory = !snapshot.sourceLabel.toLowerCase().includes("preview");
  const dashboardRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const analyticsRef = useRef<HTMLDivElement>(null);
  const restorationTargetRef = useRef<HTMLDivElement | null>(null);
  // Keep the intended checkpoint separate from native focus events during mount.
  const restorationStateRef = useRef(state);
  const pendingRevealedRowIndexRef = useRef<number | null>(null);
  const pendingContentFocusRef = useRef(true);
  const { mode, showModeControl, gameOptions, effectiveEntries, stats } = useMemo(
    () => selectActivityHistory(snapshot.entries, providerId, settings.retroAchievementsAchievementMode,
      { filter, selectedGameId, selectedPeriod, mode: state.mode }, hasCompleteHistory),
    [snapshot.entries, providerId, settings.retroAchievementsAchievementMode, filter, selectedGameId, selectedPeriod, state.mode, hasCompleteHistory],
  );
  const entries = useMemo(() => sortActivityEntries(effectiveEntries, sort), [effectiveEntries, sort]);
  const allGroups = useMemo(() => groupActivityEntries(entries), [entries]);
  const groups = useMemo(() => pageActivityGroups(allGroups, renderLimit), [allGroups, renderLimit]);
  const selectedGame = gameOptions.find(({ gameId }) => gameId === selectedGameId);
  const temporaryFilters = hasActivityTemporaryFilters(state);
  const filterRowInset = subview === "activity" ? ACTIVITY_DATE_GROUP_PADDING_PX + ACTIVITY_DATE_GROUP_BORDER_PX : 0;
  const recentActivityInterval = isRa ? settings.retroAchievementsFullscreenRecentActivityInterval : settings.steamFullscreenRecentActivityInterval;

  useEffect(() => {
    if (!isActivityPresetAvailable(filter, hasCompleteHistory)) rememberDeckyActivityFilter(providerId, "all");
  }, [filter, hasCompleteHistory, providerId]);

  const resetScroll = (): void => {
    pendingRevealedRowIndexRef.current = null;
    if (listRef.current !== null) listRef.current.scrollTop = 0;
    if (analyticsRef.current !== null) analyticsRef.current.scrollTop = 0;
  };
  const updateResults = (change: () => void): void => {
    resetScroll();
    change();
    restorationStateRef.current = readDeckyActivityPageState(providerId);
  };
  const selectPeriod = (period: ActivitySelectedPeriod): void => {
    pendingContentFocusRef.current = true;
    updateResults(() => rememberDeckyActivityPeriod(providerId, period));
  };
  const selectSubview = (next: ActivitySubview): void => {
    if (next === subview) return;
    rememberDeckyActivityScrollTop(providerId, (subview === "activity" ? listRef : analyticsRef).current?.scrollTop ?? 0, subview);
    pendingContentFocusRef.current = true;
    rememberDeckyActivitySubview(providerId, next);
    restorationStateRef.current = readDeckyActivityPageState(providerId);
  };
  const revealMore = (lastRowIndex?: number): boolean => {
    if (renderLimit >= entries.length) return false;
    if (lastRowIndex !== undefined) pendingRevealedRowIndexRef.current = lastRowIndex + 1;
    rememberDeckyActivityRenderLimit(providerId, Math.min(entries.length, renderLimit + STEAM_ACTIVITY_RENDER_STEP));
    return true;
  };

  // Only the visible dashboard supplies trigger actions to the shared footer.
  // Refresh each commit so callbacks retain the current provider and subview.
  useLayoutEffect(() => {
    const document = dashboardRef.current?.ownerDocument;
    if (!isActive || document === undefined) return;
    const selectWithSound = (next: ActivitySubview): void => {
      if (next === subview) return;
      selectSubview(next);
      playDeckySteamNavigationSound(document);
    };
    return registerDeckyFullscreenSubviewNavigation(document, {
      onLeft: () => selectWithSound("activity"),
      onRight: () => selectWithSound("analytics"),
    });
  });

  useLayoutEffect(() => {
    const rowIndex = pendingRevealedRowIndexRef.current;
    if (rowIndex === null || subview !== "activity") return;
    const target = dashboardRef.current?.querySelector<HTMLElement>(`[data-steam-activity-row-index='${rowIndex}']`);
    if (target === undefined || target === null) return;
    pendingRevealedRowIndexRef.current = null;
    if (takeDeckySteamGamepadFocus(target)) {
      playDeckySteamNavigationSound(target.ownerDocument);
    }
  }, [renderLimit, subview]);

  useLayoutEffect(() => {
    if (!isActive) {
      restorationStateRef.current = readDeckyActivityPageState(providerId);
      pendingContentFocusRef.current = true;
      return;
    }
    const dashboard = dashboardRef.current;
    const ownerWindow = dashboard?.ownerDocument.defaultView;
    if (dashboard === null || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const remembered = restorationStateRef.current;
      const restoreContentFocus = pendingContentFocusRef.current;
      pendingContentFocusRef.current = false;
      const analyticsTarget = Array.from(dashboard.querySelectorAll<HTMLElement>("[data-activity-analytics-focus]"))
        .find((node) => node.dataset["activityAnalyticsFocus"] === remembered.analyticsFocusKey);
      const target = subview === "activity"
        ? restorationTargetRef.current ?? dashboard.querySelector<HTMLElement>("[data-steam-activity-row='true']") ?? dashboard.querySelector<HTMLElement>("[data-activity-subview='activity']")
        : analyticsTarget ?? dashboard.querySelector<HTMLElement>("[data-activity-subview='analytics']");
      // Native Decky focus remains the owner; a range selection must enter results.
      if (target && (restoreContentFocus || !dashboard.contains(dashboard.ownerDocument.activeElement))) takeDeckySteamGamepadFocus(target);
      const scroll = subview === "activity" ? listRef.current : analyticsRef.current;
      if (scroll) scroll.scrollTop = subview === "activity" && target?.dataset["steamActivityRowIndex"] !== "0" ? remembered.scrollTop : 0;
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive, providerId, subview, mode, selectedPeriod]);

  return <>
    <main ref={dashboardRef} {...(isRa ? { "data-ac-ra-theme": "fullscreen" } : { "data-ac-steam-theme": "fullscreen" })}
      data-steam-full-screen-activity-dashboard data-activity-subview-active={subview} style={getPageStyle()}>
      <Focusable flow-children="vertical" noFocusRing tabIndex={-1}
        style={{ display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr)", gap: 8, height: "100%", minHeight: 0 }}>
        <Focusable flow-children="left-right" navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD} noFocusRing tabIndex={-1}
          role="tablist" aria-label="Achievement history views" data-activity-header-row="tabs"
          style={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr) minmax(0, 1fr) 32px", gap: 8, alignItems: "center", minWidth: 0,
            padding: "0 4px 8px", borderBottom: `1px solid ${steamTheme.color.borderSubtle}` }}>
          <span aria-hidden="true" style={triggerHintStyle}>LT</span>
          <ActivityFilterButton label="Activity" subview="activity" selected={subview === "activity"} onClick={() => selectSubview("activity")} onBack={onBack} />
          <ActivityFilterButton label="Analytics" subview="analytics" selected={subview === "analytics"} onClick={() => selectSubview("analytics")} onBack={onBack} />
          <span aria-hidden="true" style={triggerHintStyle}>RT</span>
        </Focusable>
        <Focusable flow-children="left-right" noFocusRing tabIndex={-1} data-steam-activity-filter-row data-activity-header-row="filters"
          style={{ display: "grid", gridTemplateColumns: `repeat(${showModeControl ? 3 : 2}, minmax(0, 1fr)) ${subview === "activity" ? "104px " : ""}112px`,
            gap: 6, alignItems: "stretch", width: "100%", minWidth: 0, boxSizing: "border-box",
            paddingLeft: ACTIVITY_CONTENT_GUTTER_PX + filterRowInset,
            paddingRight: (subview === "activity" ? ACTIVITY_LIST_RIGHT_GUTTER_PX : ACTIVITY_CONTENT_GUTTER_PX) + filterRowInset }}>
          <ActivityDropdown title="Time period" options={ACTIVITY_TIME_OPTIONS.map((option) => ({ ...option, disabled: !isActivityPresetAvailable(option.value, hasCompleteHistory) }))}
            value={isActivityPresetAvailable(filter, hasCompleteHistory) ? filter : "all"}
            label={selectedPeriod !== undefined ? "Selected Period" : ACTIVITY_TIME_OPTIONS.find((option) => option.value === filter && isActivityPresetAvailable(filter, hasCompleteHistory))?.label ?? "All Unlocks"}
            active={filter !== "all" || selectedPeriod !== undefined} onChange={(next) => updateResults(() => rememberDeckyActivityFilter(providerId, next))} onBack={onBack} />
          <ActivityDropdown title="Game" options={[{ value: "", label: "All Games" }, ...gameOptions.map((game) => ({ value: game.gameId, label: `${game.title} (${game.unlockCount.toLocaleString()})` }))]}
            value={selectedGameId ?? ""} label={selectedGame?.title ?? (selectedGameId === undefined ? "All Games" : "Selected Game (no unlocks)")}
            active={selectedGameId !== undefined} onChange={(next) => updateResults(() => rememberDeckyActivityGame(providerId, next || undefined))} onBack={onBack} />
          {showModeControl ? <ActivityDropdown title="Unlock mode" options={[{ value: "both", label: "Both" }, { value: "hardcore", label: "Hardcore" }, { value: "softcore", label: "Softcore" }] as const}
            value={state.mode} label={state.mode === "both" ? "Both Modes" : state.mode === "hardcore" ? "Hardcore" : "Softcore"} active={state.mode !== "both"}
            onChange={(next) => updateResults(() => rememberDeckyActivityMode(providerId, next))} onBack={onBack} /> : null}
          {subview === "activity" ? <ActivityFilterButton ariaLabel={sort === "desc" ? "Sort: newest first. Select for oldest first." : "Sort: oldest first. Select for newest first."} label={sort === "desc" ? "↓ Newest" : "↑ Oldest"} selected={sort === "asc"} onClick={() => updateResults(() => rememberDeckyActivitySort(providerId, sort === "desc" ? "asc" : "desc"))} onBack={onBack} /> : null}
          <ActivityFilterButton label="Clear Filters" selected={false} disabled={!temporaryFilters} onClick={() => updateResults(() => clearDeckyActivityFilters(providerId))} onBack={onBack} />
        </Focusable>
        {subview === "activity" ? <Focusable key="activity" ref={listRef} data-steam-activity-list flow-children="vertical" navEntryPreferPosition={NavEntryPositionPreferences.FIRST} noFocusRing tabIndex={-1}
          onScroll={(event) => {
            const list = event.currentTarget;
            rememberDeckyActivityScrollTop(providerId, list.scrollTop);
            if (list.scrollTop + list.clientHeight >= list.scrollHeight - STEAM_FULLSCREEN_GAME_ROW_HEIGHT) revealMore();
          }} style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", scrollBehavior: "auto", minHeight: 0,
            padding: `${ACTIVITY_CONTENT_GUTTER_PX}px ${ACTIVITY_LIST_RIGHT_GUTTER_PX}px 5px ${ACTIVITY_CONTENT_GUTTER_PX}px`, boxSizing: "border-box" }}>
          {!hasCompleteHistory ? <div style={{ color: steamTheme.color.textSecondary, fontSize: 11 }}>History preview — only loaded unlocks are shown.</div> : null}
          {groups.map((group) => <div key={group.key} data-activity-date-group={group.key} style={{ ...getCardStyle(), flex: "0 0 auto", padding: ACTIVITY_DATE_GROUP_PADDING_PX, borderWidth: ACTIVITY_DATE_GROUP_BORDER_PX }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 4px 7px", color: steamTheme.color.textSecondary, fontSize: 11, fontWeight: 800 }}>
              <h2 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit" }}>{group.label}</h2><span>{group.count.toLocaleString()} {group.count === 1 ? "unlock" : "unlocks"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.rows.map(({ entry, rowIndex, key }) => <AchievementActivityRow key={key} entry={entry} rowIndex={rowIndex} providerId={providerId} listRef={listRef}
                elementRef={restorationStateRef.current.focusTarget?.gameId === entry.game.gameId && restorationStateRef.current.focusTarget.achievementId === entry.achievement.achievementId
                  && (restorationStateRef.current.focusTarget.unlockMode === undefined || restorationStateRef.current.focusTarget.unlockMode === entry.achievement.unlockMode)
                  && (restorationStateRef.current.focusTarget.unlockedAt === undefined || restorationStateRef.current.focusTarget.unlockedAt === getUnlockTime(entry))
                  ? (node) => { restorationTargetRef.current = node; } : undefined}
                onOpenAchievementDetail={onOpenAchievementDetail} onBack={onBack} onRevealMore={revealMore} />)}
            </div>
          </div>)}
          {entries.length === 0 ? <div style={{ ...getCardStyle(), padding: 18, color: steamTheme.color.textSecondary }}>No unlocks match these filters.</div> : null}
        </Focusable> : <Focusable key="analytics" ref={analyticsRef} data-steam-activity-list data-activity-analytics-viewport flow-children="vertical" noFocusRing tabIndex={-1}
          onGamepadFocus={(event) => {
            const key = (event.target as HTMLElement).closest<HTMLElement>("[data-activity-analytics-focus]")?.dataset["activityAnalyticsFocus"];
            if (key) rememberDeckyActivityAnalyticsFocus(providerId, key);
          }}
          onFocusCapture={(event) => {
            const key = (event.target as HTMLElement).closest<HTMLElement>("[data-activity-analytics-focus]")?.dataset["activityAnalyticsFocus"];
            if (key) rememberDeckyActivityAnalyticsFocus(providerId, key);
          }} style={{ overflow: "clip", minHeight: 0, minWidth: 0, padding: ACTIVITY_CONTENT_GUTTER_PX, boxSizing: "border-box" }}>
          <ActivityAnalytics stats={stats} unlockCount={effectiveEntries.length} isRa={isRa} complete={hasCompleteHistory} filtered={temporaryFilters}
            interval={recentActivityInterval} weeks={calendarWeeks} selectedPeriod={selectedPeriod} onSelectPeriod={selectPeriod} onBack={onBack} />
        </Focusable>}
      </Focusable>
    </main>
    {showSteamProfileFooter ? <DeckyFullScreenFooterOverlay activeNavigationItemId="activity" ariaLabel={`${isRa ? "RetroAchievements" : "Steam"} profile navigation`}
      navigationItems={isRa ? RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS : STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
      secondaryActionLabel="Top" onSecondaryAction={(document) => { jumpDeckySteamProfileTabToTop(document, "activity"); }}
      onPreviousNavigationItem={onOpenGames} onNextNavigationItem={isRa ? onOpenProfile ?? onOpenGames : onOpenSettings} /> : null}
  </>;
}
