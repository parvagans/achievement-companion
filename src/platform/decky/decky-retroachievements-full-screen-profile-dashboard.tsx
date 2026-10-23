import { Focusable, GamepadButton, NavEntryPositionPreferences, type GamepadEvent } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import barChartIconUrl from "./assets/bar-chart.svg";
import calendarIconUrl from "./assets/calendar.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";
import { DeckyRetroAchievementsPointsIcon } from "./decky-retroachievements-points-icon";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { DeckyCompletionProgressBar } from "./decky-completion-progress-bar";
import { DeckyFocusStyles } from "./decky-focus-styles";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { DeckySystemIcon } from "./decky-system-pill";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { raRecipes, raTheme } from "./ra-theme";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";
import { formatFullscreenLastSync, formatProfileMemberSince } from "./decky-stat-helpers";
import { DeckyRetroAchievementsRankTrendIndicator } from "./decky-ra-rank-trend-indicator";

type Model = ReturnType<typeof import("./decky-retroachievements-full-screen-profile-data").buildRetroAchievementsFullScreenProfileModel>;

function pageStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    flexDirection: "column",
    gap: 0,
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    padding: "calc(env(safe-area-inset-top, 0px) + 43px) 12px calc(env(safe-area-inset-bottom, 0px) + 48px)",
    boxSizing: "border-box",
    overflow: "hidden",
    color: raTheme.color.textPrimary,
    background: raTheme.surface.page,
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    flex: "1 1 auto",
    overflow: "hidden",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gridTemplateRows: "minmax(86px, auto) minmax(0, 1fr)",
    gridTemplateAreas: '"profile profile profile profile profile profile" "dashboard dashboard dashboard dashboard dashboard dashboard"',
    alignItems: "stretch",
    gap: 6,
    width: "100%",
    minWidth: 0,
    minHeight: 0,
  };
}

function rightColumnStyle(hasSystems: boolean): CSSProperties {
  return {
    gridArea: "dashboard",
    display: "grid",
    gridTemplateColumns: hasSystems ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
    gridTemplateRows: "minmax(100px, auto) minmax(0, 1fr)",
    gridTemplateAreas: hasSystems ? '"progress progress" "systems completions"' : '"progress" "completions"',
    gap: 6,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  };
}

function panelStyle(area: string): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    background: raTheme.surface.contentCard,
    gridArea: area,
    display: "flex",
    flexDirection: "column",
    ...(area === "profile" ? { flexDirection: "row" as const, alignItems: "center" } : {}),
    gap: 6,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    padding: area === "profile" ? 10 : 12,
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

function systemsPanelStyle(): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    background: raTheme.surface.contentCard,
    gridArea: "systems",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    padding: 12,
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

function systemsRailStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateRows: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
    overflowX: "hidden",
    overflowY: "hidden",
    scrollbarWidth: "none",
    padding: "4px 5px 5px",
    boxSizing: "border-box",
  };
}

function systemsRailViewportStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "stretch",
    columnGap: 4,
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    width: "100%",
  };
}

function systemsRailArrowStyle(visible: boolean): CSSProperties {
  return {
    display: "none",
    placeItems: "center",
    width: 28,
    height: 34,
    border: `1px solid ${raTheme.color.borderStrong}`,
    borderRadius: raTheme.radius.small,
    background: raTheme.color.surface,
    color: raTheme.color.accent,
    fontSize: 20,
    fontWeight: 850,
    lineHeight: 1,
    pointerEvents: "none",
    visibility: visible ? "visible" : "hidden",
    boxSizing: "border-box",
  };
}

function systemCardStyle(focused: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "46px minmax(0, 1fr) auto",
    gridTemplateRows: "minmax(0, 1fr)",
    alignItems: "center",
    columnGap: 10,
    rowGap: 0,
    minWidth: 0,
    minHeight: 0,
    padding: "6px 10px",
    border: `1px solid ${raTheme.color.borderSubtle}`,
    borderRadius: raTheme.radius.medium,
    background: focused ? raTheme.surface.focusedContentStat : raTheme.surface.contentStat,
    borderColor: focused ? raTheme.focus.compactBorder : raTheme.color.borderSubtle,
    boxShadow: focused ? raTheme.focus.compactShadow : "none",
    outline: "none",
    boxSizing: "border-box",
  };
}

