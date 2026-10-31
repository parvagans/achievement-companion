import { DeckyCompactCalendarDisclosure } from "./decky-compact-calendar-disclosure";
import { readCompactCalendarExpanded } from "./decky-compact-calendar-preference";
import { openDeckyPinnedAchievementsModal } from "./decky-pinned-achievements-modal";
import { shouldRestoreCompactUpNextToAchievements } from "./decky-compact-up-next-focus";
import { Focusable, GamepadButton, NavEntryPositionPreferences, useQuickAccessVisible, type GamepadEvent } from "@decky/ui";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefCallback } from "react";
import type { DashboardSnapshot, RecentUnlock, RecentlyPlayedGame } from "@core/domain";
import { deckyRaPresence } from "./decky-retroachievements-presence";
import type { RetroAchievementsConnectionState } from "./providers/retroachievements/connection";
import { getRetroAchievementsConnectionBanner } from "./providers/retroachievements/connection";
import type { CompactAchievementTarget } from "./decky-compact-achievement-model";
import { DeckyCompactProfileHeader } from "./decky-compact-profile-header";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyCompactRecentAchievementRow } from "./decky-compact-recent-achievement-row";
import { DeckyRetroAchievementsGameIcon } from "./decky-retroachievements-game-icon";
import { useDeckySettings } from "./decky-settings";
import { useDeckyProviderConfig } from "./providers/retroachievements/config";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { raRecipes, raTheme } from "./ra-theme";
import {
  filterRetroAchievementsUnlocksByMode,
  getRetroAchievementsPlayedGameProgress,
  getRetroAchievementsProfileOverviewMetrics,
  sortRetroAchievementsUnlocksNewestFirst,
} from "./decky-retroachievements-compact-profile-model";
import { buildRetroAchievementsActivityCalendarModel } from "./decky-retroachievements-activity-calendar-model";
import { getDeckyActivityCalendarFocusDestination } from "./decky-activity-calendar-navigation";
import {
  buildCompactActivityGamesForDay,
  filterCompactActivityEntriesForDay,
  formatCompactActivityDate,
} from "./decky-compact-activity-model";
import {
  getDeckyRetroAchievementsCompactAchievementFocusTarget,
  getDeckyRetroAchievementsCompactFocusTargetKey,
  readDeckyRetroAchievementsCompactFocusTarget,
  setDeckyRetroAchievementsCompactFocusTarget,
  type DeckyRetroAchievementsCompactFocusTarget,
} from "./decky-retroachievements-compact-focus-state";
import {
  readDeckyRetroAchievementsCompactActivityDay,
  setDeckyRetroAchievementsCompactActivityDay,
} from "./decky-retroachievements-compact-activity-state";
import {
  readDeckyCompactFocusRestoreRequest,
  subscribeToDeckyCompactFocusRestore,
} from "./decky-compact-focus-restore";
import { getRetroAchievementsCompletionIndicatorState } from "./decky-retroachievements-completion-indicator";
import { getRetroAchievementsModeUnlockedCount } from "./decky-retroachievements-mode-progress";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { findDeckyScrollableAncestor } from "./decky-scroll-viewport";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { useDeckyVisualFocusState } from "./decky-visual-focus-state";
import { getLocalActivityCalendarDayTimestamp } from "./decky-activity-calendar-model";
import { useDeckyRetroAchievementsPresence } from "./useDeckyRetroAchievementsPresence";
import { DeckyCompactUpNextCard } from "./decky-compact-up-next-card";
import { loadDeckyGameDetailState } from "./decky-app-services";
import {
  loadDeckyCompactRecommendationGameState,
  readDeckyCompactGameState,
  readDeckyCompactRecommendationGameState,
} from "./decky-compact-session-resources";
import {
  findRetroAchievementsActiveGame,
  getRetroAchievementsActiveGameId,
  prependRetroAchievementsActiveGame,
} from "./decky-retroachievements-current-game";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import masteredIconUrl from "./assets/mastered.svg";
import pieChartIconUrl from "./assets/pie-chart.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import { RA_COIN_ICON_URL } from "./decky-retroachievements-points-icon";

export interface DeckyRetroAchievementsCompactProfileProps {
  readonly snapshot: DashboardSnapshot;
  readonly upNextCandidateGames?: readonly RecentlyPlayedGame[];
  readonly activityCalendarUnlocks?: readonly RecentUnlock[];
  readonly refreshedAt: number | undefined;
  readonly connectionState?: RetroAchievementsConnectionState;
  readonly onOpenProfile: () => void;
  readonly onOpenAchievementHistory: () => void;
  readonly onOpenCompletionProgress: () => void;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenGameDetail: (game: RecentlyPlayedGame) => void;
  readonly onOpenGameAchievements: (game: RecentlyPlayedGame, achievementId?: string) => void;
  readonly onUpdateCredentials?: () => void;
  readonly onCancel: () => void;
}

interface CompactFocusTargetProps {
  readonly elementRef?: RefCallback<HTMLDivElement>;
  readonly onActivated: (element: HTMLElement) => void;
  readonly onFocused: (element: HTMLElement) => void;
  readonly preferredFocus: boolean;
}

function formatRelativeTime(timestamp: number | undefined): string | undefined {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return undefined;
  const difference = timestamp - Date.now();
  const absolute = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absolute < 60_000) return formatter.format(Math.round(difference / 1000), "second");
  if (absolute < 3_600_000) return formatter.format(Math.round(difference / 60_000), "minute");
  if (absolute < 86_400_000) return formatter.format(Math.round(difference / 3_600_000), "hour");
  return formatter.format(Math.round(difference / 86_400_000), "day");
}

