import { Focusable, GamepadButton } from "@decky/ui";
import { useMemo, useState, type JSX } from "react";
import type { RecentActivityInterval } from "@core/settings";
import { buildRecentActivityTrend, type SteamActivityStats } from "./decky-steam-activity-data";
import { buildSteamActivityCalendarModel, type SteamActivityCalendarIntensity, type SteamActivityCalendarWeeks } from "./decky-steam-activity-calendar-model";
import { getLocalActivityCalendarDayTimestamp as getLocalDayTimestamp } from "./decky-activity-calendar-model";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { getQamPassiveCardFocusStyle, qamActivityCalendarColors } from "./decky-qam-theme";
import { steamTheme } from "./steam-theme";
import { getCardStyle, handleActivityCalendarDirection, handleActivityTrendDirection, moveActivityGamepadFocus } from "./decky-full-screen-activity-controls";
import { activityCalendarPeriod, ACTIVITY_DAY_MS as DAY_MS } from "./decky-full-screen-activity-model";
import type { ActivitySelectedPeriod } from "./decky-steam-full-screen-activity-state";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import streakIconUrl from "./assets/activity-flame.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import unlockedLockIconUrl from "./assets/unlocked-lock.svg";
const formatCount = (value: number): string => value.toLocaleString();
interface ActivityInspection { readonly label: string; readonly count: number; }