function scrollSystemCardIntoView(target: HTMLElement): void {
  const rail = target.closest<HTMLElement>("[data-ra-profile-system-rail]");
  if (rail === null) return;
  const railBounds = rail.getBoundingClientRect();
  const cardBounds = target.getBoundingClientRect();
  const focusSpace = 5;
  if (cardBounds.left < railBounds.left + focusSpace) {
    rail.scrollLeft -= railBounds.left + focusSpace - cardBounds.left;
  } else if (cardBounds.right > railBounds.right - focusSpace) {
    rail.scrollLeft += cardBounds.right - (railBounds.right - focusSpace);
  }
}

function moveProfileFocus(event: GamepadEvent, target: HTMLElement | null | undefined): boolean {
  if (target === null || target === undefined || !takeDeckySteamGamepadFocus(target)) return false;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  playDeckySteamNavigationSound(target.ownerDocument);
  return true;
}

function SystemCard({
  system,
  index,
  onFocused,
  onOpenSystem,
  onExitLeft,
  onMoveRight,
  onMoveVertical,
}: {
  readonly system: Model["systems"][number];
  readonly index: number;
  readonly onFocused: (index: number, target: HTMLElement) => void;
  readonly onOpenSystem: (system: { readonly systemId: string; readonly title: string }) => void;
  readonly onExitLeft: (() => boolean) | undefined;
  readonly onMoveRight: ((event: GamepadEvent, index: number) => boolean) | undefined;
  readonly onMoveVertical: (event: GamepadEvent, index: number, offset: number) => boolean;
}): JSX.Element {
  const focusCard = (target: EventTarget | null): void => {
    if (target instanceof HTMLElement) onFocused(index, target);
  };
  const handleBoundaryDirection = (event: GamepadEvent): void => {
    if (event.detail.button === GamepadButton.DIR_UP && onMoveVertical(event, index, -1)) return;
    if (event.detail.button === GamepadButton.DIR_DOWN && onMoveVertical(event, index, 1)) return;
    const moved = event.detail.button === GamepadButton.DIR_LEFT
      ? onExitLeft?.()
      : event.detail.button === GamepadButton.DIR_RIGHT
        ? onMoveRight?.(event, index)
        : false;
    if (moved !== true) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      focusClassName="achievement-companion-ra-profile-system--focused"
      focusWithinClassName="achievement-companion-ra-profile-system--focused"
      aria-label={`${system.title}, ${system.unlockedAchievements.toLocaleString()} unlocked achievements`}
      data-ra-profile-system={system.systemId}
      onActivate={() => onOpenSystem(system)}
      onClick={() => onOpenSystem(system)}
      onFocus={(event) => focusCard(event.currentTarget)}
      onGamepadFocus={(event) => focusCard(event.currentTarget)}
      onGamepadDirection={handleBoundaryDirection}
      style={systemCardStyle(false)}
    >
      <div style={{ width: 42, height: 38, display: "grid", placeItems: "center", minWidth: 0, minHeight: 0 }}>
        {system.iconUrl !== undefined
          ? <DeckySystemIcon iconSize={36} iconUrl={system.iconUrl} />
          : <img alt="" src={gamepadIconUrl} style={{ width: 28, height: 28, filter: raTheme.iconFilter.primary }} />}
      </div>
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ color: raTheme.color.textPrimary, fontSize: 13, fontWeight: 750, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{system.title}</div>
        <div style={{ color: raTheme.color.textMuted, fontSize: 11, lineHeight: 1.1 }}>{system.unlockedAchievements.toLocaleString()} unlocked achievements</div>
      </div>
      <span aria-hidden="true" style={{ color: raTheme.color.accent, fontSize: 18 }}>›</span>
    </Focusable>
  );
}

function profileFactStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "22px minmax(0, 1fr)",
    alignItems: "center",
    gap: 8,
    color: raTheme.color.textSecondary,
    fontSize: "0.77em",
    lineHeight: 1.2,
  };
}

function profileFactIconStyle(tone: "blue" | "gold"): CSSProperties {
  return {
    width: 16,
    height: 16,
    flexShrink: 0,
    filter: tone === "gold" ? raTheme.iconFilter.hardcore : raTheme.iconFilter.primary,
  };
}

