import {
  Focusable,
  GamepadButton,
  Menu,
  MenuItem,
  NavEntryPositionPreferences,
  showContextMenu,
  type FocusableProps,
  type GamepadEvent,
} from "@decky/ui";
import type { AchievementHistorySnapshot, RecentUnlock } from "@core/domain";
import type { RecentActivityInterval, RetroAchievementsAchievementMode } from "@core/settings";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type JSX,
  type RefCallback,
  type RefObject,
} from "react";
import { DeckyGameArtwork } from "./decky-game-artwork";
import {
  DeckyRetroAchievementsGameIcon,
  DECKY_RA_FULLSCREEN_GAME_ICON_COLUMN_WIDTH,
} from "./decky-retroachievements-game-icon";
import {
  DeckyFullScreenFooterOverlay,
  RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS,
  STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS,
} from "./decky-full-screen-footer-overlay";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { buildRecentActivityTrend, buildSteamActivityStats, type SteamActivityStats } from "./decky-steam-activity-data";
import { buildActivityGameOptions, filterActivityEntriesByGame, type ActivityGameOption } from "./decky-steam-full-screen-activity-games";
import {
  buildSteamActivityCalendarModel,
  DEFAULT_STEAM_ACTIVITY_CALENDAR_WEEKS,
  type SteamActivityCalendarIntensity,
  type SteamActivityCalendarWeeks,
} from "./decky-steam-activity-calendar-model";
import {
  getSteamFullscreenGameArtworkUrlByGameId,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH,
  STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
} from "./decky-steam-game-artwork";
import calendarIconUrl from "./assets/calendar.svg";
import caretDownIconUrl from "./assets/caret-down.svg";
import clockIconUrl from "./assets/clock.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import streakIconUrl from "./assets/activity-flame.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import unlockedLockIconUrl from "./assets/unlocked-lock.svg";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { jumpDeckySteamProfileTabToTop } from "./decky-steam-profile-jump-top";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import { steamRecipes, steamTheme } from "./steam-theme";
import { qamActivityCalendarColors } from "./decky-qam-theme";
import {
  readDeckyActivityPageState,
  rememberDeckyActivityCalendarDay,
  rememberDeckyActivityFilter,
  rememberDeckyActivityFocusTarget,
  rememberDeckyActivityGame,
  rememberDeckyActivityRenderLimit,
  rememberDeckyActivityScrollTop,
  type DeckySteamActivityFilter,
} from "./decky-steam-full-screen-activity-state";
import { useDeckySettings } from "./decky-settings";
import { filterRetroAchievementsUnlocksByMode } from "./decky-retroachievements-compact-profile-model";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { raTheme } from "./ra-theme";

type ActivityFilter = DeckySteamActivityFilter;
type ActivityGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

const ACTIVITY_TOP_PADDING_PX = 43;
const ACTIVITY_FOOTER_CLEARANCE_PX = 48;
const DAY_MS = 24 * 60 * 60 * 1000;
const STEAM_ACTIVITY_INITIAL_RENDER_LIMIT = 24;
const STEAM_ACTIVITY_RENDER_STEP = 24;

function getUnlockTime(entry: RecentUnlock): number | undefined {
  const timestamp = entry.unlockedAt ?? entry.achievement.unlockedAt;
  return timestamp !== undefined && Number.isFinite(timestamp) ? timestamp : undefined;
}

function getLocalDayTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

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

function getActivityDays(entries: readonly RecentUnlock[]): readonly number[] {
  return [...new Set(entries.map(getUnlockTime).filter((value): value is number => value !== undefined).map(getLocalDayTimestamp))]
    .sort((left, right) => left - right);
}