export function ActivityAnalytics({ stats, unlockCount, isRa, complete, filtered, interval, weeks, selectedPeriod, onSelectPeriod, onBack }: {
  readonly stats: SteamActivityStats;
  readonly unlockCount: number;
  readonly isRa: boolean;
  readonly complete: boolean;
  readonly filtered: boolean;
  readonly interval: RecentActivityInterval;
  readonly weeks: SteamActivityCalendarWeeks;
  readonly selectedPeriod: ActivitySelectedPeriod | undefined;
  readonly onSelectPeriod: (period: ActivitySelectedPeriod) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const [inspection, setInspection] = useState<{ stats: SteamActivityStats; interval: RecentActivityInterval; weeks: SteamActivityCalendarWeeks; value: ActivityInspection }>();
  const inspect = (value: ActivityInspection): void => setInspection({ stats, interval, weeks, value });
  const currentInspection = inspection?.stats === stats && inspection.interval === interval && inspection.weeks === weeks ? inspection.value : undefined;
  return <div data-activity-analytics style={{ display: "grid", gridTemplateRows: "52px minmax(0, 1fr) 32px", height: "100%", minHeight: 0, minWidth: 0, gap: 8 }}>
      <div data-steam-activity-summary style={{ ...getCardStyle(), padding: "3px 6px", minHeight: 0, boxSizing: "border-box" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", height: "100%", minHeight: 0 }}>
          <ActivityMetricCard icon={trophyIconUrl} iconSize={18} label={isRa || filtered || !complete ? "Unlocks in View" : "Total Unlocks"} value={formatCount(unlockCount)} />
          <ActivityMetricCard icon={gamepadIconUrl} iconSize={18} label={isRa ? "Games in History" : "Games with Unlocks"} value={formatCount(stats.gameCount)} />
          <ActivityMetricCard icon={unlockedLockIconUrl} iconSize={18} label="This Month" value={formatCount(stats.thisMonthCount)} />
        </div>
      </div>
    <div data-activity-analytics-panels style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.25fr)", gap: 8, minWidth: 0, minHeight: 0 }}>
      {complete ? <ActivityInsights stats={stats} /> : <div style={{ ...getCardStyle(), display: "grid", alignContent: "center", gap: 8, minHeight: 0, fontSize: steamTheme.type.fullscreen.metadata, boxSizing: "border-box" }}>
        <strong>History preview</strong>
        <span>Counts cover loaded history only. Full-history insights are unavailable.</span>
      </div>}
      <div style={{ display: "grid", gridTemplateRows: "minmax(56px, .32fr) minmax(0, 1fr)", gap: 8, minWidth: 0, minHeight: 0 }}>
        <ActivityTrend stats={stats} interval={interval} selectedPeriod={selectedPeriod} onSelectPeriod={onSelectPeriod} onInspect={inspect} onBack={onBack} />
        <ActivityCalendar dayCounts={stats.dayCounts} weeks={weeks} selectedPeriod={selectedPeriod} onSelectDay={(day) => onSelectPeriod(activityCalendarPeriod(day))} onInspect={inspect} onBack={onBack} />
      </div>
    </div>
    <SelectedPeriodCard period={selectedPeriod} inspection={currentInspection} unlockCount={unlockCount} onBack={onBack} />
  </div>;
}

function SelectedPeriodCard({ period, inspection, unlockCount, onBack }: {
  readonly period: ActivitySelectedPeriod | undefined;
  readonly inspection: ActivityInspection | undefined;
  readonly unlockCount: number;
  readonly onBack: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const label = inspection?.label ?? period?.label;
  const count = inspection?.count ?? unlockCount;
  const description = label === undefined ? "Focus a chart bar or calendar day · A to view unlocks"
    : `${label} · ${formatCount(count)} unlock${count === 1 ? "" : "s"}`;
  return <Focusable noFocusRing data-activity-selected-period data-activity-analytics-focus="period" onCancel={onBack}
    onFocus={() => setFocused(true)} onGamepadFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)} onGamepadBlur={() => setFocused(false)}
    onGamepadDirection={(event) => {
      const source = event.currentTarget as HTMLElement;
      const dashboard = source.closest<HTMLElement>("[data-steam-full-screen-activity-dashboard]");
      const target = event.detail.button === GamepadButton.DIR_UP
        ? dashboard?.querySelector<HTMLElement>("[data-steam-activity-calendar-current='true']")
        : event.detail.button === GamepadButton.DIR_DOWN ? source : undefined;
      if (target !== undefined) moveActivityGamepadFocus(event, source, target);
    }} style={{ ...getCardStyle(), ...getQamPassiveCardFocusStyle(focused), display: "flex", alignItems: "center", gap: 12, padding: "4px 10px", minHeight: 0, boxSizing: "border-box", scrollMarginBlock: 0 }}>
    <strong style={{ flexShrink: 0, fontSize: steamTheme.type.fullscreen.caption }}>{inspection ? "Focused Date / Period" : "Selected Date / Period"}</strong>
    <span title={description} style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{description}</span>
  </Focusable>;
}

function Icon({ src, size = 26, tone = "blue" }: { readonly src: string; readonly size?: number; readonly tone?: "blue" | "gold" | "original" }): JSX.Element {
  return <img alt="" aria-hidden="true" src={src} style={{ width: size, height: size, ...(tone === "original" ? {} : { filter: tone === "gold" ? steamTheme.iconFilter.reward : steamTheme.iconFilter.accent }) }} />;
}

function ActivityMetricCard({ icon, label, value, iconTone = "blue", iconSize = 24 }: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly iconTone?: "blue" | "gold" | "original";
  readonly iconSize?: number;
}): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "2px 8px", minHeight: 0, minWidth: 0, boxSizing: "border-box" }}>
      <Icon src={icon} size={iconSize} tone={iconTone} />
      <div style={{ minWidth: 0, textAlign: "center" }}>
        <div style={{ fontSize: steamTheme.type.fullscreen.heading, fontWeight: 800, lineHeight: 1.05 }}>{value}</div>
        <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.15 }}>{label}</div>
      </div>
    </div>
  );
}