function ProfileFact({ iconUrl, tone = "blue", children }: { readonly iconUrl: string; readonly tone?: "blue" | "gold"; readonly children: ReactNode }): JSX.Element {
  return (
    <div style={profileFactStyle()}>
      <img alt="" src={iconUrl} style={profileFactIconStyle(tone)} />
      <span>{children}</span>
    </div>
  );
}

function ProfileStat({ label, value, icon }: { readonly label: string; readonly value: string; readonly icon?: JSX.Element }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: raTheme.color.textSecondary, fontSize: "0.77em", lineHeight: 1.2, whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{icon}{label}</span>
      <span style={{ color: raTheme.color.textPrimary, fontWeight: 750, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ProfileAwardIcon({ kind }: { readonly kind: "beaten" | "mastered" }): JSX.Element {
  const glyphSize = kind === "mastered" ? 38 : 34;
  return (
    <span style={{ ...raRecipes.compactGame.statusEmblem(kind), width: 44, height: 44, flex: "0 0 44px" }}>
      <span style={{ display: "block", transform: kind === "mastered" ? "translateY(-3px)" : "translateX(-1px)" }}>
        <DeckyGameStatusIcon kind={kind} size={glyphSize} color={kind === "mastered" ? raTheme.color.mastered : raTheme.color.beatenFlagWhite} />
      </span>
    </span>
  );
}

type AchievementMode = "hardcore" | "softcore" | "both";

function dashboardPanelStyle(): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    gridArea: "progress",
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    padding: 11,
    background: raTheme.surface.contentCard,
    overflow: "hidden",
    boxSizing: "border-box",
  };
}

function dashboardHeadingStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "title"),
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    fontWeight: 850,
    letterSpacing: "0.07em",
    lineHeight: 1.1,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

