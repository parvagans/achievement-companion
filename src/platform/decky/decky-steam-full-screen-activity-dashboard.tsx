import { Focusable, type FocusableProps } from "@decky/ui";
import type { AchievementHistorySnapshot, RecentUnlock } from "@core/domain";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type JSX,
  type KeyboardEventHandler,
} from "react";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyFullScreenFooterOverlay, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS } from "./decky-full-screen-footer-overlay";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import {
  getSteamFullscreenGameArtworkUrlByGameId,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT,
  STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH,
  STEAM_FULLSCREEN_GAME_ROW_HEIGHT,
} from "./decky-steam-game-artwork";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";

type ActivityFilter = "all" | "recent" | "year" | "month" | "streak";
type ActivityGamepadFocusHandler = NonNullable<FocusableProps["onGamepadFocus"]>;

const BLUE_ICON_FILTER =
  "brightness(0) saturate(100%) invert(62%) sepia(84%) saturate(1250%) hue-rotate(165deg) brightness(101%) contrast(101%)";
const ACTIVITY_TOP_PADDING_PX = 43;
const ACTIVITY_FOOTER_CLEARANCE_PX = 48;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function getLongestStreak(days: readonly number[]): number {
  let longest = 0;
  let current = 0;
  let previous: number | undefined;
  for (const day of days) {
    current = previous !== undefined && day - previous === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
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

function getActivityStats(entries: readonly RecentUnlock[]) {
  const days = getActivityDays(entries);
  const unlockedGameIds = new Set(entries.map((entry) => `${entry.game.providerId}:${entry.game.gameId}`));
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  return {
    unlockedCount: entries.length,
    gameCount: unlockedGameIds.size,
    thisMonthCount: entries.filter((entry) => (getUnlockTime(entry) ?? 0) >= thisMonthStart).length,
    currentStreak: getCurrentStreak(days),
    longestStreak: getLongestStreak(days),
  };
}

function Icon({ src, size = 26 }: { readonly src: string; readonly size?: number }): JSX.Element {
  return <img alt="" aria-hidden="true" src={src} style={{ width: size, height: size, filter: BLUE_ICON_FILTER }} />;
}

function getPageStyle(): CSSProperties {
  return {
    height: "100%",
    minHeight: 0,
    padding: `${ACTIVITY_TOP_PADDING_PX}px 12px ${ACTIVITY_FOOTER_CLEARANCE_PX}px`,
    boxSizing: "border-box",
    overflow: "hidden",
    background: "linear-gradient(135deg, #051521 0%, #07101a 58%, #041019 100%)",
    color: "#eff8ff",
  };
}

function getCardStyle(): CSSProperties {
  return {
    border: "1px solid rgba(74, 158, 207, 0.25)",
    borderRadius: 10,
    background: "linear-gradient(135deg, rgba(9, 34, 49, 0.98), rgba(7, 23, 34, 0.94))",
    boxShadow: "inset 0 1px 0 rgba(164, 224, 255, 0.04)",
    minWidth: 0,
  };
}

function ActivityMetricCard({ icon, label, value, emphasized = false, compact = false }: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly emphasized?: boolean;
  readonly compact?: boolean;
}): JSX.Element {
  return (
    <div style={{ ...getCardStyle(), display: "flex", alignItems: "center", gap: compact ? 5 : 8, padding: compact ? "5px 7px" : "8px 10px", minHeight: compact ? 38 : 54, ...(emphasized ? { borderColor: "#20c6ff", boxShadow: "0 0 17px rgba(16, 183, 255, 0.22), inset 0 1px 0 rgba(164, 224, 255, 0.1)" } : {}) }}>
      <Icon src={icon} size={compact ? 19 : 24} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: compact ? 13 : 15, fontWeight: 800, lineHeight: 1.05 }}>{value}</div>
        <div style={{ color: "#abc6da", fontSize: compact ? 8.5 : 9.5, lineHeight: 1.15 }}>{label}</div>
      </div>
    </div>
  );
}