function ActivityTrend({ stats, interval, selectedPeriod, onSelectPeriod, onInspect, onBack }: {
  readonly stats: SteamActivityStats;
  readonly interval: RecentActivityInterval;
  readonly selectedPeriod: ActivitySelectedPeriod | undefined;
  readonly onSelectPeriod: (period: ActivitySelectedPeriod) => void;
  readonly onInspect: (inspection: ActivityInspection) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const trend = buildRecentActivityTrend(stats.dayCounts, interval);
  const maximum = Math.max(1, ...trend.bars.map(({ count }) => count));
  return (
    <div style={{ ...getCardStyle(), padding: "5px 8px", display: "grid", gridTemplateColumns: "minmax(92px,.7fr) minmax(0,1.6fr)", alignItems: "center", gap: 9, minHeight: 0, boxSizing: "border-box" }}>
      <div>
        <div style={{ fontSize: 12, lineHeight: 1.1, fontWeight: 700 }}>Recent Activity</div>
        <div style={{ color: steamTheme.color.textMuted, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.1, marginTop: 2 }}>{trend.label}</div>
        <div style={{ color: steamTheme.color.textPrimary, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.1, fontWeight: 800, marginTop: 2 }}>{`${formatCount(trend.total)} unlock${trend.total === 1 ? "" : "s"}`}</div>
      </div>
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "flex", alignItems: "end", gap: 2, height: "100%", minHeight: 0, padding: 3, boxSizing: "border-box", scrollMarginBlock: 0 }}>
        {trend.bars.map((bar) => <ActivityTrendBar key={bar.startDay} count={bar.count} label={bar.label} startDay={bar.startDay} maximum={maximum}
          selected={selectedPeriod?.startDay === bar.startDay && selectedPeriod.endDayExclusive === bar.endDayExclusive}
          onSelect={() => onSelectPeriod({ startDay: bar.startDay, endDayExclusive: bar.endDayExclusive, label: bar.label, interval: bar.interval, source: "trend" })}
          onInspect={() => onInspect({ label: bar.label, count: bar.count })}
          onBack={onBack} />)}
      </Focusable>
    </div>
  );
}

function ActivityTrendBar({ count, label, startDay, maximum, selected, onSelect, onInspect, onBack }: {
  readonly count: number; readonly label: string; readonly startDay: number; readonly maximum: number; readonly selected: boolean;
  readonly onSelect: () => void; readonly onInspect: () => void; readonly onBack: () => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  return <Focusable role="button" noFocusRing data-activity-trend-bar={startDay} data-activity-analytics-focus={`trend:${startDay}`}
    aria-label={`${label}: ${count} unlock${count === 1 ? "" : "s"}`} aria-pressed={selected}
    onActivate={onSelect} onClick={onSelect} onCancel={onBack} onGamepadDirection={handleActivityTrendDirection}
    onFocus={() => { setFocused(true); onInspect(); }} onGamepadFocus={() => { setFocused(true); onInspect(); }}
    onBlur={() => setFocused(false)} onGamepadBlur={() => setFocused(false)}
    style={{ display: "flex", alignItems: "end", flex: "1 1 0", height: "100%", minWidth: 0, padding: 0, border: 0, background: "transparent", outline: "none", borderRadius: 2, scrollMarginBlock: 0,
      boxShadow: focused ? steamTheme.focus.calendarDayShadow : selected ? `inset 0 0 0 1px ${steamTheme.color.textPrimary}` : "none" }}>
    <span aria-hidden="true" style={{ display: "block", width: "100%", minHeight: 4, height: `${count === 0 ? 6 : Math.max(12, count / maximum * 100)}%`, borderRadius: 2, background: count > 0 ? steamTheme.surface.activityTrendFill : steamTheme.surface.activityTrendEmpty }} />
  </Focusable>;
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
    <div style={{ ...getCardStyle(true), display: "grid", alignContent: "center", gap: 3, padding: "6px 8px", minHeight: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Icon src={icon} size={iconSize} tone={tone} />
        <span style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.2 }}>{title}</span>
      </div>
      <div title={value} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: steamTheme.color.textPrimary, fontSize: steamTheme.type.fullscreen.title, fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
      <div style={{ color: steamTheme.color.textMuted, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.2 }}>{detail}</div>
    </div>
  );
}

function ActivityInsights({ stats }: { readonly stats: SteamActivityStats }): JSX.Element {
  return (
    <div data-steam-activity-insights style={{ ...getCardStyle(), padding: 6, minHeight: 0, boxSizing: "border-box", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 6 }}>
      <div style={{ fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1, fontWeight: 800 }}>ACTIVITY INSIGHTS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridTemplateRows: "repeat(2, minmax(0, 1fr))", gap: 6, minHeight: 0 }}>
        <ActivityInsightCard icon={streakIconUrl} title="Current Streak" value={`${stats.currentStreak} days`} detail="Today or yesterday" tone="original" iconSize={18} />
        <ActivityInsightCard icon={streakIconUrl} title="Longest Streak" value={`${stats.longestStreak} days`} detail="Consecutive days" tone="original" iconSize={18} />
        <ActivityInsightCard icon={calendarIconUrl} title="Best Month" value={stats.bestMonth.value} detail={stats.bestMonth.detail} />
        <ActivityInsightCard icon={clockIconUrl} title="Most Active Day" value={stats.mostActiveDay.value} detail={stats.mostActiveDay.detail} />
      </div>
    </div>
  );
}