function getCurrentStreak(days: readonly number[], now = Date.now()): number {
  const present = new Set(days);
  let cursor = getLocalDayTimestamp(now);
  if (!present.has(cursor)) {
    cursor -= DAY_MS;
  }

  let streak = 0;
  while (present.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function filterActivityEntries(
  entries: readonly RecentUnlock[],
  filter: ActivityFilter,
  selectedCalendarDay: number | undefined,
  now = Date.now(),
): readonly RecentUnlock[] {
  if (selectedCalendarDay !== undefined) {
    return entries.filter((entry) => {
      const timestamp = getUnlockTime(entry);
      return timestamp !== undefined && getLocalDayTimestamp(timestamp) === selectedCalendarDay;
    });
  }

  if (filter === "all") {
    return entries;
  }

  const nowDate = new Date(now);
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
  const yearStart = new Date(nowDate.getFullYear(), 0, 1).getTime();
  const recentStart = now - 90 * DAY_MS;
  const days = getActivityDays(entries);
  const currentStreakStart = getLocalDayTimestamp(now) - Math.max(0, getCurrentStreak(days, now) - 1) * DAY_MS;
  const cutoff = filter === "recent" ? recentStart : filter === "year" ? yearStart : filter === "month" ? monthStart : currentStreakStart;
  return entries.filter((entry) => (getUnlockTime(entry) ?? Number.NEGATIVE_INFINITY) >= cutoff);
}

function Icon({ src, size = 26, tone = "blue" }: { readonly src: string; readonly size?: number; readonly tone?: "blue" | "gold" | "original" }): JSX.Element {
  return <img alt="" aria-hidden="true" src={src} style={{ width: size, height: size, ...(tone === "original" ? {} : { filter: tone === "gold" ? steamTheme.iconFilter.reward : steamTheme.iconFilter.accent }) }} />;
}

function getPageStyle(): CSSProperties {
  return {
    height: "100%",
    minHeight: 0,
    padding: `${ACTIVITY_TOP_PADDING_PX}px 12px ${ACTIVITY_FOOTER_CLEARANCE_PX}px`,
    boxSizing: "border-box",
    overflow: "hidden",
    background: steamTheme.surface.page,
    color: steamTheme.color.textPrimary,
  };
}

function getCardStyle(nested = false): CSSProperties {
  return {
    ...steamRecipes.card("fullscreen"),
    background: nested ? steamTheme.surface.contentStat : steamTheme.surface.contentCard,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    minWidth: 0,
  };
}

function ActivityMetricCard({ icon, label, value, iconTone = "blue", iconSize = 24 }: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly iconTone?: "blue" | "gold" | "original";
  readonly iconSize?: number;
}): JSX.Element {
  return (
    <div style={{ ...getCardStyle(), display: "grid", gridTemplateColumns: `${iconSize}px minmax(0, 1fr)`, alignItems: "center", gap: 8, padding: "8px 10px", minHeight: 54 }}>
      <Icon src={icon} size={iconSize} tone={iconTone} />
      <div style={{ minWidth: 0, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.05 }}>{value}</div>
        <div style={{ color: steamTheme.color.textSecondary, fontSize: 9.5, lineHeight: 1.15 }}>{label}</div>
      </div>
    </div>
  );
}

function ActivityTrend({ stats, interval }: { readonly stats: SteamActivityStats; readonly interval: RecentActivityInterval }): JSX.Element {
  const trend = buildRecentActivityTrend(stats.dayCounts, interval);
  const maximum = Math.max(1, ...trend.bars.map(({ count }) => count));
  return (
    <div style={{ ...getCardStyle(), padding: "7px 10px", display: "grid", gridTemplateColumns: "minmax(92px,.7fr) minmax(0,1.6fr)", alignItems: "end", gap: 9 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Recent Activity</div>
        <div style={{ color: steamTheme.color.textMuted, fontSize: 9, marginTop: 2 }}>{trend.label}</div>
        <div style={{ color: steamTheme.color.textPrimary, fontSize: 9.5, fontWeight: 800, marginTop: 3 }}>{`${formatCount(trend.total)} unlock${trend.total === 1 ? "" : "s"}`}</div>
      </div>
      <div style={{ display: "flex", alignItems: "end", gap: 2, height: 34 }}>
        {trend.bars.map(({ count, label }) => <span key={label} aria-label={`${label}: ${count} unlock${count === 1 ? "" : "s"}`} style={{ display: "block", flex: "1 1 0", minWidth: 2, minHeight: 4, height: `${count === 0 ? 14 : Math.max(20, (count / maximum) * 100)}%`, borderRadius: 2, background: count > 0 ? steamTheme.surface.activityTrendFill : steamTheme.surface.activityTrendEmpty }} />)}
      </div>
    </div>
  );
}

function ActivityInsightCard({ icon, title, value, detail, tone = "blue", iconSize = 17 }: {
  readonly icon: string;
  readonly title: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: "blue" | "gold" | "original";
  readonly iconSize?: number;
}): JSX.Element {
  return (
    <div style={{ ...getCardStyle(true), display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", alignItems: "center", gap: 5, padding: "6px 6px", minHeight: 46, boxSizing: "border-box" }}>
      <Icon src={icon} size={iconSize} tone={tone} />
      <div style={{ minWidth: 0 }}>
        <div style={{ color: steamTheme.color.textSecondary, fontSize: 8.5, lineHeight: 1.05 }}>{title}</div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: steamTheme.color.textPrimary, fontSize: 11.5, fontWeight: 800, lineHeight: 1.15, marginTop: 1 }}>{value}</div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: steamTheme.color.textMuted, fontSize: 8.5, lineHeight: 1.1, marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  );
}

function ActivityInsights({ stats }: { readonly stats: SteamActivityStats }): JSX.Element {
  return (
    <div data-steam-activity-insights style={{ ...getCardStyle(), padding: 7 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800 }}>ACTIVITY INSIGHTS</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, marginTop: 5 }}>
        <ActivityInsightCard icon={streakIconUrl} title="Longest Streak" value={`${stats.longestStreak} days`} detail="Consecutive active days" tone="original" iconSize={24} />
        <ActivityInsightCard icon={calendarIconUrl} title="Best Month" value={stats.bestMonth.value} detail={stats.bestMonth.detail} />
        <ActivityInsightCard icon={clockIconUrl} title="Most Active Day" value={stats.mostActiveDay.value} detail={stats.mostActiveDay.detail} />
      </div>
    </div>
  );
}

function moveActivityGamepadFocus(
  event: GamepadEvent,
  source: HTMLElement,
  target: HTMLElement | null | undefined,
): void {
  if (!takeDeckySteamGamepadFocus(target)) {
    return;
  }

  // Let GamepadUI perform the focus transfer through its registered node. Stop
  // only this directional navigation so it cannot continue into Steam chrome.
  event.preventDefault();
  event.stopPropagation();
  if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
}

function handleActivityFilterDirection(event: GamepadEvent): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const filters = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-activity-filter='true']") ?? []);
  const index = filters.indexOf(source);
  const button = event.detail.button;
  const target = button === GamepadButton.DIR_LEFT ? filters[index - 1] ?? source
    : button === GamepadButton.DIR_RIGHT ? filters[index + 1]
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-game-filter='true']")
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-calendar-current='true']")
      ?? source
      : button === GamepadButton.DIR_DOWN ? dashboard?.querySelector<HTMLElement>("[data-steam-activity-row='true']") ?? source
        : button === GamepadButton.DIR_UP ? source : undefined;
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

