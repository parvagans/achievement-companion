import { Focusable, type GamepadEvent } from "@decky/ui";
import type { GameDetailSnapshot, NormalizedAchievement, ProgressSummary } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { DeckyCompletionProgressBar, getCompletionPercent } from "./decky-completion-progress-bar";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { buildDeckyCompactUpNextModel } from "./decky-compact-up-next-model";
import {
  checkpointDeckyCompactGameOverview,
  readDeckyCompactGameOverviewState,
  writeDeckyCompactGameOverviewState,
  type DeckyCompactGameOverviewFocusTarget,
} from "./decky-compact-game-overview-state";
import {
  readDeckyCompactFocusRestoreRequest,
  subscribeToDeckyCompactFocusRestore,
} from "./decky-compact-focus-restore";
import { useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { DeckyOverviewMenuButton, type DeckyGameOverviewActions } from "./decky-full-screen-game-overview-content";
import {
  buildDeckyManageSuggestionsMenuItems,
  buildRetroAchievementsGoalSettingsMenuItem,
  type DeckyOverviewMenuItem,
} from "./decky-overview-menu-model";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { achievementCompanionQamTheme as theme, getQamCompactFocusControlStyle } from "./decky-qam-theme";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { useDeckyVisualFocusState } from "./decky-visual-focus-state";

function lineClamp(lines: number): CSSProperties {
  return { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" };
}

function initials(title: string): string {
  return title.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AC";
}

function AchievementArtwork({ achievement, compact }: { readonly achievement: NormalizedAchievement; readonly compact: boolean }): JSX.Element {
  const size = compact ? 38 : 48;
  return achievement.badgeImageUrl !== undefined
    ? <DeckyGameArtwork compact size={size} src={achievement.badgeImageUrl} title={achievement.title} />
    : <span aria-hidden="true" style={{ width: size, height: size, flex: `0 0 ${size}px`, display: "grid", placeItems: "center", borderRadius: theme.radius.small, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentStat, color: theme.color.textMuted, fontSize: compact ? 10 : 12, fontWeight: 800 }}>{initials(achievement.title)}</span>;
}

function RecommendationRow({
  achievement,
  compact,
  index,
  preferredFocus,
  onActivate,
  onCancel,
  onFocused,
  onOpenAchievements,
  onSkip,
  elementRef,
}: {
  readonly achievement: NormalizedAchievement;
  readonly compact: boolean;
  readonly index: number;
  readonly preferredFocus: boolean;
  readonly onActivate: (element: HTMLElement) => void;
  readonly onCancel: () => void;
  readonly onFocused: (element: HTMLElement, index: number) => void;
  readonly onOpenAchievements: (element: HTMLElement) => void;
  readonly onSkip: () => void;
  readonly elementRef: (element: HTMLDivElement | null) => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  useDeckyVisualFocusState(ref, setFocused);
  const activate = (): void => { if (ref.current !== null) onActivate(ref.current); };
  return <Focusable
    aria-label={`${achievement.title}. ${achievement.description ?? ""}`}
    data-ac-game-overview-suggestion={achievement.achievementId}
    noFocusRing
    onActivate={activate}
    onCancel={onCancel}
    onClick={activate}
    onGamepadBlur={() => setFocused(false)}
    onGamepadFocus={() => {
      setFocused(true);
      if (ref.current !== null) {
        scrollDeckyFocusTargetIntoView(ref.current);
        onFocused(ref.current, index);
      }
    }}
    {...(!focused ? {} : {
      onSecondaryActionDescription: "Skip",
      onOptionsActionDescription: "List",
      onSecondaryButton: (event: GamepadEvent) => { event.preventDefault(); event.stopPropagation(); if (!event.detail.is_repeat) onSkip(); },
      onOptionsButton: (event: GamepadEvent) => { event.preventDefault(); event.stopPropagation(); if (!event.detail.is_repeat && ref.current !== null) onOpenAchievements(ref.current); },
    })}
    preferredFocus={preferredFocus}
    ref={(node) => { ref.current = node; elementRef(node); }}
    role="button"
    tabIndex={0}
    style={{ minWidth: 0, minHeight: compact ? 50 : 66, padding: compact ? 5 : "8px 7px", borderRadius: theme.radius.small,
      border: `1px solid ${focused ? theme.focus.compactBorder : compact ? theme.color.borderSubtle : "transparent"}`,
      background: focused ? theme.surface.focusedContentStat : compact ? theme.surface.contentStat : "transparent",
      boxShadow: focused ? theme.focus.compactShadow : "none", display: "grid", gridTemplateColumns: `${compact ? 38 : 48}px minmax(0, 1fr)`, alignItems: "center", gap: compact ? 8 : 9, boxSizing: "border-box" }}
  >
    <AchievementArtwork achievement={achievement} compact={compact} />
    <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
      <strong title={achievement.title} style={{ ...lineClamp(compact ? 1 : 2), color: theme.color.textPrimary, fontSize: compact ? 11 : 13, fontWeight: 800, lineHeight: 1.12 }}>{achievement.title}</strong>
      {achievement.description !== undefined ? <span title={achievement.description} style={{ ...lineClamp(compact ? 1 : 2), color: theme.color.textSecondary, fontSize: compact ? 9.5 : 10.5, lineHeight: 1.18 }}>{achievement.description}</span> : null}
    </span>
  </Focusable>;
}

function StatusFocusTarget({ label, actionLabel, children, onCancel, onActivate }: { readonly label: string; readonly actionLabel?: string; readonly children: ReactNode; readonly onCancel: () => void; readonly onActivate?: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  useDeckyVisualFocusState(ref, setFocused);
  return <Focusable ref={ref} noFocusRing role="group" aria-label={label} onActivate={onActivate ?? (() => undefined)} onClick={onActivate} onCancel={onCancel}
    onGamepadFocus={() => { setFocused(true); if (ref.current !== null) scrollDeckyFocusTargetIntoView(ref.current); }} onGamepadBlur={() => setFocused(false)}
    style={{ minHeight: 58, padding: "9px 8px", borderRadius: theme.radius.small, border: `1px solid ${focused ? theme.focus.compactBorder : "transparent"}`,
      background: focused ? theme.surface.focusedContentStat : "transparent", boxShadow: focused ? theme.focus.compactShadow : "none", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
    {children}
    {actionLabel !== undefined ? <span style={{ alignSelf: "flex-start", marginTop: 3, padding: "6px 10px", borderRadius: theme.radius.small, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentStat, color: theme.color.textPrimary, fontSize: 10, fontWeight: 800 }}>{actionLabel}</span> : null}
  </Focusable>;
}

export function DeckyCompactGameOverviewUpNext({
  snapshot,
  summary,
  achievementMode,
  progressDetails,
  steamProgress = false,
  onCancel,
  onOpenAchievementDetail,
  onOpenAchievements,
}: {
  readonly snapshot: GameDetailSnapshot;
  readonly summary: ProgressSummary;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly progressDetails?: ReactNode;
  readonly steamProgress?: boolean;
  readonly onCancel: () => void;
  readonly onOpenAchievementDetail: (achievementId: string, onClose?: () => void) => void;
  readonly onOpenAchievements: (achievementId?: string) => void;
}): JSX.Element {
  const { providerId, gameId } = snapshot.game;
  const saved = readDeckyCompactGameOverviewState(providerId, gameId);
  const [expanded, setExpanded] = useState(saved.expanded);
  const [focusTarget, setFocusTarget] = useState<DeckyCompactGameOverviewFocusTarget | undefined>(saved.focusTarget);
  const [lastFocusedSuggestionId, setLastFocusedSuggestionId] = useState(
    saved.focusTarget?.kind === "recommendation" ? saved.focusTarget.achievementId : undefined,
  );
  const preferences = useDeckyGameOverviewPreferences(providerId, gameId);
  const model = useMemo(() => buildDeckyCompactUpNextModel({
    snapshot,
    hiddenAchievementIds: preferences.hiddenAchievementIds,
    goal: preferences.retroAchievementsGoal,
    achievementMode,
    limit: 3,
  }), [achievementMode, preferences.hiddenAchievementIds, preferences.retroAchievementsGoal, snapshot]);
  const suggestions = model.suggestions;
  const recommendationRefs = useRef(new Map<string, HTMLDivElement>());
  const expandRef = useRef<HTMLDivElement | null>(null);
  const [expandFocused, setExpandFocused] = useState(false);
  useDeckyVisualFocusState(expandRef, setExpandFocused);
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const restoreRequest = useSyncExternalStore(subscribeToDeckyCompactFocusRestore, readDeckyCompactFocusRestoreRequest, readDeckyCompactFocusRestoreRequest);
  const completionPercent = getCompletionPercent(summary);
  const recommendationLabel = providerId === "retroachievements" ? `UP NEXT · ${preferences.retroAchievementsGoal.toUpperCase()}` : "UP NEXT";

  const checkpoint = (target: DeckyCompactGameOverviewFocusTarget, element: HTMLElement): void => {
    setFocusTarget(target);
    checkpointDeckyCompactGameOverview(providerId, gameId, target, element);
  };
  const setExpansion = (next: boolean): void => {
    setExpanded(next);
    writeDeckyCompactGameOverviewState(providerId, gameId, { expanded: next, focusTarget: { kind: "expand" } });
  };
  const restoreFocusedElement = (): void => {
    const latest = readDeckyCompactGameOverviewState(providerId, gameId).focusTarget;
    setFocusTarget(latest);
    const target = latest?.kind === "recommendation"
      ? recommendationRefs.current.get(latest.achievementId)
      : latest?.kind === "expand" ? expandRef.current
        : latest?.kind === "recommendation-options" ? optionsRef.current
          : undefined;
    if (target !== undefined && target !== null) requestDeckySteamGamepadFocusAfterMount(target);
  };
  useLayoutEffect(restoreFocusedElement, [expanded, gameId, providerId, restoreRequest]);

  useLayoutEffect(() => {
    if (focusTarget?.kind !== "recommendation" || suggestions.some(({ achievement }) => achievement.achievementId === focusTarget.achievementId) || suggestions.length === 0) return;
    const fallback = suggestions[Math.min(focusTarget.index, suggestions.length - 1)];
    if (fallback === undefined) return;
    const nextTarget = { kind: "recommendation" as const, achievementId: fallback.achievement.achievementId, index: Math.min(focusTarget.index, suggestions.length - 1) };
    setFocusTarget(nextTarget);
    writeDeckyCompactGameOverviewState(providerId, gameId, { focusTarget: nextTarget });
    const ownerWindow = recommendationRefs.current.get(nextTarget.achievementId)?.ownerDocument.defaultView;
    ownerWindow?.requestAnimationFrame(() => {
      const element = recommendationRefs.current.get(nextTarget.achievementId);
      if (element !== undefined) requestDeckySteamGamepadFocusAfterMount(element);
    });
  }, [focusTarget, gameId, providerId, suggestions]);

  const openDetails = (achievementId: string, element: HTMLElement, onClose?: () => void): void => {
    const index = Math.max(0, suggestions.findIndex(({ achievement }) => achievement.achievementId === achievementId));
    checkpoint({ kind: "recommendation", achievementId, index }, element);
    onOpenAchievementDetail(achievementId, onClose);
  };
  const openAchievements = (achievementId: string, element: HTMLElement): void => {
    const index = Math.max(0, suggestions.findIndex(({ achievement }) => achievement.achievementId === achievementId));
    if (index > 0 && !expanded) {
      setExpanded(true);
      writeDeckyCompactGameOverviewState(providerId, gameId, { expanded: true });
    }
    checkpoint({ kind: "recommendation", achievementId, index }, element);
    onOpenAchievements(achievementId);
  };
  const focusedSuggestion = focusTarget?.kind === "recommendation"
    ? suggestions.find(({ achievement }) => achievement.achievementId === focusTarget.achievementId)
    : undefined;
  const currentSuggestion = focusedSuggestion
    ?? suggestions.find(({ achievement }) => achievement.achievementId === lastFocusedSuggestionId)
    ?? suggestions[0];
  const actions: DeckyGameOverviewActions = {
    suggestions,
    hiddenSuggestions: model.hiddenAchievements,
    goalComplete: model.outcome.kind === "completed",
    onOpenAchievement: (achievementId, onClose) => {
      const element = recommendationRefs.current.get(achievementId) ?? optionsRef.current;
      if (element !== undefined && element !== null) openDetails(achievementId, element, onClose);
    },
    onJumpToAchievement: (achievementId) => {
      const element = recommendationRefs.current.get(achievementId) ?? optionsRef.current;
      if (element !== undefined && element !== null) openAchievements(achievementId, element);
    },
    onDismissSuggestion: preferences.hideSuggestion,
    onRestoreSuggestion: preferences.restoreSuggestion,
    onRestoreAllSuggestions: preferences.restoreAllSuggestions,
    onFocusedSuggestionChange: () => undefined,
  };
  const manageItems = buildDeckyManageSuggestionsMenuItems(actions);
  const menuItems: readonly DeckyOverviewMenuItem[] = [
    ...(providerId === "retroachievements" ? [buildRetroAchievementsGoalSettingsMenuItem({
      globalGoal: preferences.globalRetroAchievementsGoal,
      ...(preferences.retroAchievementsGoalOverride !== undefined ? { gameGoalOverride: preferences.retroAchievementsGoalOverride } : {}),
      onSetGlobalGoal: preferences.setGlobalRetroAchievementsGoal,
      onSetGameGoalOverride: preferences.setRetroAchievementsGameGoal,
    })] : []),
    { key: "manage", label: `Manage Suggestions (${model.hiddenAchievements.length} hidden)`, items: manageItems.length > 0 ? manageItems : [{ key: "none", label: "No suggestions to manage" }] },
    { key: "restore-all", label: "Restore All Suggestions", tone: "positive", onSelect: preferences.restoreAllSuggestions },
    ...(currentSuggestion === undefined ? [] : [{ key: "skip", label: "Skip Current Suggestion", tone: "destructive" as const, onSelect: () => preferences.hideSuggestion(currentSuggestion.achievement.achievementId) }]),
  ];
  const suggestionCount = suggestions.length;
  const canExpand = suggestionCount > 1;
  const status = model.outcome.kind === "completed"
    ? providerId === "steam" ? { title: "PERFECTED", detail: "All achievements unlocked." } : preferences.retroAchievementsGoal === "beat" ? { title: "BEAT GOAL COMPLETE", detail: "You've beaten this game." } : { title: "MASTER GOAL COMPLETE", detail: "You've mastered this game." }
    : model.outcome.kind === "all-hidden" ? { title: "All suggestions hidden", detail: "Restore dismissed achievements to continue." }
      : { title: "No eligible recommendations", detail: "Browse achievements to choose your next goal." };

  return <section aria-label="Your Progress and Up Next" data-ac-compact-game-overview-up-next={providerId} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
    <div style={{ color: theme.color.textSecondary, fontSize: 10, fontWeight: 800, letterSpacing: "0.065em", textTransform: "uppercase" }}>Your Progress</div>
    <div style={{ width: "100%", minWidth: 0, padding: 10, display: "flex", flexDirection: "column", gap: 7, boxSizing: "border-box", borderRadius: theme.radius.large, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentCard }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, minWidth: 0, color: theme.color.textSecondary, fontSize: 10, fontWeight: 700 }}>
        <strong style={{ minWidth: 0, color: theme.color.textPrimary, fontSize: 11 }}>{summary.unlockedCount.toLocaleString()} / {summary.totalCount?.toLocaleString() ?? "—"} achievements</strong>
        {completionPercent !== undefined ? <span style={{ flexShrink: 0 }}>{completionPercent}%</span> : null}
      </div>
      {completionPercent !== undefined ? <DeckyCompletionProgressBar compact percent={completionPercent} showCaption={false} {...(steamProgress ? { steamTheme: true } : {})} /> : null}
      {progressDetails}
      <div aria-hidden="true" style={{ height: 1, margin: "3px 0", background: theme.color.borderSubtle }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ color: theme.color.accent, fontSize: 10, fontWeight: 800, letterSpacing: "0.055em" }}>{recommendationLabel}</span>
      </div>
      {model.outcome.kind === "suggestion" ? <>
        {suggestions.map((suggestion, index) => index === 0 || expanded ? <RecommendationRow
          key={suggestion.achievement.achievementId}
          achievement={suggestion.achievement}
          compact={index > 0}
          elementRef={(element) => { if (element === null) recommendationRefs.current.delete(suggestion.achievement.achievementId); else recommendationRefs.current.set(suggestion.achievement.achievementId, element); }}
          index={index}
          onActivate={(element) => openDetails(suggestion.achievement.achievementId, element)}
          onCancel={onCancel}
          onFocused={(element, focusedIndex) => {
            setLastFocusedSuggestionId(suggestion.achievement.achievementId);
            checkpoint({ kind: "recommendation", achievementId: suggestion.achievement.achievementId, index: focusedIndex }, element);
          }}
          onOpenAchievements={(element) => openAchievements(suggestion.achievement.achievementId, element)}
          onSkip={() => preferences.hideSuggestion(suggestion.achievement.achievementId)}
          preferredFocus={focusTarget?.kind === "recommendation" && focusTarget.achievementId === suggestion.achievement.achievementId}
        /> : null)}
        <span style={{ color: theme.color.textMuted, fontSize: 9 }}>{suggestionCount} suggestion{suggestionCount === 1 ? "" : "s"} available</span>
      </> : <StatusFocusTarget label={status.title} onCancel={onCancel} {...(model.outcome.kind === "all-hidden" ? { actionLabel: "Restore Suggestions", onActivate: preferences.restoreAllSuggestions } : {})}>
        <strong style={{ color: theme.color.textPrimary, fontSize: 12.5 }}>{status.title}</strong>
        <span style={{ color: theme.color.textSecondary, fontSize: 10 }}>{status.detail}</span>
        {providerId === "retroachievements" && model.outcome.kind === "completed" && preferences.retroAchievementsGoal === "beat" ? <Focusable noFocusRing role="button" onActivate={() => preferences.setRetroAchievementsGameGoal("master")} onClick={() => preferences.setRetroAchievementsGameGoal("master")} onCancel={onCancel}
          style={{ alignSelf: "flex-start", minHeight: 32, marginTop: 3, padding: "0 10px", borderRadius: theme.radius.small, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentStat, color: theme.color.textPrimary, fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center" }}>Continue Toward Mastery</Focusable> : null}
      </StatusFocusTarget>}
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "grid", gridTemplateColumns: canExpand ? "minmax(0, 1fr) 48px" : "48px", justifyContent: canExpand ? "stretch" : "end", gap: 7, minWidth: 0 }}>
        {canExpand ? <Focusable ref={expandRef} noFocusRing role="button" aria-label={expanded ? "Show less suggestions" : "Show more suggestions"} onActivate={() => setExpansion(!expanded)} onClick={() => setExpansion(!expanded)} onCancel={onCancel}
          onFocus={() => setExpandFocused(true)} onBlur={() => setExpandFocused(false)}
          onGamepadFocus={() => { setExpandFocused(true); if (expandRef.current !== null) checkpoint({ kind: "expand" }, expandRef.current); }} onGamepadBlur={() => setExpandFocused(false)} preferredFocus={focusTarget?.kind === "expand"}
          style={{ minHeight: 34, padding: "0 10px", borderRadius: theme.radius.small, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentStat, color: theme.color.textPrimary, fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", boxSizing: "border-box", ...(expandFocused ? getQamCompactFocusControlStyle() : {}) }}>{expanded ? "Show Less" : "Show More Suggestions"}</Focusable> : null}
        <DeckyOverviewMenuButton compact label="Suggestion Options" displayLabel={<span aria-hidden="true" style={{ fontSize: 16, letterSpacing: 2 }}>•••</span>} items={menuItems} minHeight={34} preserveCompactSession onCancel={onCancel}
          elementRef={(element) => { optionsRef.current = element; }} onActivated={(element) => checkpoint({ kind: "recommendation-options" }, element)} onFocused={(element) => checkpoint({ kind: "recommendation-options" }, element)} preferredFocus={focusTarget?.kind === "recommendation-options"} />
      </Focusable>
    </div>
  </section>;
}