const ACTIVITY_CALENDAR_COLORS: Record<SteamActivityCalendarIntensity, string> = qamActivityCalendarColors;

function ActivityCalendarDay({ day, count, intensity, selected, current, onSelect, onInspect, onBack }: {
  readonly day: number;
  readonly count: number;
  readonly intensity: SteamActivityCalendarIntensity;
  readonly selected: boolean;
  readonly current: boolean;
  readonly onSelect: () => void;
  readonly onInspect: (inspection: ActivityInspection) => void;
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
      data-activity-analytics-focus={`calendar:${day}`}
      data-steam-activity-calendar-count={count}
      data-steam-activity-calendar-intensity={intensity}
      data-steam-activity-calendar-selected={selected ? "true" : "false"}
      onActivate={onSelect}
      onClick={onSelect}
      onCancel={onBack}
      onGamepadDirection={handleActivityCalendarDirection}
      onFocus={() => { setFocused(true); onInspect({ label: dateLabel, count }); }}
      onGamepadFocus={() => { setFocused(true); onInspect({ label: dateLabel, count }); }}
      onBlur={() => setFocused(false)}
      onGamepadBlur={() => setFocused(false)}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        padding: 0,
        boxSizing: "border-box",
        scrollMarginBlock: 0,
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

function ActivityCalendar({ dayCounts, weeks, selectedPeriod, onSelectDay, onInspect, onBack }: {
  readonly dayCounts: ReadonlyMap<number, number>;
  readonly weeks: SteamActivityCalendarWeeks;
  readonly selectedPeriod: ActivitySelectedPeriod | undefined;
  readonly onSelectDay: (day: number) => void;
  readonly onInspect: (inspection: ActivityInspection) => void;
  readonly onBack: () => void;
}): JSX.Element {
  const today = getLocalDayTimestamp(Date.now());
  const model = useMemo(() => buildSteamActivityCalendarModel(dayCounts, weeks), [dayCounts, weeks]);
  const start = model.days[0]?.day ?? today;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const selectedLabel = `Last ${weeks} weeks`;
  return (
    <div data-steam-activity-calendar-weeks={weeks} data-steam-activity-calendar-effective-maximum={model.effectiveMaximum} style={{ ...getCardStyle(), padding: 6, display: "flex", flexDirection: "column", minHeight: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 10, lineHeight: 1.2, fontWeight: 800, flex: "0 0 auto" }}>
        <span>ACTIVITY CALENDAR</span>
        <div aria-label="Unlock intensity: less to more" style={{ display: "flex", alignItems: "center", gap: 3, color: steamTheme.color.textSecondary, fontSize: 8, fontWeight: 500 }}>
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} style={{ width: 8, height: 8, borderRadius: 2, background: ACTIVITY_CALENDAR_COLORS[level] }} />
          ))}
          <span>More</span>
        </div>
        <span style={{ color: steamTheme.color.textSecondary, fontWeight: 500 }}>{selectedLabel}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `22px repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, minmax(0, 1fr))", gap: 2, marginTop: 4, padding: 2, alignItems: "stretch", flex: "1 1 0", minHeight: 0 }}>
        {labels.map((label, row) => (
          <span key={label} style={{ gridColumn: 1, gridRow: row + 1, color: steamTheme.color.textSecondary, fontSize: 8, lineHeight: 1, alignSelf: "center" }}>{label}</span>
        ))}
        {model.days.map(({ day, count, intensity }) => {
          const offset = Math.floor((day - start) / DAY_MS);
          const cell = day <= today
            ? <ActivityCalendarDay
                day={day}
                count={count}
                intensity={intensity}
                selected={selectedPeriod !== undefined && day >= selectedPeriod.startDay && day < selectedPeriod.endDayExclusive}
                current={today === day}
                onSelect={() => onSelectDay(day)}
                onInspect={onInspect}
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
    </div>
  );
}