function handleActivityGameDirection(event: GamepadEvent): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const filters = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-activity-filter='true']") ?? []);
  const button = event.detail.button;
  const target = button === GamepadButton.DIR_LEFT ? filters.at(-1) ?? source
    : button === GamepadButton.DIR_RIGHT ? dashboard?.querySelector<HTMLElement>("[data-steam-activity-calendar-current='true']") ?? source
      : button === GamepadButton.DIR_DOWN ? dashboard?.querySelector<HTMLElement>("[data-steam-activity-row='true']") ?? source
        : button === GamepadButton.DIR_UP ? source : undefined;
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

function handleActivityCalendarDirection(event: GamepadEvent): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const cells = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-activity-calendar-day='true']") ?? []);
  const index = cells.indexOf(source);
  const row = index % 7;
  const column = Math.floor(index / 7);
  const columnCount = Math.ceil(cells.length / 7);
  const button = event.detail.button;
  let target: HTMLElement | null | undefined;
  if (button === GamepadButton.DIR_UP) {
    target = row > 0 ? cells[index - 1] : source;
  } else if (button === GamepadButton.DIR_DOWN) {
    target = row < 6
      ? cells[index + 1] ?? source
      : dashboard?.querySelector<HTMLElement>("[data-steam-activity-row='true']") ?? source;
  } else if (button === GamepadButton.DIR_LEFT) {
    target = column > 0
      ? cells[index - 7]
      : dashboard?.querySelector<HTMLElement>("[data-steam-activity-game-filter='true']")
        ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-filter-selected='true']")
        ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-filter='true']")
        ?? source;
  } else if (button === GamepadButton.DIR_RIGHT) {
    target = column < columnCount - 1 ? cells[index + 7] ?? source : source;
  }
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