function formatSummary(summary: RecentlyPlayedGame["summary"] | undefined): string | undefined {
  if (summary === undefined) return undefined;
  const progress = summary.totalCount !== undefined
    ? `${summary.unlockedCount.toLocaleString()} / ${summary.totalCount.toLocaleString()}`
    : `${summary.unlockedCount.toLocaleString()} unlocked`;
  const percent = getCompletionPercent(summary);
  return percent === undefined ? progress : `${progress} · ${percent}%`;
}

function CompactAction({
  label,
  children,
  primary = false,
  preferredFocus = false,
  elementRef,
  onActivate,
  onCancel,
  dataAttribute,
  scrollToTopOnFocus = false,
  style,
  targetProps,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly primary?: boolean;
  readonly preferredFocus?: boolean;
  readonly elementRef?: RefCallback<HTMLDivElement>;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly dataAttribute?: string;
  readonly scrollToTopOnFocus?: boolean;
  readonly style?: CSSProperties;
  readonly targetProps?: CompactFocusTargetProps;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const focusGeneration = useRef(0);
  const activate = (): void => {
    const element = actionRef.current;
    if (element !== null) targetProps?.onActivated(element);
    onActivate();
  };
  const actionRef = useRef<HTMLDivElement | null>(null);
  useDeckyVisualFocusState(actionRef, setFocused);
  const handleFocus = (element: HTMLElement): void => {
    const generation = ++focusGeneration.current;
    setFocused(true);
    if (!scrollToTopOnFocus) {
      element.scrollIntoView({ block: "center", inline: "nearest" });
      return;
    }

    const scrollable = findDeckyScrollableAncestor(element);
    if (scrollable === null) return;
    const resetScroll = (): void => {
      if (element.isConnected && focusGeneration.current === generation) scrollable.scrollTop = 0;
    };
    resetScroll();
    const ownerWindow = element.ownerDocument.defaultView;
    ownerWindow?.requestAnimationFrame(() => ownerWindow.requestAnimationFrame(resetScroll));
  };
  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      aria-label={label}
      preferredFocus={preferredFocus || targetProps?.preferredFocus === true}
      ref={(node) => {
        actionRef.current = node;
        elementRef?.(node);
        targetProps?.elementRef?.(node);
      }}
      {...(preferredFocus ? { navEntryPreferPosition: NavEntryPositionPreferences.PREFERRED_CHILD } : {})}
      {...(dataAttribute !== undefined ? { "data-ra-profile-action": dataAttribute } : {})}
      onActivate={activate}
      onClick={activate}
      {...(onCancel === undefined ? {} : { onCancel })}
      onFocus={(event) => { handleFocus(event.currentTarget); targetProps?.onFocused(event.currentTarget); }}
      onGamepadFocus={(event) => { const element = event.currentTarget as HTMLElement; handleFocus(element); targetProps?.onFocused(element); }}
      onBlur={() => { focusGeneration.current += 1; setFocused(false); }}
      style={{ ...raRecipes.action("compact", primary, focused), ...style }}
    >
      {children}
    </Focusable>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }): JSX.Element {
  return (
    <section style={raRecipes.compactProfile.section}>
      <div style={raRecipes.compactProfile.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function OverviewMetric({
  metric,
  wide = false,
  focusable = false,
  onCancel,
  targetProps,
}: {
  readonly metric: ReturnType<typeof getRetroAchievementsProfileOverviewMetrics>[number];
  readonly wide?: boolean;
  readonly focusable?: boolean;
  readonly onCancel?: () => void;
  readonly targetProps?: CompactFocusTargetProps;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const mode = metric.mode ?? "shared";
  const isPointsMetric = metric.key.endsWith("points");
  const icon = isPointsMetric ? RA_COIN_ICON_URL : metric.mode === "hardcore" ? trophyIconUrl : metric.mode === "softcore" ? masteredIconUrl : metric.key === "ratio" ? pieChartIconUrl : undefined;
  const content = (
    <>
      {icon !== undefined ? <img alt="" src={icon} style={{ width: 27, height: 27, flex: "0 0 27px", ...(isPointsMetric ? {} : { filter: raTheme.iconFilter[mode === "hardcore" ? "hardcore" : mode === "softcore" ? "softcore" : "primary"] }) }} /> : null}
      <div style={raRecipes.compactProfile.metricText}>
        <span style={raRecipes.compactProfile.metricLabel(mode)}>{metric.label}</span>
        <span style={raRecipes.compactProfile.metricValue}>{metric.value}</span>
        {metric.detail !== undefined ? <span style={raRecipes.compactProfile.metricDetail}>{metric.detail}</span> : null}
      </div>
    </>
  );
  if (!focusable) return <div style={raRecipes.compactProfile.metric(mode, wide)}>{content}</div>;
  const focus = (element: HTMLElement): void => {
    setFocused(true);
    element.scrollIntoView({ block: "center", inline: "nearest" });
    targetProps?.onFocused(element);
  };
  return (
    <Focusable
      noFocusRing
      role="group"
      tabIndex={0}
      aria-label={`${metric.label}, ${metric.value}${metric.detail === undefined ? "" : `, ${metric.detail}`}`}
      data-ra-profile-overview-focus="true"
      ref={(node) => targetProps?.elementRef?.(node)}
      preferredFocus={targetProps?.preferredFocus ?? false}
      onActivate={() => {}}
      {...(onCancel === undefined ? {} : { onCancel })}
      onFocus={(event) => focus(event.currentTarget)}
      onGamepadFocus={(event) => focus(event.currentTarget as HTMLElement)}
      onBlur={() => setFocused(false)}
      style={{ ...raRecipes.compactProfile.metric(mode, wide), ...raRecipes.compactProfile.focusableMetric(focused) }}
    >
      {content}
    </Focusable>
  );
}

function CompletionCard({
  kind,
  label,
  count,
  onCancel,
  targetProps,
}: {
  readonly kind: "beaten" | "mastered";
  readonly label: string;
  readonly count: number | undefined;
  readonly onCancel?: () => void;
  readonly targetProps?: CompactFocusTargetProps;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const content = (
    <>
      <DeckyGameStatusIcon kind={kind} size={25} color={kind === "mastered" ? raTheme.color.mastered : raTheme.color.beatenFlagWhite} accentColor={kind === "mastered" ? raTheme.color.hardcore : raTheme.color.beatenFlagBlack} />
      <div style={raRecipes.compactProfile.completionText}>
        <span style={raRecipes.compactProfile.completionLabel(kind)}>{label}</span>
        <span style={raRecipes.compactProfile.completionValue}>{count?.toLocaleString() ?? "—"}</span>
      </div>
    </>
  );
  if (kind === "mastered") return <div style={raRecipes.compactProfile.completionCard(kind)}>{content}</div>;
  const focus = (element: HTMLElement): void => {
    setFocused(true);
    element.scrollIntoView({ block: "center", inline: "nearest" });
    targetProps?.onFocused(element);
  };
  return (
    <Focusable
      noFocusRing
      role="group"
      tabIndex={0}
      aria-label={`Beaten, ${count?.toLocaleString() ?? "unavailable"}`}
      data-ra-profile-beaten-focus="true"
      ref={(node) => targetProps?.elementRef?.(node)}
      preferredFocus={targetProps?.preferredFocus ?? false}
      onActivate={() => {}}
      {...(onCancel === undefined ? {} : { onCancel })}
      onFocus={(event) => focus(event.currentTarget)}
      onGamepadFocus={(event) => focus(event.currentTarget as HTMLElement)}
      onBlur={() => setFocused(false)}
      style={{ ...raRecipes.compactProfile.completionCard(kind), ...raRecipes.compactProfile.focusableMetric(focused) }}
    >
      {content}
    </Focusable>
  );
}

function ActivityCalendar({
  entries,
  mode,
  weeks,
  selectedDay,
  onSelectDay,
  onCancel,
  entryTargetProps,
  targetProps,
}: {
  readonly entries: readonly RecentUnlock[] | undefined;
  readonly mode: Parameters<typeof buildRetroAchievementsActivityCalendarModel>[0]["achievementMode"];
  readonly weeks: NonNullable<Parameters<typeof buildRetroAchievementsActivityCalendarModel>[0]["weeks"]>;
  readonly selectedDay: number | undefined;
  readonly onSelectDay: (day: number) => void;
  readonly onCancel: () => void;
  readonly entryTargetProps: CompactFocusTargetProps;
  readonly targetProps: (day: number) => CompactFocusTargetProps;
}): JSX.Element {
  const [active, setActive] = useState(() => readDeckyRetroAchievementsCompactFocusTarget().kind === "calendar-day");
  const [focused, setFocused] = useState(false);
  const [lastFocusedDay, setLastFocusedDay] = useState<number>();
  const entryRef = useRef<HTMLDivElement | null>(null);
  useDeckyVisualFocusState(entryRef, setFocused);
  const activeDayRef = useRef<HTMLDivElement | null>(null);
  const dayElementRefs = useRef(new Map<number, HTMLDivElement>());
  const pendingFocus = useRef<"entry" | "day">();
  const model = useMemo(
    () => entries === undefined ? undefined : buildRetroAchievementsActivityCalendarModel({ entries, achievementMode: mode, weeks }),
    [entries, mode, weeks],
  );
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const today = getLocalActivityCalendarDayTimestamp(Date.now());
  const start = model?.days[0]?.day ?? 0;
  const focusDay = selectedDay !== undefined && model?.days.some(({ day }) => day === selectedDay)
    ? selectedDay
    : lastFocusedDay !== undefined && model?.days.some(({ day }) => day === lastFocusedDay)
      ? lastFocusedDay
      : today;
  const selectedDateLabel = selectedDay === undefined
    ? undefined
    : new Date(selectedDay).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const status = model === undefined ? "Activity data unavailable" : selectedDateLabel ?? `Last ${weeks} weeks`;
  const enterCalendar = (): void => {
    if (model === undefined) return;
    if (entryRef.current !== null) entryTargetProps.onActivated(entryRef.current);
    pendingFocus.current = "day";
    setActive(true);
  };
  const exitCalendar = (): void => {
    pendingFocus.current = "entry";
    setActive(false);
  };
  useLayoutEffect(() => {
    const request = pendingFocus.current;
    if (request === undefined) return;
    pendingFocus.current = undefined;
    return requestDeckySteamGamepadFocusAfterMount(request === "day" ? activeDayRef.current : entryRef.current);
  }, [active, focusDay]);

  const moveCalendarFocus = (event: GamepadEvent, target: HTMLElement | null | undefined): void => {
    const source = event.currentTarget as HTMLElement;
    if (target === undefined || !takeDeckySteamGamepadFocus(target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (target !== source) playDeckySteamNavigationSound(source.ownerDocument);
  };
  const handleCalendarDirection = (event: GamepadEvent): void => {
    const source = event.currentTarget as HTMLElement;
    const calendar = source.closest<HTMLElement>("[data-ra-compact-activity-calendar='true']");
    const profile = source.closest<HTMLElement>("[data-achievement-companion-ra-compact-profile='true']");
    const cells = Array.from(calendar?.querySelectorAll<HTMLElement>("[data-ra-activity-calendar-day='true']") ?? []);
    const index = cells.indexOf(source);
    if (index < 0) return;
    const button = event.detail.button;
    const direction = button === GamepadButton.DIR_UP ? "up"
      : button === GamepadButton.DIR_DOWN ? "down"
        : button === GamepadButton.DIR_LEFT ? "left"
          : button === GamepadButton.DIR_RIGHT ? "right"
            : undefined;
    if (direction === undefined) return;
    const destination = getDeckyActivityCalendarFocusDestination(index, cells.length, direction);
    const target = destination.kind === "cell"
      ? cells[destination.index]
      : destination.kind === "profile"
        ? profile?.querySelector<HTMLElement>("[data-ra-profile-action='profile']") ?? source
        : destination.kind === "activity"
          ? profile?.querySelector<HTMLElement>("[data-ra-profile-recent-achievement='true']")
            ?? profile?.querySelector<HTMLElement>("[data-ra-profile-action='recent-activity']")
            ?? source
          : source;
    moveCalendarFocus(event, target);
  };

  return (
    <Focusable
      ref={(node) => { entryRef.current = node; entryTargetProps.elementRef?.(node); }}
      noFocusRing
      role="button"
      tabIndex={0}
      aria-label={model === undefined ? "RetroAchievements activity calendar unavailable" : `Activity calendar, ${status}. ${active ? "Press B to exit." : "Press A to use."}`}
      aria-expanded={active}
      data-ra-compact-activity-calendar="true"
      data-ra-compact-activity-calendar-active={active ? "true" : "false"}
      preferredFocus={entryTargetProps.preferredFocus}
      onActivate={enterCalendar}
      onClick={enterCalendar}
      onCancel={active ? exitCalendar : onCancel}
      onFocus={(event) => {
        setFocused(true);
        if (event.target === event.currentTarget) {
          if (active && activeDayRef.current !== null) {
            requestDeckySteamGamepadFocusAfterMount(activeDayRef.current);
            return;
          }
          event.currentTarget.scrollIntoView({ block: "center", inline: "nearest" });
          entryTargetProps.onFocused(event.currentTarget);
        }
      }}
      onGamepadFocus={(event) => {
        setFocused(true);
        const element = event.currentTarget as HTMLElement;
        if (active && event.target === event.currentTarget && activeDayRef.current !== null) {
          requestDeckySteamGamepadFocusAfterMount(activeDayRef.current);
          return;
        }
        element.scrollIntoView({ block: "center", inline: "nearest" });
        entryTargetProps.onFocused(element);
      }}
      onBlur={() => setFocused(false)}
      style={raRecipes.compactProfile.calendar(focused && !active)}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 11 }}>
        <span style={{ ...raRecipes.text("compact", "caption"), color: selectedDay === undefined ? raTheme.color.textMuted : raTheme.color.accent, fontWeight: selectedDay === undefined ? 600 : 800 }}>{status}</span>
      </div>
      {model !== undefined ? (
        <div style={raRecipes.compactProfile.calendarGrid(weeks)}>
          {labels.map((label, row) => <span key={`${label}:${row}`} style={{ gridColumn: 1, gridRow: row + 1, alignSelf: "center", ...raRecipes.text("compact", "caption"), color: raTheme.color.textMuted, fontSize: 8 }}>{label}</span>)}
          {model.days.map(({ day, count, intensity }) => {
            const dateLabel = new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
            const offset = Math.floor((day - start) / 86_400_000);
            const isSelected = day === selectedDay;
            return (
              <div key={day} style={{ gridColumn: Math.floor(offset / 7) + 2, gridRow: offset % 7 + 1, minWidth: 0, minHeight: 0 }}>
                {active && day <= today ? (
                  <Focusable
                    ref={(node) => {
                      if (node === null) dayElementRefs.current.delete(day);
                      else dayElementRefs.current.set(day, node);
                      if (day === focusDay) activeDayRef.current = node;
                      targetProps(day).elementRef?.(node);
                    }}
                    noFocusRing
                    role="button"
                    tabIndex={0}
                    aria-label={`${dateLabel}, ${count} unlock${count === 1 ? "" : "s"}`}
                    aria-pressed={isSelected}
                    preferredFocus={targetProps(day).preferredFocus}
                    data-ra-activity-calendar-day="true"
                    data-ra-activity-calendar-current={day === today ? "true" : "false"}
                    data-ra-activity-calendar-focused={day === focusDay ? "true" : "false"}
                    data-ra-activity-calendar-selected={isSelected ? "true" : "false"}
                    data-ra-activity-calendar-index={offset}
                    onActivate={() => { const props = targetProps(day); const element = dayElementRefs.current.get(day); if (element !== undefined) props.onActivated(element); onSelectDay(day); }}
                    onClick={() => { const props = targetProps(day); const element = dayElementRefs.current.get(day); if (element !== undefined) props.onActivated(element); onSelectDay(day); }}
                    onCancel={exitCalendar}
                    onGamepadDirection={handleCalendarDirection}
                    onFocus={(event) => { const element = event.currentTarget; setLastFocusedDay(day); element.scrollIntoView({ block: "center", inline: "nearest" }); targetProps(day).onFocused(element); }}
                    onGamepadFocus={(event) => { const element = event.currentTarget as HTMLElement; setLastFocusedDay(day); element.scrollIntoView({ block: "center", inline: "nearest" }); targetProps(day).onFocused(element); }}
                    style={raRecipes.compactProfile.calendarCell(intensity, isSelected, false)}
                  >{null}</Focusable>
                ) : (
                  <span aria-hidden="true" title={`${dateLabel}: ${count} unlock${count === 1 ? "" : "s"}`} style={raRecipes.compactProfile.calendarCell(intensity, isSelected, false)} />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      <div style={raRecipes.compactProfile.calendarLegend}>
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => <span key={level} style={raRecipes.compactProfile.calendarLegendCell(level)} />)}
        <span>More</span>
      </div>
      {active ? <div style={{ marginTop: 4, ...raRecipes.text("compact", "caption"), color: raTheme.color.textMuted, textAlign: "center" }}>Press B to exit</div> : null}
    </Focusable>
  );
}

function RecentAchievementRow({
  unlock,
  onActivate,
  onCancel,
  targetProps,
}: {
  readonly unlock: RecentUnlock;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly targetProps: CompactFocusTargetProps;
}): JSX.Element {
  return (
    <DeckyCompactRecentAchievementRow
      dataAttributes={{ "data-ra-profile-recent-achievement": "true" }}
      elementRef={targetProps.elementRef}
      unlock={unlock}
      onActivate={onActivate}
      onActivated={targetProps.onActivated}
      onCancel={onCancel}
      onFocused={targetProps.onFocused}
      preferredFocus={targetProps.preferredFocus}
      timestampText={formatRelativeTime(unlock.unlockedAt ?? unlock.achievement.unlockedAt)}
    />
  );
}

function RecentlyPlayedRow({
  game,
  mode,
  activityUnlockCount,
  activityDateLabel,
  onActivate,
  onCancel,
  targetProps,
}: {
  readonly game: RecentlyPlayedGame;
  readonly mode: Parameters<typeof getRetroAchievementsPlayedGameProgress>[1];
  readonly activityUnlockCount?: number;
  readonly activityDateLabel?: string;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly targetProps: CompactFocusTargetProps;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const summary = getRetroAchievementsPlayedGameProgress(game, mode);
  const progressLine = formatSummary(summary);
  const lastPlayed = formatRelativeTime(game.lastPlayedAt);
  const award = getRetroAchievementsCompletionIndicatorState(game);
  const awardKind = award?.startsWith("mastered") === true ? "mastered" : "beaten";
  const elementRef = useRef<HTMLDivElement | null>(null);
  const activate = (): void => { if (elementRef.current !== null) targetProps.onActivated(elementRef.current); onActivate(); };
  const focus = (element: HTMLElement): void => { setFocused(true); element.scrollIntoView({ block: "center", inline: "nearest" }); targetProps.onFocused(element); };
  return (
    <Focusable noFocusRing role="button" tabIndex={0} aria-label={`${game.title}${game.platformLabel ? `, ${game.platformLabel}` : ""}${progressLine ? `, ${progressLine}` : ""}${award !== undefined ? `, ${awardKind}` : ""}${activityUnlockCount !== undefined && activityDateLabel !== undefined ? `, ${activityUnlockCount} unlock${activityUnlockCount === 1 ? "" : "s"} on ${activityDateLabel}` : ""}`} data-ra-profile-recent-game="true" ref={(node) => { elementRef.current = node; targetProps.elementRef?.(node); }} preferredFocus={targetProps.preferredFocus} onActivate={activate} onClick={activate} onCancel={onCancel} onFocus={(event) => focus(event.currentTarget)} onGamepadFocus={(event) => focus(event.currentTarget as HTMLElement)} onBlur={() => setFocused(false)} style={raRecipes.compactProfile.row(focused)}>
      <DeckyRetroAchievementsGameIcon game={game} src={game.coverImageUrl ?? game.systemIconUrl} size={40} />
      <span style={raRecipes.compactProfile.rowText}>
        <span style={raRecipes.compactProfile.rowTitle}>{game.title}</span>
        <span style={raRecipes.compactProfile.rowMeta}>{game.platformLabel ?? "RetroAchievements game"}</span>
        {progressLine !== undefined ? <span style={raRecipes.compactProfile.rowMeta}>{progressLine}</span> : null}
        {activityUnlockCount !== undefined && activityDateLabel !== undefined ? <span style={raRecipes.compactProfile.rowMeta}>{activityUnlockCount} unlock{activityUnlockCount === 1 ? "" : "s"} on {activityDateLabel}</span> : null}
      </span>
      <span style={raRecipes.compactProfile.rowTrailing}>
        {lastPlayed !== undefined ? <span style={raRecipes.compactProfile.rowMeta}>{lastPlayed}</span> : null}
        <img alt="" src={chevronRightIconUrl} style={{ width: 15, height: 15, filter: raTheme.iconFilter.primary }} />
      </span>
    </Focusable>
  );
}

function ViewAll({ label, onActivate, onCancel, dataAttribute, targetProps }: { readonly label: string; readonly onActivate: () => void; readonly onCancel: () => void; readonly dataAttribute?: string; readonly targetProps: CompactFocusTargetProps }): JSX.Element {
  return (
    <CompactAction label={`View all ${label}`} onActivate={onActivate} onCancel={onCancel} targetProps={targetProps} style={{ minHeight: 38, padding: "8px 10px" }} {...(dataAttribute !== undefined ? { dataAttribute } : {})}>
      <span style={{ flex: "1 1 auto", color: raTheme.color.accent, fontSize: 10, fontWeight: 800, textAlign: "center" }}>View All</span>
      <img alt="" src={chevronRightIconUrl} style={{ width: 15, height: 15, filter: raTheme.iconFilter.primary }} />
    </CompactAction>
  );
}

function getMetricNumber(profile: DashboardSnapshot["profile"], key: string): number | undefined {
  const metricValue = profile.metrics.find((metric) => metric.key === key)?.value;
  if (metricValue === undefined) return undefined;
  const value = Number(metricValue);
  return Number.isFinite(value) ? value : undefined;
}

export function DeckyRetroAchievementsCompactProfile({
  snapshot: originalSnapshot,
  upNextCandidateGames,
  activityCalendarUnlocks,
  refreshedAt,
  connectionState,
  onOpenProfile,
  onOpenAchievementHistory,
  onOpenCompletionProgress,
  onOpenAchievementDetail,
  onOpenGameDetail,
  onOpenGameAchievements,
  onUpdateCredentials,
  onCancel,
}: DeckyRetroAchievementsCompactProfileProps): JSX.Element {
  const isQuickAccessVisible = useQuickAccessVisible();
  const liveState = useDeckyRetroAchievementsPresence({ status: "success", data: originalSnapshot, isStale: false, isRefreshing: false }, isQuickAccessVisible, "qam-entry");
  const snapshot = liveState.data ?? originalSnapshot;
  const profile = snapshot.profile;
  const upNextGames = useMemo(() => upNextCandidateGames === undefined ? snapshot.recentlyPlayedGames
    : deckyRaPresence.project({ ...snapshot, recentlyPlayedGames: upNextCandidateGames }).recentlyPlayedGames, [snapshot, upNextCandidateGames]);
  const activeGameId = getRetroAchievementsActiveGameId(profile);
  const knownActiveGame = useMemo(() => findRetroAchievementsActiveGame(
    activeGameId,
    snapshot.currentGame === undefined ? [] : [snapshot.currentGame],
    upNextGames,
    snapshot.recentlyPlayedGames,
    snapshot.featuredGames,
    profile.featuredGames,
  ), [activeGameId, profile.featuredGames, snapshot.currentGame, snapshot.featuredGames, snapshot.recentlyPlayedGames, upNextGames]);
  const [lookedUpActiveGame, setLookedUpActiveGame] = useState<RecentlyPlayedGame | undefined>();
  useEffect(() => {
    if (activeGameId === undefined || knownActiveGame !== undefined) {
      setLookedUpActiveGame(undefined);
      return;
    }

    let active = true;
    const accept = (game: RecentlyPlayedGame | undefined): void => {
      if (active && game?.gameId === activeGameId) {
        setLookedUpActiveGame(game);
      }
    };
    const cached = readDeckyCompactGameState(RETROACHIEVEMENTS_PROVIDER_ID, activeGameId)
      ?? readDeckyCompactRecommendationGameState(activeGameId);
    if (cached?.data?.game.gameId === activeGameId) {
      accept(cached.data.game);
      return () => { active = false; };
    }

    setLookedUpActiveGame(undefined);
    void loadDeckyCompactRecommendationGameState(
      activeGameId,
      () => loadDeckyGameDetailState(RETROACHIEVEMENTS_PROVIDER_ID, activeGameId, {
        forceRefresh: false,
        recommendationOnly: true,
        entryPoint: "qam-active-game",
      }),
    ).then((state) => accept(state.data?.game)).catch(() => undefined);
    return () => { active = false; };
  }, [activeGameId, knownActiveGame]);
  const activeGame = knownActiveGame
    ?? (lookedUpActiveGame?.gameId === activeGameId ? lookedUpActiveGame : undefined);
  const displayedUpNextGames = useMemo(
    () => prependRetroAchievementsActiveGame(upNextGames, activeGame),
    [activeGame, upNextGames],
  );
  const settings = useDeckySettings();
  const providerConfig = useDeckyProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
  const recentAchievementsCount = providerConfig?.recentAchievementsCount ?? settings.recentAchievementsCount;
  const recentlyPlayedCount = providerConfig?.recentlyPlayedCount ?? settings.recentlyPlayedCount;
  const restorationRequest = useSyncExternalStore(
    subscribeToDeckyCompactFocusRestore,
    readDeckyCompactFocusRestoreRequest,
    readDeckyCompactFocusRestoreRequest,
  );
  const handledRestorationRequest = useRef(restorationRequest);
  const savedCalendarTarget = readDeckyRetroAchievementsCompactFocusTarget();
  const restorationKey = getDeckyRetroAchievementsCompactFocusTargetKey(
    (!readCompactCalendarExpanded("retroachievements") && ["calendar-day", "calendar-entry"].includes(savedCalendarTarget.kind) || savedCalendarTarget.kind === "calendar-clear" && readDeckyRetroAchievementsCompactActivityDay() === undefined) ? { kind: "calendar-toggle" } :
    readDeckyRetroAchievementsCompactFocusTarget().kind === "up-next" && displayedUpNextGames.length === 0
      ? { kind: "profile" }
      : readDeckyRetroAchievementsCompactFocusTarget(),
  );
  const focusTargetsRef = useRef(new Map<string, HTMLDivElement>());
  const [selectedActivityDay, setSelectedActivityDay] = useState(readDeckyRetroAchievementsCompactActivityDay);
  const activityEntries = activityCalendarUnlocks ?? snapshot.activityCalendarUnlocks ?? snapshot.recentAchievements;
  const modeFilteredActivity = useMemo(() => sortRetroAchievementsUnlocksNewestFirst(
    filterRetroAchievementsUnlocksByMode(
      activityEntries,
      settings.retroAchievementsAchievementMode,
    ),
  ), [activityEntries, settings.retroAchievementsAchievementMode]);
  const selectedDateActivity = useMemo(() => selectedActivityDay === undefined
    ? undefined
    : filterCompactActivityEntriesForDay(modeFilteredActivity, selectedActivityDay)
      .slice().sort((left, right) => (right.unlockedAt ?? right.achievement.unlockedAt ?? 0) - (left.unlockedAt ?? left.achievement.unlockedAt ?? 0)),
  [modeFilteredActivity, selectedActivityDay]);
  const visibleActivity = selectedDateActivity ?? modeFilteredActivity.slice(0, recentAchievementsCount);
  const activityKnownGames = useMemo(
    () => [...(profile.featuredGames ?? []), ...snapshot.recentlyPlayedGames],
    [profile.featuredGames, snapshot.recentlyPlayedGames],
  );
  const selectedDateGames = useMemo(() => selectedDateActivity === undefined
    ? undefined
    : buildCompactActivityGamesForDay(selectedDateActivity, activityKnownGames),
  [activityKnownGames, selectedDateActivity]);
  const recentlyPlayed = selectedDateGames?.map(({ game }) => game) ?? snapshot.recentlyPlayedGames.slice(0, recentlyPlayedCount);
  const activityUnlockCounts = useMemo(
    () => new Map(selectedDateGames?.map(({ game, unlockCount }) => [game.gameId, unlockCount]) ?? []),
    [selectedDateGames],
  );
  const selectedActivityDateLabel = selectedActivityDay === undefined
    ? undefined
    : formatCompactActivityDate(selectedActivityDay);
  const overview = useMemo(
    () => getRetroAchievementsProfileOverviewMetrics(profile, settings.retroAchievementsAchievementMode),
    [profile, settings.retroAchievementsAchievementMode],
  );
  const isSingleModeOverview = settings.retroAchievementsAchievementMode !== "both";
  const firstModeMetricKey = overview.find((metric) => metric.mode !== undefined)?.key;
  const refreshText = refreshedAt === undefined ? "RetroAchievements refreshed" : `RetroAchievements refreshed ${new Date(refreshedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  const connectionMessage = connectionState === undefined ? undefined : getRetroAchievementsConnectionBanner(connectionState);
  const achievementMode = settings.retroAchievementsAchievementMode;
  const beaten = achievementMode === "hardcore"
    ? profile.beatenHardcoreCount
    : achievementMode === "softcore"
      ? profile.beatenSoftcoreCount
      : profile.beatenHardcoreCount !== undefined && profile.beatenSoftcoreCount !== undefined
        ? profile.beatenHardcoreCount + profile.beatenSoftcoreCount
        : getMetricNumber(profile, "games-beaten");
  const mastered = achievementMode === "softcore" ? 0 : profile.masteredHardcoreCount ?? profile.masteredCount;
  const modeUnlocked = getRetroAchievementsModeUnlockedCount(profile, achievementMode);
  const completion = modeUnlocked !== undefined && profile.summary.totalCount !== undefined && profile.summary.totalCount > 0
    ? Math.min(100, Math.round(modeUnlocked / profile.summary.totalCount * 100))
    : undefined;
  const targetProps = (target: DeckyRetroAchievementsCompactFocusTarget): CompactFocusTargetProps => {
    const key = getDeckyRetroAchievementsCompactFocusTargetKey(target);
    return {
      elementRef: (node) => {
        if (node !== null) {
          const previousNode = focusTargetsRef.current.get(key);
          focusTargetsRef.current.set(key, node);
          if (previousNode !== node && isQuickAccessVisible && key === restorationKey) {
            requestDeckySteamGamepadFocusAfterMount(node, 12);
          }
        }
      },
      onActivated: (element) => {
        setDeckyRetroAchievementsCompactFocusTarget(
          target,
          findDeckyScrollableAncestor(element)?.scrollTop ?? 0,
        );
      },
      onFocused: (element) => {
        setDeckyRetroAchievementsCompactFocusTarget(
          target,
          findDeckyScrollableAncestor(element)?.scrollTop ?? 0,
        );
      },
      preferredFocus: key === restorationKey,
    };
  };
  useLayoutEffect(() => {
    if (!isQuickAccessVisible) return;
    return requestDeckySteamGamepadFocusAfterMount(focusTargetsRef.current.get(restorationKey), 12);
  }, [isQuickAccessVisible, restorationKey]);
  useLayoutEffect(() => {
    if (!isQuickAccessVisible || handledRestorationRequest.current === restorationRequest) return;
    handledRestorationRequest.current = restorationRequest;
    const latestRestorationKey = getDeckyRetroAchievementsCompactFocusTargetKey(
      readDeckyRetroAchievementsCompactFocusTarget(),
    );
    const target = focusTargetsRef.current.get(latestRestorationKey)
      ?? focusTargetsRef.current.get(restorationKey);
    return requestDeckySteamGamepadFocusAfterMount(target, 12);
  }, [isQuickAccessVisible, restorationRequest]);
  return (
    <Focusable
      data-ac-ra-theme="compact"
      data-achievement-companion-ra-compact-profile="true"
      navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
      preferredFocus
      style={raRecipes.compactProfile.root}
    >
      {connectionMessage !== undefined ? (
        <div style={{ ...raRecipes.card("compact", true), color: raTheme.color.danger, borderColor: raTheme.color.danger, display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={raRecipes.text("compact", "metadata")}>{connectionMessage}</span>
          {connectionState?.status === "authentication-required" && onUpdateCredentials !== undefined ? (
            <CompactAction label="Update RetroAchievements credentials" primary onActivate={onUpdateCredentials} onCancel={onCancel}>Update credentials</CompactAction>
          ) : null}
        </div>
      ) : null}

      <section style={raRecipes.compactProfile.section}>
        <DeckyCompactProfileHeader identity={profile.identity} providerName="RetroAchievements" refreshedAt={refreshedAt}
          currentGame={activeGame !== undefined} onActivate={onOpenProfile} onCancel={onCancel} targetProps={targetProps({ kind: "profile" })}
          pinnedTargetProps={targetProps({ kind: "pinned-shortcut" })}
          onOpenPinned={(anchor) => openDeckyPinnedAchievementsModal({ providerId: "retroachievements", onClose: () => { requestDeckySteamGamepadFocusAfterMount(anchor); } })} />

        <DeckyCompactUpNextCard
          providerId={RETROACHIEVEMENTS_PROVIDER_ID}
          games={displayedUpNextGames}
          {...(activeGame !== undefined ? { activeGameId: activeGame.gameId } : {})}
          achievementMode={settings.retroAchievementsAchievementMode}
          onOpenAchievementDetail={onOpenAchievementDetail}
          onOpenAchievements={onOpenGameAchievements}
          onCancel={onCancel}
          getFocusTargetProps={(control, gameId, unavailableControls = []) => {
            const saved = readDeckyRetroAchievementsCompactFocusTarget();
            const fallback = control === "achievements" && shouldRestoreCompactUpNextToAchievements(saved, gameId, unavailableControls);
            return { ...targetProps({ kind: "up-next", control, gameId }), ...(fallback ? { preferredFocus: true } : {}) };
          }}
        />
      </section>

      <Section title="RA Overview">
        <div style={raRecipes.compactProfile.metricGrid(overview.length)}>
          {overview.map((metric) => (
            <OverviewMetric
              key={metric.key}
              metric={metric}
              wide={isSingleModeOverview && metric.mode !== undefined}
              focusable={metric.key === firstModeMetricKey}
              onCancel={onCancel}
              {...(metric.key === firstModeMetricKey ? { targetProps: targetProps({ kind: "overview" }) } : {})}
            />
          ))}
        </div>
      </Section>

      <Section title="Game Completion">
        <div style={raRecipes.compactProfile.completionGrid}>
          <CompletionCard kind="beaten" label="Beaten" count={beaten} onCancel={onCancel} targetProps={targetProps({ kind: "beaten" })} />
          <CompletionCard kind="mastered" label="Mastered" count={mastered} />
        </div>
        {completion !== undefined ? (
          <div style={raRecipes.compactProfile.progressCard}>
            <div style={raRecipes.compactProfile.progressHeader}>
              <span style={raRecipes.compactProfile.progressLabel}>Achievement Completion</span>
              <span style={raRecipes.compactProfile.progressValue}>{completion}%</span>
            </div>
            <DeckyCompletionProgressBar compact percent={completion} />
          </div>
        ) : null}
      </Section>

      <DeckyCompactCalendarDisclosure providerId="retroachievements" weeks={settings.retroAchievementsCompactActivityCalendarWeeks} selectedDay={selectedActivityDay}
        onClear={() => { setSelectedActivityDay(undefined); setDeckyRetroAchievementsCompactActivityDay(undefined); }} onCancel={onCancel}
        targetProps={targetProps({ kind: "calendar-toggle" })} clearTargetProps={targetProps({ kind: "calendar-clear" })}>
        <ActivityCalendar
          entries={activityCalendarUnlocks ?? snapshot.activityCalendarUnlocks}
          mode={settings.retroAchievementsAchievementMode}
          weeks={settings.retroAchievementsCompactActivityCalendarWeeks}
          selectedDay={selectedActivityDay}
          onSelectDay={(day) => setSelectedActivityDay((current) => {
            const nextDay = current === day ? undefined : day;
            setDeckyRetroAchievementsCompactActivityDay(nextDay);
            return nextDay;
          })}
          onCancel={onCancel}
          entryTargetProps={targetProps({ kind: "calendar-entry" })}
          targetProps={(day) => targetProps({ kind: "calendar-day", day })}
        />
      </DeckyCompactCalendarDisclosure>

      <Section title="Recent Activity">
        <div style={raRecipes.compactProfile.listCard}>
          <div style={raRecipes.compactProfile.listRows}>
            {visibleActivity.length > 0 ? visibleActivity.map((unlock) => {
              const focusTarget = getDeckyRetroAchievementsCompactAchievementFocusTarget(unlock);
              return (
                <RecentAchievementRow
                  key={getDeckyRetroAchievementsCompactFocusTargetKey(focusTarget)}
                  unlock={unlock}
                  onActivate={() => onOpenAchievementDetail({ game: unlock.game, achievement: unlock.achievement })}
                  onCancel={onCancel}
                  targetProps={targetProps(focusTarget)}
                />
              );
            }) : <div style={{ ...raRecipes.state("empty"), padding: 8, textAlign: "left" }}>No recent achievements yet.</div>}
          </div>
          <ViewAll label="achievements" onActivate={onOpenAchievementHistory} onCancel={onCancel} dataAttribute="recent-activity" targetProps={targetProps({ kind: "activity" })} />
        </div>
      </Section>

      <Section title="Recently Played">
        <div style={raRecipes.compactProfile.listCard}>
          <div style={raRecipes.compactProfile.listRows}>
            {recentlyPlayed.length > 0 ? recentlyPlayed.map((game) => (
              <RecentlyPlayedRow key={game.gameId} game={game} mode={settings.retroAchievementsAchievementMode} {...(activityUnlockCounts.has(game.gameId) ? { activityUnlockCount: activityUnlockCounts.get(game.gameId)!, ...(selectedActivityDateLabel !== undefined ? { activityDateLabel: selectedActivityDateLabel } : {}) } : {})} onActivate={() => onOpenGameDetail(game)} onCancel={onCancel} targetProps={targetProps({ kind: "game", gameId: game.gameId })} />
            )) : <div style={{ ...raRecipes.state("empty"), padding: 8, textAlign: "left" }}>No recently played games yet.</div>}
          </div>
          <ViewAll label="games" onActivate={onOpenCompletionProgress} onCancel={onCancel} targetProps={targetProps({ kind: "games" })} />
        </div>
      </Section>

      <div style={raRecipes.compactProfile.footer}>{refreshText}</div>
    </Focusable>
  );
}