function ActivityTrend({ entries }: { readonly entries: readonly RecentUnlock[] }): JSX.Element {
  const counts = useMemo(() => {
    const start = getLocalDayTimestamp(Date.now()) - 13 * DAY_MS;
    const dayCounts = new Map<number, number>();
    for (const entry of entries) {
      const timestamp = getUnlockTime(entry);
      if (timestamp !== undefined) {
        const day = getLocalDayTimestamp(timestamp);
        if (day >= start) dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      }
    }
    return Array.from({ length: 14 }, (_, index) => dayCounts.get(start + index * DAY_MS) ?? 0);
  }, [entries]);
  const maximum = Math.max(1, ...counts);
  return (
    <div style={{ ...getCardStyle(), padding: "7px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 3 }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>Recent Activity</div>
      <div style={{ display: "flex", alignItems: "end", gap: 3, height: 28 }}>
        {counts.map((count, index) => <span key={index} aria-label={`${count} unlocks`} style={{ display: "block", flex: "1 1 0", minHeight: 4, height: `${Math.max(10, (count / maximum) * 100)}%`, borderRadius: 2, background: count > 0 ? "linear-gradient(#4bd3ff, #1689c4)" : "#244258" }} />)}
      </div>
      <div style={{ color: "#9cb9ce", fontSize: 9 }}>Last 14 days</div>
    </div>
  );
}

function focusActivityTarget(source: HTMLElement, selector: string): boolean {
  const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
  const target = dashboard?.querySelector<HTMLElement>(selector);
  if (target === null || target === undefined) {
    return false;
  }

  target.focus();
  return true;
}

function createActivityFilterKeyDownHandler(): KeyboardEventHandler<HTMLDivElement> {
  return (event) => {
    if (event.key === "ArrowDown") {
      if (focusActivityTarget(event.currentTarget, "[data-steam-activity-row='true']")) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    const dashboard = event.currentTarget.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
    const filters = dashboard === null
      ? []
      : [...dashboard.querySelectorAll<HTMLElement>("[data-steam-activity-filter='true']")];
    const currentIndex = filters.indexOf(event.currentTarget);
    const nextIndex = currentIndex + (event.key === "ArrowLeft" ? -1 : 1);
    const nextFilter = filters[nextIndex];
    if (nextFilter === undefined) {
      return;
    }

    nextFilter.focus();
    event.preventDefault();
    event.stopPropagation();
  };
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
      onActivate={onClick}
      onClick={onClick}
      onCancel={onBack}
      onKeyDown={createActivityFilterKeyDownHandler()}
      onFocus={() => setFocused(true)}
      onGamepadFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        border: selected ? "1px solid #31bdff" : "1px solid rgba(103, 162, 198, 0.22)",
        borderRadius: 8,
        padding: "6px 10px",
        background: selected ? "linear-gradient(180deg, rgba(37, 129, 189, 0.55), rgba(21, 79, 123, 0.58))" : "rgba(13, 35, 49, 0.92)",
        color: selected ? "#f4fbff" : "#c4d9e8",
        fontSize: 10,
        fontWeight: 700,
        ...(focused ? {
          outline: "2px solid #bfeaff",
          outlineOffset: 1,
          boxShadow: "0 0 0 2px rgba(28, 143, 210, 0.55), 0 0 16px rgba(44, 194, 255, 0.5)",
          background: "linear-gradient(180deg, rgba(42, 144, 206, 0.8), rgba(23, 91, 139, 0.82))",
          color: "#ffffff",
        } : {}),
      }}
    >
      {label}
    </Focusable>
  );
}