function handleActivityRowDirection(event: GamepadEvent, onRevealMore: (lastRowIndex: number) => boolean): void {
  const source = event.currentTarget as HTMLElement;
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const rows = Array.from(dashboard?.querySelectorAll<HTMLElement>("[data-steam-activity-row='true']") ?? []);
  const index = rows.indexOf(source);
  const button = event.detail.button;
  if (button === GamepadButton.DIR_DOWN && rows[index + 1] === undefined && onRevealMore(index)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const target = button === GamepadButton.DIR_UP
    ? rows[index - 1]
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-game-filter-selected='true']")
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-filter-selected='true']")
      ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-filter='true']")
    : button === GamepadButton.DIR_DOWN
      ? rows[index + 1] ?? source
      : button === GamepadButton.DIR_RIGHT
        ? dashboard?.querySelector<HTMLElement>("[data-steam-activity-calendar-selected='true']")
          ?? dashboard?.querySelector<HTMLElement>("[data-steam-activity-calendar-current='true']")
          ?? source
        : button === GamepadButton.DIR_LEFT ? source : undefined;
  if (target !== undefined) moveActivityGamepadFocus(event, source, target);
}

function ActivityFilterButton({ label, selected, onClick, onBack }: {
  readonly label: string;
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly onBack: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-pressed={selected}
      data-steam-activity-filter="true"
      data-steam-activity-filter-selected={selected ? "true" : "false"}
      preferredFocus={selected}
      onActivate={onClick}
      onClick={onClick}
      onCancel={onBack}
      onGamepadDirection={handleActivityFilterDirection}
      onFocus={() => setFocused(true)}
      onGamepadFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...getSteamCompactAchievementFilterStyle(selected, focused),
        flex: "0 0 auto",
        width: "auto",
        minHeight: 28,
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {label}
    </Focusable>
  );
}

function ActivityGameFilter({ games, selectedGameId, onChange, onBack }: {
  readonly games: readonly ActivityGameOption[];
  readonly selectedGameId: string | undefined;
  readonly onChange: (gameId: string | undefined) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu>>();
  const unregisterCancelRef = useRef<() => void>();
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedGame = games.find(({ gameId }) => gameId === selectedGameId);
  const label = selectedGame?.title ?? "All Games";

  const closeMenu = (restoreFocus = true): void => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    unregisterCancelRef.current?.();
    unregisterCancelRef.current = undefined;
    setMenuOpen(false);
    if (restoreFocus) requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };
  const openMenu = (): void => {
    if (menuRef.current !== undefined || triggerRef.current === null) return;
    setMenuOpen(true);
    menuRef.current = showContextMenu(
      <Menu label="Filter by game" onCancel={() => closeMenu()}>
        <MenuItem selected={selectedGameId === undefined} onClick={() => { onChange(undefined); closeMenu(); }}>All Games</MenuItem>
        {games.map((game) => <MenuItem key={game.gameId} selected={selectedGameId === game.gameId} onClick={() => { onChange(game.gameId); closeMenu(); }}>{`${game.title} (${formatCount(game.unlockCount)})`}</MenuItem>)}
      </Menu>,
      triggerRef.current,
      { bModal: true },
    );
    unregisterCancelRef.current = registerDeckyFullscreenPopupCancel(() => closeMenu());
  };
  useEffect(() => () => {
    menuRef.current?.Hide();
    unregisterCancelRef.current?.();
  }, []);

  return <Focusable
    ref={triggerRef}
    className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
    noFocusRing
    role="button"
    aria-label={`Game: ${label}`}
    aria-expanded={menuOpen}
    data-steam-activity-game-filter="true"
    data-steam-activity-game-filter-selected={selectedGameId === undefined ? "false" : "true"}
    onActivate={openMenu}
    onClick={openMenu}
    onCancel={() => { if (menuRef.current !== undefined) closeMenu(); else onBack(); }}
    onGamepadDirection={handleActivityGameDirection}
    onFocus={() => setFocused(true)}
    onGamepadFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    style={{
      ...getSteamCompactAchievementFilterStyle(selectedGameId !== undefined, focused),
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
      flex: "0 1 150px",
      minWidth: 100,
      minHeight: 28,
      marginLeft: "auto",
      padding: "4px 8px",
      fontSize: 10,
      fontWeight: 700,
      overflow: "hidden",
    }}
  >
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    <img src={caretDownIconUrl} alt="" aria-hidden="true" style={{ width: 10, height: 10, flexShrink: 0, filter: steamTheme.iconFilter.accent }} />
  </Focusable>;
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
  const onFocus: FocusEventHandler<HTMLElement> = (event) => { setFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); };
  const onGamepadFocus: ActivityGamepadFocusHandler = (event) => { setFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); };
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
    <Focusable ref={elementRef} className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} noFocusRing role="button" data-steam-activity-row="true" data-steam-activity-row-index={rowIndex} aria-label={`Open ${entry.achievement.title}`} onActivate={openAchievement} onClick={openAchievement} onCancel={onBack} onGamepadDirection={(event) => handleActivityRowDirection(event, onRevealMore)} onFocus={(event) => { rememberFocus(); onFocus(event); }} onGamepadFocus={(event) => { rememberFocus(); onGamepadFocus(event); }} onBlur={() => setFocused(false)} style={{ ...getCardStyle(), display: "grid", gridTemplateColumns: `${isRa ? DECKY_RA_FULLSCREEN_GAME_ICON_COLUMN_WIDTH : STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}px 48px minmax(0, 1fr) 128px 16px`, alignItems: "center", gap: 8, flex: `0 0 ${STEAM_FULLSCREEN_GAME_ROW_HEIGHT}px`, minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT, padding: "2px 7px 2px 3px", boxSizing: "border-box", ...(focused ? { outline: "none", background: steamTheme.surface.focusedContentCard, boxShadow: steamTheme.focus.shadow } : {}) }}>
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