function ModeIcon({ mode }: { readonly mode: AchievementMode }): JSX.Element {
  if (mode === "softcore") {
    return <img alt="" src={gamepadIconUrl} style={{ width: 14, height: 14, filter: raTheme.iconFilter.softcore }} />;
  }
  if (mode === "both") {
    return (
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="10" r="5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="13" cy="10" r="5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5c-4.5 0-7.5 3.25-7.5 7.4 0 2.45 1.25 4.5 3.25 5.7V20h8.5v-4.4c2-1.2 3.25-3.25 3.25-5.7 0-4.15-3-7.4-7.5-7.4Z" fill="currentColor" />
      <path d="M8.2 10.6h2.2v2.2H8.2zm5.4 0h2.2v2.2h-2.2z" fill={raTheme.color.surface} />
    </svg>
  );
}

function ModeChip({
  mode,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onMoveHorizontal,
}: {
  readonly mode: AchievementMode;
  readonly selected: boolean;
  readonly onSelect: (mode: AchievementMode) => void;
  readonly onMoveUp: ((event: GamepadEvent) => boolean) | undefined;
  readonly onMoveDown: (event: GamepadEvent) => boolean;
  readonly onMoveHorizontal: (event: GamepadEvent, mode: AchievementMode, offset: number) => boolean;
}): JSX.Element {
  const label = mode === "hardcore" ? "Hardcore" : mode === "softcore" ? "Softcore" : "Both";
  return (
    <Focusable
      noFocusRing
      role="button"
      aria-label={`${label} achievement progress`}
      aria-pressed={selected}
      tabIndex={0}
      data-ra-profile-mode-chip={mode}
      data-achievement-companion-steam-filter-control="true"
      data-achievement-filter-selected={selected ? "true" : "false"}
      onActivate={() => onSelect(mode)}
      onClick={() => onSelect(mode)}
      onGamepadDirection={(event) => {
        if (event.detail.button === GamepadButton.DIR_UP) onMoveUp?.(event);
        if (event.detail.button === GamepadButton.DIR_DOWN) onMoveDown(event);
        if (event.detail.button === GamepadButton.DIR_LEFT) onMoveHorizontal(event, mode, -1);
        if (event.detail.button === GamepadButton.DIR_RIGHT) onMoveHorizontal(event, mode, 1);
      }}
      style={{
        ...raRecipes.filter(selected, false),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        gap: 5,
        width: "auto",
        minWidth: 0,
        minHeight: 27,
        padding: "3px 8px",
        borderRadius: raTheme.radius.pill,
        fontSize: 11,
        whiteSpace: "nowrap",
      }}
    >
      <ModeIcon mode={mode} />
      <span>{label}</span>
    </Focusable>
  );
}

function AchievementProgressPanel({
  model,
  mode,
  onSelectMode,
  allowModeSelection,
  onMoveUp,
  onMoveDown,
  onMoveHorizontal,
}: {
  readonly model: Model;
  readonly mode: AchievementMode;
  readonly onSelectMode: (mode: AchievementMode) => void;
  readonly allowModeSelection: boolean;
  readonly onMoveUp: (event: GamepadEvent) => boolean;
  readonly onMoveDown: (event: GamepadEvent) => boolean;
  readonly onMoveHorizontal: (event: GamepadEvent, mode: AchievementMode, offset: number) => boolean;
}): JSX.Element {
  const progress = model.progressByMode[mode];
  const summary = progress === undefined
    ? "Achievement progress unavailable for this mode"
    : progress.totalCount === undefined
      ? `${progress.unlockedCount.toLocaleString()} achievements unlocked`
      : `${progress.unlockedCount.toLocaleString()} / ${progress.totalCount.toLocaleString()} achievements unlocked`;
  return (
    <section data-ra-profile-achievement-progress style={dashboardPanelStyle()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 }}>
        <div style={dashboardHeadingStyle()}>
          <img alt="" src={barChartIconUrl} style={{ width: 21, height: 21, filter: raTheme.iconFilter.primary }} />
          <span>Achievement Progress</span>
        </div>
        {allowModeSelection ? (
          <Focusable flow-children="left-right" noFocusRing tabIndex={-1} aria-label="Achievement mode" style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <ModeChip mode="hardcore" selected={mode === "hardcore"} onSelect={onSelectMode} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onMoveHorizontal={onMoveHorizontal} />
            <ModeChip mode="softcore" selected={mode === "softcore"} onSelect={onSelectMode} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onMoveHorizontal={onMoveHorizontal} />
            <ModeChip mode="both" selected={mode === "both"} onSelect={onSelectMode} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onMoveHorizontal={onMoveHorizontal} />
          </Focusable>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 14, alignItems: "center", flex: "1 1 auto", minWidth: 0, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
            <span style={{ color: raTheme.color.textPrimary, fontSize: 14, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
            {progress?.completionPercent !== undefined ? <strong style={{ color: raTheme.color.textPrimary, fontSize: 20, lineHeight: 1, whiteSpace: "nowrap" }}>{progress.completionPercent}%</strong> : null}
          </div>
          {progress !== undefined && progress.completionPercent !== undefined ? (
            <DeckyCompletionProgressBar percent={progress.completionPercent} showCaption={false} />
          ) : null}
        </div>
        {progress !== undefined && progress.remainingCount !== undefined ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 140, maxWidth: 160, height: "100%", paddingLeft: 16, borderLeft: `1px solid ${raTheme.color.borderSubtle}`, boxSizing: "border-box" }}>
            <strong style={{ color: raTheme.color.textPrimary, fontSize: 22, lineHeight: 1.05 }}>{progress.remainingCount.toLocaleString()}</strong>
            <span style={{ color: raTheme.color.textSecondary, fontSize: 12, lineHeight: 1.2 }}>achievements<br />remaining</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function recentPanelStyle(): CSSProperties {
  return {
    ...dashboardPanelStyle(),
    gridArea: "completions",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: 4,
    padding: 9,
  };
}

function recentPanelHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
    minHeight: 22,
  };
}

function RecentCompletionRow({
  completion,
  index,
  onOpenCompletionProgress,
  onMoveVertical,
  onMoveLeft,
}: {
  readonly completion: Model["recentCompletions"][number];
  readonly index: number;
  readonly onOpenCompletionProgress: (filter: "beaten" | "mastered" | "completed") => void;
  readonly onMoveVertical: (event: GamepadEvent, index: number, offset: number) => boolean;
  readonly onMoveLeft: (event: GamepadEvent, index: number) => boolean;
}): JSX.Element {
  const { game, kind, awardedAt, dateKind } = completion;
  const statusColor = kind === "mastered"
    ? raTheme.color.mastered
    : kind === "completed"
      ? raTheme.color.softcore
      : raTheme.color.beaten;
  const date = awardedAt === undefined
    ? "Award date unavailable"
    : `${dateKind === "unlock" ? "Last unlock · " : ""}${new Date(awardedAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
  const statusLabel = kind === "mastered" ? "Mastered" : kind === "completed" ? "Completed" : "Beaten";
  const statusStyle: CSSProperties = kind === "completed"
    ? { ...raRecipes.card("compact", true), position: "relative", isolation: "isolate", border: `2px solid ${raTheme.color.softcore}`, background: raTheme.surface.contentCard }
    : raRecipes.compactGame.status(kind);
  const onOpen = (): void => onOpenCompletionProgress(kind);
  return (
    <Focusable
      noFocusRing
      role="button"
      tabIndex={0}
      aria-label={`Show ${statusLabel.toLowerCase()} games`}
      onActivate={onOpen}
      onClick={onOpen}
      onGamepadDirection={(event) => {
        if (event.detail.button === GamepadButton.DIR_UP) onMoveVertical(event, index, -1);
        if (event.detail.button === GamepadButton.DIR_DOWN) onMoveVertical(event, index, 1);
        if (event.detail.button === GamepadButton.DIR_LEFT) onMoveLeft(event, index);
      }}
      style={{ display: "block", alignSelf: "stretch", height: "100%", minWidth: 0, minHeight: 0, border: 0, borderRadius: raTheme.radius.medium, background: "transparent", boxSizing: "border-box" }}
      data-ra-profile-recent-completion-row={game.gameId}
    >
      <div style={{ ...statusStyle, display: "grid", gridTemplateColumns: "54px minmax(0, 1fr) 18px", alignItems: "center", gap: 9, minHeight: 0, height: "100%", padding: "9px 12px", borderRadius: raTheme.radius.small }}>
        {kind !== "completed" ? <span aria-hidden="true" style={{ ...raRecipes.compactGame.statusWatermark, top: "50%", right: 26, transform: "translateY(-50%)", opacity: 0.07 }}><DeckyGameStatusIcon kind={kind} size={94} color={statusColor} /></span> : null}
        {kind === "completed"
          ? <span style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center", width: 44, height: 44, border: `2px solid ${raTheme.color.softcore}`, borderRadius: "50%", background: raTheme.surface.softcore, boxSizing: "border-box" }}><img alt="" src={gamepadIconUrl} style={{ width: 28, height: 28, filter: raTheme.iconFilter.softcore }} /></span>
          : <ProfileAwardIcon kind={kind} />}
        <span style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, minWidth: 0 }}>
          <strong style={{ color: statusColor, fontSize: 14, lineHeight: 1.1 }}>{statusLabel}</strong>
          <span style={{ color: raTheme.color.textPrimary, fontSize: 13, fontWeight: 700, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.title}</span>
          <span style={{ color: raTheme.color.textSecondary, fontSize: 11, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{date}</span>
        </span>
        <span aria-hidden="true" style={{ position: "relative", zIndex: 1, color: statusColor, fontSize: 22, lineHeight: 1, justifySelf: "end" }}>›</span>
      </div>
    </Focusable>
  );
}

function RecentCompletionsPanel({
  model,
  onOpenCompletionProgress,
  onMoveVertical,
  onMoveLeft,
}: {
  readonly model: Model;
  readonly onOpenCompletionProgress: (filter: "beaten" | "mastered" | "completed") => void;
  readonly onMoveVertical: (event: GamepadEvent, index: number, offset: number) => boolean;
  readonly onMoveLeft: (event: GamepadEvent, index: number) => boolean;
}): JSX.Element {
  return (
    <section data-ra-profile-recent-completions style={recentPanelStyle()}>
      <div style={recentPanelHeaderStyle()}>
        <div style={dashboardHeadingStyle()}>
          <img alt="" src={trophyIconUrl} style={{ width: 20, height: 20, filter: raTheme.iconFilter.primary }} />
          <span>Recent Completions</span>
        </div>
      </div>
      <Focusable flow-children="vertical" noFocusRing tabIndex={-1} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "repeat(2, minmax(0, 1fr))", gap: 6, minHeight: 0, minWidth: 0 }}>
        {model.recentCompletions.length > 0
            ? model.recentCompletions.map((completion, index) => (
              <RecentCompletionRow key={completion.game.gameId} completion={completion} index={index} onOpenCompletionProgress={onOpenCompletionProgress} onMoveVertical={onMoveVertical} onMoveLeft={onMoveLeft} />
          ))
          : <span style={{ display: "grid", gridColumn: "1 / -1", minHeight: 0, placeItems: "center", color: raTheme.color.textMuted, fontSize: 12, textAlign: "center" }}>No recent completed games available.</span>}
      </Focusable>
    </section>
  );
}

export function DeckyRetroAchievementsFullScreenProfileDashboard({
  model,
  isActive,
  onOpenExternalUrl,
  onOpenCompletionProgress,
  onOpenSystem,
  refreshedAt,
}: {
  readonly model: Model;
  readonly isActive: boolean;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly onOpenCompletionProgress: (filter: "beaten" | "mastered" | "completed") => void;
  readonly onOpenSystem: (system: { readonly systemId: string; readonly title: string }) => void;
  readonly refreshedAt: number | undefined;
}): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const avatarLinkRef = useRef<HTMLDivElement>(null);
  const systemsRailRef = useRef<HTMLDivElement>(null);
  const leftSystemsArrowRef = useRef<HTMLSpanElement>(null);
  const rightSystemsArrowRef = useRef<HTMLSpanElement>(null);
  const [achievementMode, setAchievementMode] = useState<AchievementMode>(model.initialAchievementMode);

  useEffect(() => {
    setAchievementMode(model.initialAchievementMode);
  }, [model.initialAchievementMode]);

  useLayoutEffect(() => {
    if (!isActive) return;
    const root = rootRef.current;
    const ownerWindow = root?.ownerDocument.defaultView;
    if (root === null || root === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      const target = root.querySelector<HTMLElement>("[data-ra-profile-system]")
        ?? root.querySelector<HTMLElement>("[data-ra-profile-recent-completion-row]")
        ?? avatarLinkRef.current;
      if (target !== undefined && target !== null && !root.contains(root.ownerDocument.activeElement)) takeDeckySteamGamepadFocus(target);
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [isActive]);

  useLayoutEffect(() => {
    const rail = systemsRailRef.current;
    const ownerWindow = rail?.ownerDocument.defaultView;
    if (!isActive || rail === null || ownerWindow === null || ownerWindow === undefined) return;
    const syncArrowVisibility = (): void => {
      const cards = [...rail.querySelectorAll<HTMLElement>("[data-ra-profile-system]")];
      const focusedIndex = cards.findIndex((card) => card.classList.contains("gpfocus"));
      if (leftSystemsArrowRef.current !== null) {
        leftSystemsArrowRef.current.style.visibility = cards.length > 1 && focusedIndex > 0 ? "visible" : "hidden";
      }
      if (rightSystemsArrowRef.current !== null) {
        rightSystemsArrowRef.current.style.visibility = cards.length > 1 && focusedIndex < cards.length - 1 ? "visible" : "hidden";
      }
    };
    const observer = new ownerWindow.MutationObserver(syncArrowVisibility);
    observer.observe(rail, { attributes: true, attributeFilter: ["class"], subtree: true });
    syncArrowVisibility();
    return () => observer.disconnect();
  }, [isActive, model.systems.length]);

  const memberSince = formatProfileMemberSince(model.profile.metrics, { month: "long" });
  const refreshTime = formatFullscreenLastSync(refreshedAt);
  const selectedRank = model.ranks[0];
  const avatarUrl = addProfileAvatarCacheBustParam(model.profile.identity.avatarUrl, refreshedAt);
  const profileUrl = model.profile.identity.profileUrl
    ?? `https://retroachievements.org/user/${encodeURIComponent(model.profile.identity.displayName)}`;
  const focusAvatarLink = (): boolean => takeDeckySteamGamepadFocus(avatarLinkRef.current);
  const focusAvatarLinkWithSound = (event: GamepadEvent): boolean => moveProfileFocus(event, avatarLinkRef.current);
  const focusFirstSystem = (event: GamepadEvent): boolean => moveProfileFocus(
    event,
    rootRef.current?.querySelector<HTMLElement>("[data-ra-profile-system]"),
  );
  const focusFirstCompletion = (event: GamepadEvent): boolean => moveProfileFocus(
    event,
    rootRef.current?.querySelector<HTMLElement>("[data-ra-profile-recent-completion-row]"),
  );
  const moveWithinSystems = (event: GamepadEvent, index: number, offset: number): boolean => {
    const target = rootRef.current?.querySelectorAll<HTMLElement>("[data-ra-profile-system]")[index + offset];
    return target !== undefined
      ? moveProfileFocus(event, target)
      : index === 0 && offset < 0 && focusAvatarLinkWithSound(event);
  };
  const moveWithinCompletions = (event: GamepadEvent, index: number, offset: number): boolean => {
    const target = rootRef.current?.querySelectorAll<HTMLElement>("[data-ra-profile-recent-completion-row]")[index + offset];
    return target !== undefined
      ? moveProfileFocus(event, target)
      : index === 0 && offset < 0 && focusAvatarLinkWithSound(event);
  };
  const focusAdjacentModeChip = (event: GamepadEvent, mode: AchievementMode, offset: number): boolean => {
    const modes: readonly AchievementMode[] = ["hardcore", "softcore", "both"];
    const targetMode = modes[modes.indexOf(mode) + offset];
    return targetMode === undefined ? false : moveProfileFocus(
      event,
      rootRef.current?.querySelector<HTMLElement>(`[data-ra-profile-mode-chip='${targetMode}']`),
    );
  };
  const focusSystemBesideCompletion = (event: GamepadEvent, index: number): boolean => moveProfileFocus(
    event,
    rootRef.current?.querySelectorAll<HTMLElement>("[data-ra-profile-system]")[index]
      ?? rootRef.current?.querySelector<HTMLElement>("[data-ra-profile-system]")
      ?? avatarLinkRef.current,
  );
  const focusCompletionBesideSystem = (event: GamepadEvent, index: number): boolean => moveProfileFocus(
    event,
    rootRef.current?.querySelectorAll<HTMLElement>("[data-ra-profile-recent-completion-row]")[Math.min(index, 1)]
      ?? rootRef.current?.querySelector<HTMLElement>("[data-ra-profile-recent-completion-row]"),
  );
  const handleSystemFocused = (_index: number, target: HTMLElement): void => scrollSystemCardIntoView(target);
  return (
    <main ref={rootRef} data-ac-ra-theme="fullscreen" data-ra-full-screen-profile-dashboard style={pageStyle()}>
      <DeckyFocusStyles />
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={gridStyle()}>
        <section style={panelStyle("profile")}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: "0 1 auto" }}>
            <Focusable
              ref={avatarLinkRef}
              noFocusRing
              role="button"
              tabIndex={0}
              focusClassName="achievement-companion-ra-profile-avatar--focused"
              focusWithinClassName="achievement-companion-ra-profile-avatar--focused"
              data-ra-profile-avatar-link="true"
              aria-label={`View ${model.profile.identity.displayName} on RetroAchievements`}
              title="View RetroAchievements profile"
              onActivate={() => onOpenExternalUrl(profileUrl)}
              onClick={() => onOpenExternalUrl(profileUrl)}
              onGamepadDirection={(event) => {
                if (event.detail.button === GamepadButton.DIR_RIGHT || event.detail.button === GamepadButton.DIR_DOWN) {
                  if (!focusFirstSystem(event)) focusFirstCompletion(event);
                }
              }}
              style={{ width: 70, height: 70, flex: "0 0 70px", display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${raTheme.color.accent}`, borderRadius: 14, overflow: "hidden", background: qamTheme.decorative.avatarBackground, boxShadow: qamTheme.decorative.avatarGlow, boxSizing: "border-box", cursor: "pointer" }}
            >
              {avatarUrl !== undefined
                ? <img alt="" src={avatarUrl} style={{ width: 66, height: 66, objectFit: "cover" }} />
                : <span style={{ color: raTheme.color.textPrimary, fontSize: "1.5em", fontWeight: 850 }}>{model.profile.identity.displayName.slice(0, 2).toUpperCase()}</span>}
            </Focusable>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: "clamp(1.05rem, 1.55vw, 1.35rem)", fontWeight: 850, lineHeight: 1.08, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{model.profile.identity.displayName}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: raTheme.color.accent, fontSize: "0.82em", fontWeight: 700 }}><span aria-hidden="true" style={{ width: 9, height: 9, flexShrink: 0, borderRadius: 999, backgroundColor: "#20e889", boxShadow: "0 0 10px rgba(32, 232, 137, 0.46)" }} />RA account</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "4px 16px", flex: "1 1 auto", minWidth: 0 }}>
            {memberSince !== undefined ? <ProfileFact iconUrl={calendarIconUrl}>{`Member since ${memberSince}`}</ProfileFact> : null}
            {selectedRank !== undefined ? <ProfileFact iconUrl={trophyIconUrl} tone="gold"><DeckyRetroAchievementsRankTrendIndicator accountId={model.profile.identity.accountId} kind={selectedRank.kind} />{`${selectedRank.label} ${selectedRank.value}`}</ProfileFact> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, flex: "0 0 auto", minWidth: 0 }}>
            <ProfileStat icon={<DeckyRetroAchievementsPointsIcon size={13} />} label={model.initialAchievementMode === "softcore" ? "Softcore Points" : "Points Earned"} value={(model.initialAchievementMode === "softcore" ? model.profileStats.softcorePoints : model.profileStats.hardcorePoints) ?? "-"} />
            <ProfileStat icon={<DeckyRetroAchievementsPointsIcon size={13} />} label="RetroPoints" value={model.profileStats.raPoints ?? "-"} />
            {refreshTime !== undefined ? <div style={{ color: raTheme.color.textMuted, fontSize: raTheme.type.fullscreen.caption, whiteSpace: "nowrap", textAlign: "right" }}>{refreshTime}</div> : null}
          </div>
        </section>
        <Focusable flow-children="vertical" noFocusRing tabIndex={-1} style={rightColumnStyle(model.systems.length > 0 || model.systemsUnavailable)}>
          {model.systems.length > 0 ? (
          <Focusable
            flow-children="vertical"
            noFocusRing
            tabIndex={-1}
            style={systemsPanelStyle()}
            data-ra-profile-systems
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <img alt="" src={gamepadIconUrl} style={{ width: 24, height: 24, filter: raTheme.iconFilter.primary }} />
                <div style={{ color: raTheme.color.textPrimary, fontSize: 17, fontWeight: 850, letterSpacing: "0.08em", lineHeight: 1.1 }}>SYSTEMS</div>
              </div>
            </div>
            <div style={systemsRailViewportStyle()}>
              <span ref={leftSystemsArrowRef} aria-hidden="true" data-ra-profile-system-arrow="left" style={systemsRailArrowStyle(false)}>←</span>
              <Focusable
                ref={systemsRailRef}
                flow-children="vertical"
                navEntryPreferPosition={NavEntryPositionPreferences.FIRST}
                noFocusRing
                tabIndex={-1}
                style={systemsRailStyle()}
                aria-label="Systems"
                data-ra-profile-system-rail
              >
                {model.systems.slice(0, 3).map((system, index) => (
                  <SystemCard
                    key={system.systemId}
                    index={index}
                    onFocused={handleSystemFocused}
                    onOpenSystem={onOpenSystem}
                    onExitLeft={index === 0 ? focusAvatarLink : undefined}
                    onMoveRight={focusCompletionBesideSystem}
                    onMoveVertical={moveWithinSystems}
                    system={system}
                  />
                ))}
              </Focusable>
              <span ref={rightSystemsArrowRef} aria-hidden="true" data-ra-profile-system-arrow="right" style={systemsRailArrowStyle(model.systems.length > 1)}>→</span>
            </div>
          </Focusable>
          ) : model.systemsUnavailable ? (
            <section data-ra-profile-systems style={systemsPanelStyle()}>
              <div style={{ color: raTheme.color.textPrimary, fontSize: 17, fontWeight: 850, letterSpacing: "0.08em" }}>SYSTEMS</div>
              <div style={{ color: raTheme.color.textSecondary, fontSize: 13 }}>System progress unavailable for the selected mode</div>
            </section>
          ) : null}
          <AchievementProgressPanel
            model={model}
            mode={achievementMode}
            onSelectMode={setAchievementMode}
            allowModeSelection={model.initialAchievementMode === "both"}
            onMoveUp={focusAvatarLinkWithSound}
            onMoveDown={focusFirstCompletion}
            onMoveHorizontal={focusAdjacentModeChip}
          />
          <RecentCompletionsPanel model={model} onOpenCompletionProgress={onOpenCompletionProgress} onMoveVertical={moveWithinCompletions} onMoveLeft={focusSystemBesideCompletion} />
        </Focusable>
      </Focusable>
    </main>
  );
}