function AchievementActivityRow({ entry, rowIndex, onOpenAchievementDetail, onBack }: {
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
  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (rowIndex !== 0 || event.key !== "ArrowUp") {
      return;
    }

    if (focusActivityTarget(event.currentTarget, "[data-steam-activity-filter-selected='true']")) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return (
    <Focusable className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} noFocusRing role="button" data-steam-activity-row="true" data-steam-activity-row-index={rowIndex} aria-label={`Open ${entry.achievement.title}`} onActivate={() => onOpenAchievementDetail(entry.game.gameId, entry.achievement.achievementId)} onClick={() => onOpenAchievementDetail(entry.game.gameId, entry.achievement.achievementId)} onCancel={onBack} onKeyDown={onKeyDown} onFocus={onFocus} onGamepadFocus={onGamepadFocus} onBlur={() => setFocused(false)} style={{ ...getCardStyle(), display: "grid", gridTemplateColumns: `${STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH}px 48px minmax(0, 1fr) 128px 16px`, alignItems: "center", gap: 8, flex: `0 0 ${STEAM_FULLSCREEN_GAME_ROW_HEIGHT}px`, minHeight: STEAM_FULLSCREEN_GAME_ROW_HEIGHT, padding: "2px 7px 2px 3px", boxSizing: "border-box", ...(focused ? { outline: "none", background: "linear-gradient(135deg, rgba(20, 87, 123, 0.95), rgba(9, 39, 58, 0.95))", boxShadow: "inset 0 0 0 2px #3bc7ff, inset 0 0 18px rgba(25, 184, 255, 0.2)" } : {}) }}>
      <DeckyGameArtwork compact height={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT} size={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_HEIGHT} width={STEAM_FULLSCREEN_GAME_ROW_ARTWORK_WIDTH} {...(heroArtworkUrl !== undefined ? { src: heroArtworkUrl } : {})} title={entry.game.title} />
      {entry.achievement.badgeImageUrl !== undefined ? <DeckyGameArtwork compact size={46} src={entry.achievement.badgeImageUrl} title={entry.achievement.title} /> : <span style={{ width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 7, background: "#18394d", color: "#dceefa", fontWeight: 800 }}>{entry.achievement.title.slice(0, 1)}</span>}
      <div style={{ minWidth: 0 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 800 }}>{entry.achievement.title}</div><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#b4cbdb", fontSize: 10 }}>{entry.achievement.description ?? entry.game.title}</div></div>
      <div style={{ borderLeft: "1px solid rgba(76, 148, 187, 0.22)", paddingLeft: 10, color: "#cce0ee", fontSize: 10, textAlign: "right" }}><div>Unlocked</div><div>{formatUnlockDate(timestamp)}</div></div>
      <span style={{ color: "#d9f1ff", fontSize: 27, lineHeight: 1 }}>›</span>
    </Focusable>
  );
}

function ActivityCalendar({ entries }: { readonly entries: readonly RecentUnlock[] }): JSX.Element {
  const counts = useMemo(() => {
    const values = new Map<number, number>();
    for (const entry of entries) { const time = getUnlockTime(entry); if (time !== undefined) { const day = getLocalDayTimestamp(time); values.set(day, (values.get(day) ?? 0) + 1); } }
    return values;
  }, [entries]);
  const start = getLocalDayTimestamp(Date.now()) - 83 * DAY_MS;
  const maximum = Math.max(1, ...counts.values());
  const days = Array.from({ length: 84 }, (_, index) => start + index * DAY_MS);
  return <div style={{ ...getCardStyle(), padding: 7 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800 }}><span>ACTIVITY CALENDAR</span><span style={{ color: "#a7c1d2", fontWeight: 500 }}>Last 12 weeks</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 2, marginTop: 6 }}>{days.map((day) => { const count = counts.get(day) ?? 0; const opacity = count === 0 ? 0.18 : 0.35 + (count / maximum) * 0.65; return <span key={day} aria-label={`${count} unlocks`} style={{ aspectRatio: "1", borderRadius: 2, background: `rgba(45, 184, 255, ${opacity})` }} />; })}</div><div style={{ color: "#9db7ca", fontSize: 8, marginTop: 4 }}>Unlocks by day — more activity is brighter.</div></div>;
}