const ACTIVITY_CALENDAR_COLORS: Record<SteamActivityCalendarIntensity, string> = qamActivityCalendarColors;

function ActivityCalendarDay({ day, count, intensity, selected, current, onSelect, onBack }: {
  readonly day: number;
  readonly count: number;
  readonly intensity: SteamActivityCalendarIntensity;
  readonly selected: boolean;
  readonly current: boolean;
  readonly onSelect: () => void;
  readonly onBack: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const dateLabel = new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={`${dateLabel}, ${count} unlock${count === 1 ? "" : "s"}`}
      aria-pressed={selected}
      data-steam-activity-calendar-day="true"
      data-steam-activity-calendar-current={current ? "true" : "false"}
      data-steam-activity-calendar-day-key={day}
      data-steam-activity-calendar-count={count}
      data-steam-activity-calendar-intensity={intensity}
      data-steam-activity-calendar-selected={selected ? "true" : "false"}
      onActivate={onSelect}
      onClick={onSelect}
      onCancel={onBack}
      onGamepadDirection={handleActivityCalendarDirection}
      onFocus={() => setFocused(true)}
      onGamepadFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        padding: 0,
        boxSizing: "border-box",
        border: selected ? `1px solid ${steamTheme.color.textPrimary}` : "1px solid transparent",
        borderRadius: 2,
        outline: "none",
        background: ACTIVITY_CALENDAR_COLORS[intensity],
        boxShadow: focused ? steamTheme.focus.calendarDayShadow : "none",
      }}
    >
      {null}
    </Focusable>
  );
}

