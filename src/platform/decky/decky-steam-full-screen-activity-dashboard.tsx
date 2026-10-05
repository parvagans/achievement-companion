import {
  Focusable,
  GamepadButton,
  NavEntryPositionPreferences,
  type FocusableProps,
  type GamepadEvent,
} from "@decky/ui";
import type { AchievementHistorySnapshot, RecentUnlock } from "@core/domain";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type JSX,
  type RefCallback,
} from "react";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyFullScreenFooterOverlay, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS } from "./decky-full-screen-footer-overlay";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { buildSteamActivityStats, type SteamActivityStats } from "./decky-steam-activity-data";
import {
  getSteamFullscreenGameArtworkUrlByGameId,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH,
  STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
} from "./decky-steam-game-artwork";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import streakIconUrl from "./assets/activity-flame.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import unlockedLockIconUrl from "./assets/unlocked-lock.svg";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { steamRecipes, steamTheme } from "./steam-theme";
import {
  readDeckySteamActivityPageState,
  rememberDeckySteamActivityFilter,
  rememberDeckySteamActivityFocusTarget,
  rememberDeckySteamActivityRenderLimit,
  type DeckySteamActivityFilter,
} from "./decky-steam-full-screen-activity-state";

type ActivityFilter = DeckySteamActivityFilter;
type ActivityGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

const ACTIVITY_TOP_PADDING_PX = 43;
const ACTIVITY_FOOTER_CLEARANCE_PX = 48;
const DAY_MS = 24 * 60 * 60 * 1000;
const STEAM_ACTIVITY_INITIAL_RENDER_LIMIT = 12;
const STEAM_ACTIVITY_RENDER_STEP = 12;

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