export function DeckySteamFullScreenActivityDashboard({
  snapshot,
  onBack,
  onOpenAchievementDetail,
  onOpenPerfected,
  onOpenSettings,
}: {
  readonly snapshot: AchievementHistorySnapshot;
  readonly onBack: () => void;
  readonly onOpenAchievementDetail: (gameId: string, achievementId: string) => void;
  readonly onOpenPerfected: () => void;
  readonly onOpenSettings: () => void;
}): JSX.Element {
  const dashboardRef = useRef<HTMLElement>(null);
  const initialControllerFocusAppliedRef = useRef(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const entries = useMemo(() => filterActivityEntries(snapshot.entries, filter), [filter, snapshot.entries]);
  const stats = useMemo(() => getActivityStats(snapshot.entries), [snapshot.entries]);

  useLayoutEffect(() => {
    if (initialControllerFocusAppliedRef.current) return;
    const dashboard = dashboardRef.current;
    const ownerWindow = dashboard?.ownerDocument.defaultView;
    if (dashboard === null || dashboard === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      // A real action must own GamepadUI focus for the shared footer to handle
      // the first shoulder press, as on the Profile and Games dashboards.
      const target = dashboard.querySelector<HTMLElement>("[data-steam-activity-row='true']")
        ?? dashboard.querySelector<HTMLElement>("[role='button']");
      if (target !== null) {
        target.focus();
        initialControllerFocusAppliedRef.current = true;
      }
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      <main ref={dashboardRef} data-steam-full-screen-activity-dashboard style={getPageStyle()}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", margin: "0 0 5px 2px", lineHeight: 1.1 }}>
          ACTIVITY
        </div>
        <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 6, height: "calc(100% - 19px)", minHeight: 0 }}>
          <div
            data-steam-activity-summary
            style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) minmax(220px, 2.6fr)", gap: 6, minWidth: 0 }}
          >
            <ActivityMetricCard icon={trophyIconUrl} label="Loaded Unlocks" value={formatCount(stats.unlockedCount)} emphasized />
            <ActivityMetricCard icon={gamepadIconUrl} label="Games with Unlocks" value={formatCount(stats.gameCount)} />
            <ActivityMetricCard icon={calendarIconUrl} label="This Month" value={formatCount(stats.thisMonthCount)} />
            <ActivityMetricCard icon={clockIconUrl} label="Current Streak" value={`${stats.currentStreak} days`} />
            <ActivityTrend entries={snapshot.entries} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3.25fr) minmax(250px, 1.05fr)", gap: 8, minHeight: 0 }}>
            <section style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 6, minWidth: 0, minHeight: 0 }}>
              <Focusable
                flow-children="left-right"
                noFocusRing
                tabIndex={-1}
                data-steam-activity-filter-row
                style={{ display: "flex", gap: 5, alignItems: "center", minWidth: 0 }}
              >
                <ActivityFilterButton label={`All Unlocks (${formatCount(snapshot.entries.length)})`} selected={filter === "all"} onClick={() => setFilter("all")} onBack={onBack} />
                <ActivityFilterButton label="Recent (90 days)" selected={filter === "recent"} onClick={() => setFilter("recent")} onBack={onBack} />
                <ActivityFilterButton label="This Year" selected={filter === "year"} onClick={() => setFilter("year")} onBack={onBack} />
                <ActivityFilterButton label="This Month" selected={filter === "month"} onClick={() => setFilter("month")} onBack={onBack} />
                <ActivityFilterButton label="Current Streak" selected={filter === "streak"} onClick={() => setFilter("streak")} onBack={onBack} />
                <span style={{ marginLeft: "auto", color: "#afc6d5", fontSize: 9 }}>Newest First</span>
              </Focusable>
              <Focusable
                flow-children="vertical"
                noFocusRing
                tabIndex={-1}
                style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 0, padding: "4px 5px 5px 4px", boxSizing: "border-box" }}
              >
                {entries.length > 0
                  ? entries.map((entry, rowIndex) => (
                    <AchievementActivityRow
                      key={`${entry.game.gameId}:${entry.achievement.achievementId}:${getUnlockTime(entry) ?? "unknown"}`}
                      entry={entry}
                      rowIndex={rowIndex}
                      onOpenAchievementDetail={onOpenAchievementDetail}
                      onBack={onBack}
                    />
                  ))
                  : <div style={{ ...getCardStyle(), padding: 18, color: "#b5cbd9" }}>No timestamped unlocks match this filter.</div>}
              </Focusable>
            </section>

            <aside data-steam-activity-side-column style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflow: "hidden" }}>
              <div style={{ ...getCardStyle(), padding: 7 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800 }}>
                  ACTIVITY OVERVIEW <span style={{ color: "#9ebacd", fontWeight: 500 }}>(STEAM)</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 5 }}>
                  <ActivityMetricCard compact icon={trophyIconUrl} label="Loaded Unlocks" value={formatCount(stats.unlockedCount)} />
                  <ActivityMetricCard compact icon={gamepadIconUrl} label="Games with Unlocks" value={formatCount(stats.gameCount)} />
                  <ActivityMetricCard compact icon={calendarIconUrl} label="This Month" value={formatCount(stats.thisMonthCount)} />
                  <ActivityMetricCard compact icon={clockIconUrl} label="Longest Streak" value={`${stats.longestStreak} days`} />
                </div>
              </div>
              <ActivityCalendar entries={snapshot.entries} />
            </aside>
          </div>
        </div>
      </main>
      <DeckyFullScreenFooterOverlay
        activeNavigationItemId="activity"
        ariaLabel="Steam profile navigation"
        navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS}
        onBack={onBack}
        onPreviousNavigationItem={onOpenPerfected}
        onNextNavigationItem={onOpenSettings}
      />
    </>
  );
}