function ActivityCalendar({ dayCounts, weeks, selectedDay, onSelectDay, onBack }: {
  readonly dayCounts: ReadonlyMap<number, number>;
  readonly weeks: SteamActivityCalendarWeeks;
  readonly selectedDay: number | undefined;
  readonly onSelectDay: (day: number) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const today = getLocalDayTimestamp(Date.now());
  const model = useMemo(() => buildSteamActivityCalendarModel(dayCounts, weeks), [dayCounts, weeks]);
  const start = model.days[0]?.day ?? today;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const selectedLabel = selectedDay === undefined
    ? `Last ${weeks} weeks`
    : new Date(selectedDay).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <div data-steam-activity-calendar-weeks={weeks} data-steam-activity-calendar-effective-maximum={model.effectiveMaximum} style={{ ...getCardStyle(), padding: 7, display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, flex: "0 0 auto" }}>
        <span>ACTIVITY CALENDAR</span>
        <span style={{ color: selectedDay === undefined ? steamTheme.color.textSecondary : steamTheme.color.textPrimary, fontWeight: selectedDay === undefined ? 500 : 800 }}>{selectedLabel}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `22px repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, minmax(0, 1fr))", gap: 2, marginTop: 6, alignItems: "stretch", flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        {labels.map((label, row) => (
          <span key={label} style={{ gridColumn: 1, gridRow: row + 1, color: steamTheme.color.textSecondary, fontSize: 8 }}>{label}</span>
        ))}
        {model.days.map(({ day, count, intensity }) => {
          const offset = Math.floor((day - start) / DAY_MS);
          const cell = day <= today
            ? <ActivityCalendarDay
                day={day}
                count={count}
                intensity={intensity}
                selected={selectedDay === day}
                current={today === day}
                onSelect={() => onSelectDay(day)}
                onBack={onBack}
              />
            : <span aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", borderRadius: 2, background: ACTIVITY_CALENDAR_COLORS[0] }} />;
          return (
            <div
              key={day}
              style={{
                gridColumn: Math.floor(offset / 7) + 2,
                gridRow: offset % 7 + 1,
                width: "100%",
                height: "100%",
                minHeight: 0,
              }}
            >
              {cell}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: steamTheme.color.textSecondary, fontSize: 8, marginTop: 6, flex: "0 0 auto" }}>
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} style={{ width: 12, height: 12, borderRadius: 2, background: ACTIVITY_CALENDAR_COLORS[level] }} />
        ))}
        <span>More</span>
      </div>
    </div>
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
  const mode: RetroAchievementsAchievementMode = isRa
    ? settings.retroAchievementsAchievementMode
    : "both";
  const hasCompleteHistory = !isRa || !snapshot.sourceLabel.toLocaleLowerCase().includes("preview");
  const initialPageState = useRef(readDeckyActivityPageState(providerId)).current;
  const dashboardRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousModeRef = useRef(mode);
  const restorationTargetRef = useRef<HTMLDivElement | null>(null);
  const pendingRevealedRowIndexRef = useRef<number | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>(initialPageState.filter);
  const [selectedGameId, setSelectedGameId] = useState(initialPageState.selectedGameId);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(initialPageState.selectedCalendarDay);
  const [renderLimit, setRenderLimit] = useState(initialPageState.renderLimit);
  const modeEntries = useMemo(
    () => isRa ? filterRetroAchievementsUnlocksByMode(snapshot.entries, mode) : snapshot.entries,
    [isRa, mode, snapshot.entries],
  );
  const gameOptions = useMemo(() => buildActivityGameOptions(modeEntries), [modeEntries]);
  const selectedGame = gameOptions.find(({ gameId }) => gameId === selectedGameId);
  const allUnlocksCount = selectedGame?.unlockCount ?? (isRa ? modeEntries.length : snapshot.summary.unlockedCount);
  const entries = useMemo(
    () => filterActivityEntriesByGame(filterActivityEntries(modeEntries, filter, selectedCalendarDay), selectedGame?.gameId),
    [filter, modeEntries, selectedCalendarDay, selectedGame?.gameId],
  );
  const renderedEntries = entries.slice(0, renderLimit);
  const stats = useMemo(() => buildSteamActivityStats(modeEntries), [modeEntries]);
  const recentActivityInterval = isRa
    ? settings.retroAchievementsFullscreenRecentActivityInterval
    : settings.steamFullscreenRecentActivityInterval;

  useEffect(() => {
    if (selectedGameId === undefined || selectedGame !== undefined || gameOptions.length === 0) return;
    setSelectedGameId(undefined);
    rememberDeckyActivityGame(providerId, undefined);
  }, [gameOptions.length, providerId, selectedGame, selectedGameId]);

  useEffect(() => {
    if (!hasCompleteHistory && filter !== "all" && filter !== "recent") {
      setFilter("all");
      rememberDeckyActivityFilter(providerId, "all", mode);
    }
  }, [filter, hasCompleteHistory, mode, providerId]);

  useLayoutEffect(() => {
    if (previousModeRef.current === mode) return;
    previousModeRef.current = mode;
    const dashboard = dashboardRef.current;
    const ownerWindow = dashboard?.ownerDocument.defaultView;
    if (!isActive || dashboard === null || dashboard === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const target = restorationTargetRef.current
        ?? dashboard.querySelector<HTMLElement>("[data-steam-activity-row='true']")
        ?? dashboard.querySelector<HTMLElement>("[data-steam-activity-filter='true']");
      if (target !== null) takeDeckySteamGamepadFocus(target);
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive, mode, modeEntries]);

  useLayoutEffect(() => {
    if (selectedCalendarDay === undefined) return;
    const selectedDayIsVisible = buildSteamActivityCalendarModel(stats.dayCounts, calendarWeeks).days
      .some(({ day }) => day === selectedCalendarDay);
    if (selectedDayIsVisible) return;
    setSelectedCalendarDay(undefined);
    rememberDeckyActivityCalendarDay(providerId, undefined);
  }, [calendarWeeks, selectedCalendarDay, stats.dayCounts]);

  const selectFilter = (nextFilter: ActivityFilter): void => {
    pendingRevealedRowIndexRef.current = null;
    setFilter(nextFilter);
    setSelectedCalendarDay(undefined);
    setRenderLimit(STEAM_ACTIVITY_INITIAL_RENDER_LIMIT);
    if (listRef.current !== null) listRef.current.scrollTop = 0;
    rememberDeckyActivityFilter(providerId, nextFilter, mode);
  };

  const selectGame = (gameId: string | undefined): void => {
    pendingRevealedRowIndexRef.current = null;
    setSelectedGameId(gameId);
    setRenderLimit(STEAM_ACTIVITY_INITIAL_RENDER_LIMIT);
    if (listRef.current !== null) listRef.current.scrollTop = 0;
    rememberDeckyActivityGame(providerId, gameId);
  };

  const selectCalendarDay = (day: number): void => {
    pendingRevealedRowIndexRef.current = null;
    const nextDay = selectedCalendarDay === day ? undefined : day;
    setFilter("all");
    setSelectedCalendarDay(nextDay);
    setRenderLimit(STEAM_ACTIVITY_INITIAL_RENDER_LIMIT);
    if (listRef.current !== null) listRef.current.scrollTop = 0;
    rememberDeckyActivityCalendarDay(providerId, nextDay);
  };

  const revealMore = (lastRowIndex?: number): boolean => {
    if (renderedEntries.length >= entries.length) return false;
    if (lastRowIndex !== undefined) pendingRevealedRowIndexRef.current = lastRowIndex + 1;
    setRenderLimit((current) => {
      const next = Math.min(entries.length, current + STEAM_ACTIVITY_RENDER_STEP);
      rememberDeckyActivityRenderLimit(providerId, next);
      return next;
    });
    return true;
  };

  useLayoutEffect(() => {
    const rowIndex = pendingRevealedRowIndexRef.current;
    if (rowIndex === null) return;
    const target = dashboardRef.current?.querySelector<HTMLElement>(`[data-steam-activity-row-index='${rowIndex}']`);
    if (target === undefined || target === null) return;
    pendingRevealedRowIndexRef.current = null;
    if (takeDeckySteamGamepadFocus(target)) {
      scrollDeckyFocusTargetIntoView(target);
      playDeckySteamNavigationSound(target.ownerDocument);
    }
  }, [renderLimit]);

  useLayoutEffect(() => {
    if (!isActive) return;
    const dashboard = dashboardRef.current;
    const ownerWindow = dashboard?.ownerDocument.defaultView;
    if (dashboard === null || dashboard === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      // A real action must own GamepadUI focus for the shared footer to handle
      // the first shoulder press, as on the Profile and Games dashboards.
      const target = restorationTargetRef.current
        ?? dashboard.querySelector<HTMLElement>("[data-steam-activity-row='true']")
        ?? dashboard.querySelector<HTMLElement>("[role='button']");
      if (target !== null && !dashboard.contains(dashboard.ownerDocument.activeElement)) {
        takeDeckySteamGamepadFocus(target);
        if (initialPageState.scrollTop > 0 && listRef.current !== null) {
          listRef.current.scrollTop = initialPageState.scrollTop;
        } else {
          target.scrollIntoView({ block: "center", inline: "nearest" });
        }
      }
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  return (
    <>
      <main
        ref={dashboardRef}
        {...(isRa ? { "data-ac-ra-theme": "fullscreen" } : { "data-ac-steam-theme": "fullscreen" })}
        data-steam-full-screen-activity-dashboard
        style={getPageStyle()}
      >
        <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 6, height: "100%", minHeight: 0 }}>
          <div
            data-steam-activity-summary
            style={{ display: "grid", gridTemplateColumns: `${hasCompleteHistory ? "repeat(4" : "repeat(3"}, minmax(0, 1fr)) minmax(220px, 2.6fr)`, gap: 6, minWidth: 0 }}
          >
            <ActivityMetricCard
              icon={trophyIconUrl}
              label={isRa ? "Unlocks in view" : "Total Unlocks"}
              value={formatCount(isRa ? modeEntries.length : snapshot.summary.unlockedCount)}
            />
            <ActivityMetricCard icon={gamepadIconUrl} label={isRa ? "Games in History" : "Games with Unlocks"} value={formatCount(stats.gameCount)} />
            <ActivityMetricCard icon={unlockedLockIconUrl} label="This Month" value={formatCount(stats.thisMonthCount)} />
            {hasCompleteHistory ? <ActivityMetricCard icon={streakIconUrl} label="Current Streak" value={`${stats.currentStreak} days`} iconTone="original" iconSize={36} /> : null}
            <ActivityTrend stats={stats} interval={recentActivityInterval} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3.25fr) minmax(250px, 1.05fr)", gap: 8, minHeight: 0 }}>
            <Focusable
              flow-children="vertical"
              navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
              noFocusRing
              tabIndex={-1}
              style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 6, minWidth: 0, minHeight: 0 }}
            >
              <Focusable
                flow-children="left-right"
                navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
                noFocusRing
                tabIndex={-1}
                data-steam-activity-filter-row
                style={{ display: "flex", gap: 5, alignItems: "center", minWidth: 0 }}
              >
                <ActivityFilterButton label={`All Unlocks (${formatCount(allUnlocksCount)})`} selected={selectedCalendarDay === undefined && filter === "all"} onClick={() => selectFilter("all")} onBack={onBack} />
                <ActivityFilterButton label="Recent (90 days)" selected={selectedCalendarDay === undefined && filter === "recent"} onClick={() => selectFilter("recent")} onBack={onBack} />
                {hasCompleteHistory ? <ActivityFilterButton label="This Year" selected={selectedCalendarDay === undefined && filter === "year"} onClick={() => selectFilter("year")} onBack={onBack} /> : null}
                {hasCompleteHistory ? <ActivityFilterButton label="This Month" selected={selectedCalendarDay === undefined && filter === "month"} onClick={() => selectFilter("month")} onBack={onBack} /> : null}
                {hasCompleteHistory ? <ActivityFilterButton label="Current Streak" selected={selectedCalendarDay === undefined && filter === "streak"} onClick={() => selectFilter("streak")} onBack={onBack} /> : null}
                <ActivityGameFilter games={gameOptions} selectedGameId={selectedGame?.gameId} onChange={selectGame} onBack={onBack} />
              </Focusable>
              <Focusable
                ref={listRef}
                data-steam-activity-list
                flow-children="vertical"
                navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
                noFocusRing
                tabIndex={-1}
                onScroll={(event) => {
                  const list = event.currentTarget;
                  rememberDeckyActivityScrollTop(providerId, list.scrollTop);
                  if (list.scrollTop + list.clientHeight >= list.scrollHeight - STEAM_FULLSCREEN_GAME_ROW_HEIGHT) revealMore();
                }}
                style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 0, padding: "4px 5px 5px 4px", boxSizing: "border-box" }}
              >
                {entries.length > 0
                  ? renderedEntries.map((entry, rowIndex) => (
                    <AchievementActivityRow
                      key={`${entry.game.gameId}:${entry.achievement.achievementId}:${entry.achievement.unlockMode ?? "unknown"}:${getUnlockTime(entry) ?? "unknown"}`}
                      entry={entry}
                      providerId={providerId}
                      listRef={listRef}
                      elementRef={
                        initialPageState.focusTarget?.gameId === entry.game.gameId
                          && initialPageState.focusTarget.achievementId === entry.achievement.achievementId
                          && (initialPageState.focusTarget.unlockMode === undefined || initialPageState.focusTarget.unlockMode === entry.achievement.unlockMode)
                          && (initialPageState.focusTarget.unlockedAt === undefined || initialPageState.focusTarget.unlockedAt === getUnlockTime(entry))
                          ? (node) => { restorationTargetRef.current = node; }
                          : undefined
                      }
                      rowIndex={rowIndex}
                      onOpenAchievementDetail={onOpenAchievementDetail}
                      onBack={onBack}
                      onRevealMore={(lastRowIndex) => revealMore(lastRowIndex)}
                    />
                  ))
                  : <div style={{ ...getCardStyle(), padding: 18, color: steamTheme.color.textSecondary }}>No unlocks match these filters.</div>}
              </Focusable>
            </Focusable>

            <aside data-steam-activity-side-column style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflow: "hidden" }}>
              {hasCompleteHistory ? <ActivityInsights stats={stats} /> : null}
              <ActivityCalendar
                dayCounts={stats.dayCounts}
                weeks={calendarWeeks}
                selectedDay={selectedCalendarDay}
                onSelectDay={selectCalendarDay}
                onBack={onBack}
              />
            </aside>
          </div>
        </div>
      </main>
      {showSteamProfileFooter ? <DeckyFullScreenFooterOverlay
        activeNavigationItemId="activity"
        ariaLabel={`${isRa ? "RetroAchievements" : "Steam"} profile navigation`}
        navigationItems={isRa ? RETROACHIEVEMENTS_PROFILE_FOOTER_NAVIGATION_ITEMS : STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
        secondaryActionLabel="Top"
        onSecondaryAction={(document) => { jumpDeckySteamProfileTabToTop(document, "activity"); }}
        onPreviousNavigationItem={onOpenGames}
        onNextNavigationItem={isRa ? onOpenProfile ?? onOpenGames : onOpenSettings}
      /> : null}
    </>
  );
}