function filterActivityEntries(entries: readonly RecentUnlock[], filter: ActivityFilter, now = Date.now()): readonly RecentUnlock[] {
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

function getCardStyle(): CSSProperties {
  return {
    ...steamRecipes.card("fullscreen"),
    boxShadow: "inset 0 1px 0 rgba(164, 224, 255, 0.04)",
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
        <div style={{ color: "#abc6da", fontSize: 9.5, lineHeight: 1.15 }}>{label}</div>
      </div>
    </div>
  );
}

function ActivityTrend({ stats }: { readonly stats: SteamActivityStats }): JSX.Element {
  const start = getLocalDayTimestamp(Date.now()) - 29 * DAY_MS;
  const counts = Array.from({ length: 30 }, (_, index) => stats.dayCounts.get(start + index * DAY_MS) ?? 0);
  const maximum = Math.max(1, ...counts);
  return (
    <div style={{ ...getCardStyle(), padding: "7px 10px", display: "grid", gridTemplateColumns: "minmax(92px,.7fr) minmax(0,1.6fr)", alignItems: "end", gap: 9 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Recent Activity</div>
        <div style={{ color: "#9cb9ce", fontSize: 9, marginTop: 2 }}>Last 30 days</div>
        <div style={{ color: "#d8f3ff", fontSize: 9.5, fontWeight: 800, marginTop: 3 }}>{`${formatCount(stats.recentThirtyDayCount)} unlock${stats.recentThirtyDayCount === 1 ? "" : "s"}`}</div>
      </div>
      <div style={{ display: "flex", alignItems: "end", gap: 2, height: 34 }}>
        {counts.map((count, index) => <span key={index} aria-label={`${count} unlocks`} style={{ display: "block", flex: "1 1 0", minWidth: 2, minHeight: 4, height: `${count === 0 ? 14 : Math.max(20, (count / maximum) * 100)}%`, borderRadius: 2, background: count > 0 ? "linear-gradient(#55d7ff, #1489c8)" : "#244258" }} />)}
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
    <div style={{ ...getCardStyle(), display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", alignItems: "center", gap: 5, padding: "6px 6px", minHeight: 46, boxSizing: "border-box" }}>
      <Icon src={icon} size={iconSize} tone={tone} />
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#a9c8da", fontSize: 8.5, lineHeight: 1.05 }}>{title}</div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#f0f9ff", fontSize: 11.5, fontWeight: 800, lineHeight: 1.15, marginTop: 1 }}>{value}</div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#8fb0c4", fontSize: 8.5, lineHeight: 1.1, marginTop: 1 }}>{detail}</div>
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
  selector: string,
): void {
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const target = dashboard?.querySelector<HTMLElement>(selector);
  if (!takeDeckySteamGamepadFocus(target)) {
    return;
  }

  // Let GamepadUI perform the focus transfer through its registered node. Stop
  // only this directional navigation so it cannot continue into Steam chrome.
  event.preventDefault();
  event.stopPropagation();
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
      onGamepadDirection={(event) => {
        if (event.detail.button === GamepadButton.DIR_DOWN) {
          moveActivityGamepadFocus(event, event.currentTarget as HTMLElement, "[data-steam-activity-row='true']");
        } else if (event.detail.button === GamepadButton.DIR_UP) {
          moveActivityGamepadFocus(event, event.currentTarget as HTMLElement, "[data-steam-activity-filter-selected='true']");
        }
      }}
      onFocus={() => setFocused(true)}
      onGamepadFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...steamRecipes.filter("fullscreen", selected),
        minHeight: 30,
        padding: "6px 10px",
        fontSize: 10,
        fontWeight: 700,
        ...(focused ? {
          outline: `2px solid ${steamTheme.focus.border}`,
          outlineOffset: 1,
          boxShadow: steamTheme.focus.shadow,
          background: steamTheme.focus.background,
          color: steamTheme.color.textPrimary,
        } : {}),
      }}
    >
      {label}
    </Focusable>
  );
}

function AchievementActivityRow({ elementRef, entry, rowIndex, onOpenAchievementDetail, onBack }: {
  readonly elementRef?: RefCallback<HTMLDivElement> | undefined;
  readonly entry: RecentUnlock;
  readonly rowIndex: number;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const timestamp = getUnlockTime(entry);
  const heroArtworkUrl = getSteamFullscreenGameArtworkUrlByGameId(entry.game.gameId, {
    ...(entry.game.coverImageUrl !== undefined ? { coverImageUrl: entry.game.coverImageUrl } : {}),
  });
  const onFocus: FocusEventHandler<HTMLElement> = (event) => { setFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); };
  const onGamepadFocus: ActivityGamepadFocusHandler = (event) => { setFocused(true); scrollDeckyFocusTargetIntoView(event.currentTarget); };
  return (
    <Focusable ref={elementRef} className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} noFocusRing role="button" data-steam-activity-row="true" data-steam-activity-row-index={rowIndex} aria-label={`Open ${entry.achievement.title}`} onActivate={() => { rememberDeckySteamActivityFocusTarget({ gameId: entry.game.gameId, achievementId: entry.achievement.achievementId }); onOpenAchievementDetail(entry.game.gameId, entry.achievement.achievementId); }} onClick={() => { rememberDeckySteamActivityFocusTarget({ gameId: entry.game.gameId, achievementId: entry.achievement.achievementId }); onOpenAchievementDetail(entry.game.gameId, entry.achievement.achievementId); }} onCancel={onBack} {...(rowIndex === 0 ? { onGamepadDirection: (event: GamepadEvent) => { if (event.detail.button === GamepadButton.DIR_UP) moveActivityGamepadFocus(event, event.currentTarget as HTMLElement, "[data-steam-activity-filter-selected='true']"); } } : {})} onFocus={(event) => { rememberDeckySteamActivityFocusTarget({ gameId: entry.game.gameId, achievementId: entry.achievement.achievementId }); onFocus(event); }} onGamepadFocus={(event) => { rememberDeckySteamActivityFocusTarget({ gameId: entry.game.gameId, achievementId: entry.achievement.achievementId }); onGamepadFocus(event); }} onBlur={() => setFocused(false)} style={{ ...getCardStyle(), display: "grid", gridTemplateColumns: `${STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}px 48px minmax(0, 1fr) 128px 16px`, alignItems: "center", gap: 8, flex: `0 0 ${STEAM_FULLSCREEN_GAME_ROW_HEIGHT}px`, minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT, padding: "2px 7px 2px 3px", boxSizing: "border-box", ...(focused ? { outline: "none", background: "linear-gradient(135deg, rgba(20, 87, 123, 0.95), rgba(9, 39, 58, 0.95))", boxShadow: "inset 0 0 0 2px #3bc7ff, inset 0 0 18px rgba(25, 184, 255, 0.2)" } : {}) }}>
      <DeckyGameArtwork compact height={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT} size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT} width={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH} {...(heroArtworkUrl !== undefined ? { src: heroArtworkUrl } : {})} title={entry.game.title} />
      {entry.achievement.badgeImageUrl !== undefined ? <DeckyGameArtwork compact size={46} src={entry.achievement.badgeImageUrl} title={entry.achievement.title} /> : <span style={{ width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 7, background: "#18394d", color: "#dceefa", fontWeight: 800 }}>{entry.achievement.title.slice(0, 1)}</span>}
      <div style={{ minWidth: 0 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 800 }}>{entry.achievement.title}</div><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#b4cbdb", fontSize: 10 }}>{entry.achievement.description ?? entry.game.title}</div></div>
      <div style={{ borderLeft: "1px solid rgba(76, 148, 187, 0.22)", paddingLeft: 10, color: "#cce0ee", fontSize: 10, textAlign: "right" }}><div>Unlocked</div><div>{formatUnlockDate(timestamp)}</div></div>
      <span style={{ color: "#d9f1ff", fontSize: 27, lineHeight: 1 }}>›</span>
    </Focusable>
  );
}

function ActivityCalendar({ dayCounts }: { readonly dayCounts: ReadonlyMap<number, number> }): JSX.Element {
  const today = getLocalDayTimestamp(Date.now());
  const mondayOffset = (new Date(today).getUTCDay() + 6) % 7;
  // Use full Monday-Sunday weeks so the current local day is always present.
  const start = today - (mondayOffset + 77) * DAY_MS;
  const maximum = Math.max(1, ...dayCounts.values());
  const days = Array.from({ length: 84 }, (_, index) => start + index * DAY_MS);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const intensity = (count: number): string => count === 0 ? "#1d3c51" : count / maximum >= .75 ? "#50d5ff" : count / maximum >= .45 ? "#2fb9ef" : count / maximum >= .2 ? "#267da9" : "#21546f";
  return (
    <div style={{ ...getCardStyle(), padding: 7, display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, flex: "0 0 auto" }}>
        <span>ACTIVITY CALENDAR</span>
        <span style={{ color: "#a7c1d2", fontWeight: 500 }}>Last 12 weeks</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "22px repeat(12, minmax(0, 1fr))", gridTemplateRows: "repeat(7, minmax(0, 1fr))", gap: 2, marginTop: 6, alignItems: "stretch", flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        {labels.map((label, row) => (
          <span key={label} style={{ gridColumn: 1, gridRow: row + 1, color: "#b6cbd9", fontSize: 8 }}>{label}</span>
        ))}
        {days.map((day) => {
          const count = dayCounts.get(day) ?? 0;
          const offset = Math.floor((day - start) / DAY_MS);
          return (
            <span
              key={day}
              aria-label={`${count} unlocks`}
              style={{
                gridColumn: Math.floor(offset / 7) + 2,
                gridRow: offset % 7 + 1,
                width: "100%",
                height: "100%",
                minHeight: 0,
                boxSizing: "border-box",
                borderRadius: 2,
                background: intensity(count),
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: "#a9c1d1", fontSize: 8, marginTop: 6, flex: "0 0 auto" }}>
        <span>Less</span>
        {[0, .1, .25, .5, 1].map((level) => (
          <span key={level} style={{ width: 12, height: 12, borderRadius: 2, background: intensity(level * maximum) }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function DeckySteamFullScreenActivityDashboard({
  snapshot,
  isActive = true,
  showSteamProfileFooter = true,
  onBack,
  onOpenAchievementDetail,
  onOpenGames,
  onOpenSettings,
}: {
  readonly snapshot: AchievementHistorySnapshot;
  readonly isActive?: boolean;
  readonly showSteamProfileFooter?: boolean;
  readonly onBack: () => void;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onOpenGames: () => void;
  readonly onOpenSettings: () => void;
}): JSX.Element {
  const initialPageState = useRef(readDeckySteamActivityPageState()).current;
  const dashboardRef = useRef<HTMLElement>(null);
  const restorationTargetRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>(initialPageState.filter);
  const [renderLimit, setRenderLimit] = useState(initialPageState.renderLimit);
  const entries = useMemo(() => filterActivityEntries(snapshot.entries, filter), [filter, snapshot.entries]);
  const renderedEntries = entries.slice(0, renderLimit);
  const stats = useMemo(() => buildSteamActivityStats(snapshot.entries), [snapshot.entries]);

  const selectFilter = (nextFilter: ActivityFilter): void => {
    setFilter(nextFilter);
    setRenderLimit(STEAM_ACTIVITY_INITIAL_RENDER_LIMIT);
    rememberDeckySteamActivityFilter(nextFilter);
  };

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
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  return (
    <>
      <main ref={dashboardRef} data-ac-steam-theme="fullscreen" data-steam-full-screen-activity-dashboard style={getPageStyle()}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", margin: "0 0 5px 2px", lineHeight: 1.1 }}>
          ACTIVITY
        </div>
        <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 6, height: "calc(100% - 19px)", minHeight: 0 }}>
          <div
            data-steam-activity-summary
            style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) minmax(220px, 2.6fr)", gap: 6, minWidth: 0 }}
          >
            <ActivityMetricCard icon={trophyIconUrl} label="Total Unlocks" value={formatCount(snapshot.summary.unlockedCount)} />
            <ActivityMetricCard icon={gamepadIconUrl} label="Games with Unlocks" value={formatCount(stats.gameCount)} />
            <ActivityMetricCard icon={unlockedLockIconUrl} label="This Month" value={formatCount(stats.thisMonthCount)} />
            <ActivityMetricCard icon={streakIconUrl} label="Current Streak" value={`${stats.currentStreak} days`} iconTone="original" iconSize={36} />
            <ActivityTrend stats={stats} />
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
                <ActivityFilterButton label={`All Unlocks (${formatCount(snapshot.summary.unlockedCount)})`} selected={filter === "all"} onClick={() => selectFilter("all")} onBack={onBack} />
                <ActivityFilterButton label="Recent (90 days)" selected={filter === "recent"} onClick={() => selectFilter("recent")} onBack={onBack} />
                <ActivityFilterButton label="This Year" selected={filter === "year"} onClick={() => selectFilter("year")} onBack={onBack} />
                <ActivityFilterButton label="This Month" selected={filter === "month"} onClick={() => selectFilter("month")} onBack={onBack} />
                <ActivityFilterButton label="Current Streak" selected={filter === "streak"} onClick={() => selectFilter("streak")} onBack={onBack} />
                <span style={{ marginLeft: "auto", color: "#afc6d5", fontSize: 9 }}>Newest First</span>
              </Focusable>
              <Focusable
                flow-children="vertical"
                navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
                noFocusRing
                tabIndex={-1}
                style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 0, padding: "4px 5px 5px 4px", boxSizing: "border-box" }}
              >
                {entries.length > 0
                  ? <>
                    {renderedEntries.map((entry, rowIndex) => (
                    <AchievementActivityRow
                      key={`${entry.game.gameId}:${entry.achievement.achievementId}:${getUnlockTime(entry) ?? "unknown"}`}
                      entry={entry}
                      elementRef={
                        initialPageState.focusTarget?.gameId === entry.game.gameId
                          && initialPageState.focusTarget.achievementId === entry.achievement.achievementId
                          ? (node) => { restorationTargetRef.current = node; }
                          : undefined
                      }
                      rowIndex={rowIndex}
                      onOpenAchievementDetail={onOpenAchievementDetail}
                      onBack={onBack}
                    />
                    ))}
                    {renderedEntries.length < entries.length ? <Focusable
                      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
                      noFocusRing
                      role="button"
                      aria-label={`Show ${Math.min(STEAM_ACTIVITY_RENDER_STEP, entries.length - renderedEntries.length)} more unlocks`}
                      onActivate={() => { setRenderLimit((current) => { const next = current + STEAM_ACTIVITY_RENDER_STEP; rememberDeckySteamActivityRenderLimit(next); return next; }); }}
                      onClick={() => { setRenderLimit((current) => { const next = current + STEAM_ACTIVITY_RENDER_STEP; rememberDeckySteamActivityRenderLimit(next); return next; }); }}
                      onCancel={onBack}
                      style={{ ...getCardStyle(), minHeight: 36, display: "grid", placeItems: "center", color: "#d8ecf9", fontSize: 11, fontWeight: 800 }}
                    >
                      {`Show ${Math.min(STEAM_ACTIVITY_RENDER_STEP, entries.length - renderedEntries.length)} more`}
                    </Focusable> : null}
                  </>
                  : <div style={{ ...getCardStyle(), padding: 18, color: "#b5cbd9" }}>No timestamped unlocks match this filter.</div>}
              </Focusable>
            </Focusable>

            <aside data-steam-activity-side-column style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflow: "hidden" }}>
              <ActivityInsights stats={stats} />
              <ActivityCalendar dayCounts={stats.dayCounts} />
            </aside>
          </div>
        </div>
      </main>
      {showSteamProfileFooter ? <DeckyFullScreenFooterOverlay
        activeNavigationItemId="activity"
        ariaLabel="Steam profile navigation"
        navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
        onPreviousNavigationItem={onOpenGames}
        onNextNavigationItem={onOpenSettings}
      /> : null}
    </>
  );
}
