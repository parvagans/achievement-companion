import { Focusable, type GamepadEvent } from "@decky/ui";
import type { ResourceState } from "@core/cache";
import type { GameDetailSnapshot, RecentlyPlayedGame } from "@core/domain";
import type { RetroAchievementsAchievementMode } from "@core/settings";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefCallback } from "react";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { loadDeckyGameDetailState, loadDeckySteamHuntersEnrichedGameDetail } from "./decky-app-services";
import type { CompactAchievementTarget } from "./decky-compact-achievement-model";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { DeckyOverviewMenuButton } from "./decky-full-screen-game-overview-content";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import {
  buildRetroAchievementsGoalSettingsMenuItem,
  type DeckyOverviewMenuItem,
} from "./decky-overview-menu-model";
import { achievementCompanionQamTheme as theme } from "./decky-qam-theme";
import { getRetroAchievementsModeGameProgress } from "./decky-retroachievements-mode-progress";
import { useDeckyVisualFocusState } from "./decky-visual-focus-state";
import {
  loadDeckyCompactGameState,
  readDeckyCompactGameState,
  writeDeckyCompactGameState,
} from "./decky-compact-session-resources";
import {
  buildDeckyCompactUpNextModel,
  selectDeckyCompactUpNextCandidates,
  shouldAdvanceDeckyCompactUpNextCandidate,
} from "./decky-compact-up-next-model";

const AUTOMATIC_RETRY_DELAY_MS = 1_800;

function unavailableState(cause?: unknown): ResourceState<GameDetailSnapshot> {
  return {
    status: "error",
    error: {
      kind: "unknown",
      userMessage: "Recommendations unavailable.",
      retryable: true,
      ...(cause === undefined ? {} : { cause }),
    },
    isStale: false,
    isRefreshing: false,
  };
}

export type DeckyCompactUpNextControl = "recommendation" | "achievements" | "options";

export interface DeckyCompactUpNextFocusTargetProps {
  readonly elementRef?: RefCallback<HTMLDivElement>;
  readonly onActivated: (element: HTMLElement) => void;
  readonly onFocused: (element: HTMLElement) => void;
  readonly preferredFocus: boolean;
}

export interface DeckyCompactUpNextCardProps {
  readonly providerId: string;
  readonly games: readonly RecentlyPlayedGame[];
  readonly activeGameId?: string;
  readonly achievementMode: RetroAchievementsAchievementMode;
  readonly onOpenAchievementDetail: (target: CompactAchievementTarget) => void;
  readonly onOpenAchievements: (game: RecentlyPlayedGame, achievementId?: string) => void;
  readonly onCancel: () => void;
  readonly getFocusTargetProps: (
    control: DeckyCompactUpNextControl,
    gameId: string,
  ) => DeckyCompactUpNextFocusTargetProps;
}

function renderable(state: ResourceState<GameDetailSnapshot>): state is ResourceState<GameDetailSnapshot> & { readonly data: GameDetailSnapshot } {
  return (state.status === "success" || state.status === "stale") && state.data !== undefined;
}

function percent(unlocked: number, total: number | undefined, fallback: number | undefined): number | undefined {
  if (fallback !== undefined && Number.isFinite(fallback)) return Math.max(0, Math.min(100, Math.round(fallback)));
  return total !== undefined && total > 0 ? Math.max(0, Math.min(100, Math.round(unlocked / total * 100))) : undefined;
}

function formatCount(unlocked: number, total: number | undefined): string {
  return total === undefined ? `${unlocked.toLocaleString()} unlocked` : `${unlocked.toLocaleString()} / ${total.toLocaleString()} achievements`;
}

function lineClamp(lines: number): CSSProperties {
  return { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" };
}

function Initials({ title }: { readonly title: string }): JSX.Element {
  const value = title.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AC";
  return <span aria-hidden="true" style={{ width: 46, height: 46, flex: "0 0 46px", display: "grid", placeItems: "center", borderRadius: theme.radius.small, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentStat, color: theme.color.accent, fontSize: 13, fontWeight: 800 }}>{value}</span>;
}

function SecondaryAction({ label, children, onActivate, onCancel, targetProps }: {
  readonly label: string;
  readonly children: ReactNode;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly targetProps: DeckyCompactUpNextFocusTargetProps;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  useDeckyVisualFocusState(ref, setFocused);
  const activate = (): void => {
    if (ref.current !== null) targetProps.onActivated(ref.current);
    onActivate();
  };
  return <Focusable noFocusRing role="button" tabIndex={0} aria-label={label} preferredFocus={targetProps.preferredFocus}
    ref={(node) => { ref.current = node; targetProps.elementRef?.(node); }} onActivate={activate} onClick={activate} onCancel={onCancel}
    onGamepadFocus={() => {
      setFocused(true);
      if (ref.current !== null) {
        scrollDeckyFocusTargetIntoView(ref.current);
        targetProps.onFocused(ref.current);
      }
    }} onGamepadBlur={() => setFocused(false)}
    style={{ minHeight: 38, minWidth: 0, padding: "0 12px", borderRadius: theme.radius.small, border: `1px solid ${focused ? theme.focus.compactBorder : theme.color.borderSubtle}`,
      background: focused ? theme.surface.focusedContentStat : theme.surface.contentStat, boxShadow: focused ? theme.focus.compactShadow : "none",
      color: theme.color.textPrimary, fontSize: 10, fontWeight: 750, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>{children}</Focusable>;
}

export function DeckyCompactUpNextCard({
  providerId, games, activeGameId, achievementMode,
  onOpenAchievementDetail, onOpenAchievements, onCancel, getFocusTargetProps,
}: DeckyCompactUpNextCardProps): JSX.Element | null {
  const candidates = useMemo(() => selectDeckyCompactUpNextCandidates({ providerId, games, ...(activeGameId !== undefined ? { activeGameId } : {}) }), [activeGameId, games, providerId]);
  const candidateSignature = candidates.map((game) => game.gameId).join("\u0000");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const currentGame = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))];
  const [state, setState] = useState<ResourceState<GameDetailSnapshot>>({ status: "idle", isStale: false, isRefreshing: false });
  const [loadedGameKey, setLoadedGameKey] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);
  const forceRefreshGameKeyRef = useRef<string>();
  const automaticallyRetriedGameKeysRef = useRef(new Set<string>());
  const recommendationRef = useRef<HTMLDivElement | null>(null);
  const [recommendationFocused, setRecommendationFocused] = useState(false);
  useDeckyVisualFocusState(recommendationRef, setRecommendationFocused);
  const preferences = useDeckyGameOverviewPreferences(providerId, currentGame?.gameId ?? "");

  useEffect(() => setCandidateIndex(0), [candidateSignature]);
  useEffect(() => {
    if (currentGame === undefined) return;
    let active = true;
    const gameKey = JSON.stringify([providerId, currentGame.gameId]);
    const cached = readDeckyCompactGameState(providerId, currentGame.gameId);
    const forceRefresh = forceRefreshGameKeyRef.current === gameKey;
    setLoadedGameKey(gameKey);
    if (!forceRefresh && cached !== undefined) {
      console.debug("[Achievement Companion][QAM Up Next] cache hit", { providerId, gameId: currentGame.gameId, resource: "recommendation-game-detail", cacheStatus: cached.status });
      setState(cached);
      return () => { active = false; };
    }
    setState(cached?.data !== undefined
      ? { ...cached, isRefreshing: true }
      : { status: "loading", isStale: false, isRefreshing: false });
    console.debug("[Achievement Companion][QAM Up Next] load", { providerId, gameId: currentGame.gameId, resource: "recommendation-game-detail", cacheStatus: cached?.status ?? "miss", retry: forceRefresh });
    void loadDeckyCompactGameState(
      providerId,
      currentGame.gameId,
      () => loadDeckyGameDetailState(providerId, currentGame.gameId, { forceRefresh }),
      forceRefresh,
    )
      .then((next) => {
        if (forceRefreshGameKeyRef.current === gameKey) forceRefreshGameKeyRef.current = undefined;
        console.debug("[Achievement Companion][QAM Up Next] load settled", { providerId, gameId: currentGame.gameId, resource: "recommendation-game-detail", status: next.status, failureKind: next.error?.kind });
        if (active) setState(next);
      })
      .catch((cause: unknown) => {
        if (forceRefreshGameKeyRef.current === gameKey) forceRefreshGameKeyRef.current = undefined;
        console.warn("[Achievement Companion][QAM Up Next] load failed", { providerId, gameId: currentGame.gameId, resource: "recommendation-game-detail", failureKind: "unknown" });
        if (active) setState(unavailableState(cause));
      });
    return () => { active = false; };
  }, [currentGame?.gameId, loadRevision, providerId]);

  const currentGameKey = currentGame === undefined ? "" : JSON.stringify([providerId, currentGame.gameId]);
  const effectiveState: ResourceState<GameDetailSnapshot> = loadedGameKey === currentGameKey
    ? state
    : { status: "loading", isStale: false, isRefreshing: false };
  const model = useMemo(() => !renderable(effectiveState) ? undefined : buildDeckyCompactUpNextModel({
    snapshot: effectiveState.data,
    hiddenAchievementIds: preferences.hiddenAchievementIds,
    goal: preferences.retroAchievementsGoal,
    achievementMode,
  }), [achievementMode, effectiveState, preferences.hiddenAchievementIds, preferences.retroAchievementsGoal]);
  const hasNextCandidate = candidateIndex + 1 < candidates.length;
  const shouldAdvance = shouldAdvanceDeckyCompactUpNextCandidate({
    providerId,
    ...(activeGameId !== undefined ? { activeGameId } : {}),
    ...(currentGame !== undefined ? { currentGameId: currentGame.gameId } : {}),
    ...(model?.outcome.kind !== undefined ? { outcomeKind: model.outcome.kind } : {}),
    hasFatalError: effectiveState.status === "error" && effectiveState.data === undefined,
    hasNextCandidate,
  });
  useEffect(() => {
    if (shouldAdvance) setCandidateIndex((index) => Math.min(index + 1, candidates.length - 1));
  }, [candidates.length, shouldAdvance]);

  const retryRecommendation = (): void => {
    if (currentGame === undefined) return;
    const gameKey = JSON.stringify([providerId, currentGame.gameId]);
    forceRefreshGameKeyRef.current = gameKey;
    console.debug("[Achievement Companion][QAM Up Next] retry requested", { providerId, gameId: currentGame.gameId, resource: "recommendation-game-detail" });
    setLoadRevision((revision) => revision + 1);
  };

  useEffect(() => {
    if (
      currentGame === undefined
      || shouldAdvance
      || effectiveState.status !== "error"
      || effectiveState.data !== undefined
      || effectiveState.error?.retryable === false
      || automaticallyRetriedGameKeysRef.current.has(currentGameKey)
    ) {
      return;
    }
    automaticallyRetriedGameKeysRef.current.add(currentGameKey);
    const ownerWindow = recommendationRef.current?.ownerDocument.defaultView ?? window;
    const timer = ownerWindow.setTimeout(retryRecommendation, AUTOMATIC_RETRY_DELAY_MS);
    return () => ownerWindow.clearTimeout(timer);
  }, [currentGame?.gameId, currentGameKey, effectiveState, providerId, shouldAdvance]);

  useEffect(() => {
    if (providerId !== "steam" || model?.outcome.kind !== "suggestion" || getSteamHuntersGameEnrichment(model.snapshot) !== undefined) return;
    let active = true;
    void loadDeckySteamHuntersEnrichedGameDetail(model.snapshot).then((snapshot) => {
      if (active && snapshot !== model.snapshot) setState((current) => {
        const next = { ...current, data: snapshot };
        writeDeckyCompactGameState(providerId, snapshot.game.gameId, next);
        return next;
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [model, providerId]);

  if (currentGame === undefined) return null;
  const displayedGame = model?.snapshot.game ?? currentGame;
  const progress = providerId === "retroachievements"
    ? getRetroAchievementsModeGameProgress(displayedGame, achievementMode) ?? displayedGame.summary
    : displayedGame.summary;
  const completionPercent = percent(progress.unlockedCount, progress.totalCount, progress.completionPercent);
  const isCurrentGame = activeGameId !== undefined && currentGame.gameId === activeGameId;
  const sectionTitle = providerId === "retroachievements" && isCurrentGame ? "CURRENT GAME" : "CONTINUE PLAYING";
  const suggestion = model?.outcome.kind === "suggestion" ? model.outcome.suggestion : undefined;
  const recommendationsUnavailable = effectiveState.status === "error" && effectiveState.data === undefined;
  const recommendationLabel = providerId === "retroachievements"
    ? `UP NEXT · ${preferences.retroAchievementsGoal.toUpperCase()}`
    : "UP NEXT";
  const recommendationTargetProps = getFocusTargetProps("recommendation", currentGame.gameId);
  const openAchievements = (): void => onOpenAchievements(currentGame, suggestion?.achievement.achievementId);
  const openDetails = (): void => {
    if (suggestion === undefined) return;
    onOpenAchievementDetail({ game: {
      providerId: displayedGame.providerId,
      gameId: displayedGame.gameId,
      title: displayedGame.title,
      ...(displayedGame.platformLabel !== undefined ? { platformLabel: displayedGame.platformLabel } : {}),
      ...(displayedGame.coverImageUrl !== undefined ? { coverImageUrl: displayedGame.coverImageUrl } : {}),
    }, achievement: suggestion.achievement });
  };
  const activateRecommendation = (): void => {
    if (recommendationRef.current !== null) recommendationTargetProps.onActivated(recommendationRef.current);
    if (recommendationsUnavailable) retryRecommendation();
    else if (model?.outcome.kind === "all-hidden") preferences.restoreAllSuggestions();
    else if (suggestion !== undefined) openDetails();
  };
  const skip = (): void => {
    if (suggestion !== undefined) preferences.hideSuggestion(suggestion.achievement.achievementId);
  };
  const menuItems: readonly DeckyOverviewMenuItem[] = [
    ...(providerId === "retroachievements" ? [buildRetroAchievementsGoalSettingsMenuItem({
      globalGoal: preferences.globalRetroAchievementsGoal,
      ...(preferences.retroAchievementsGoalOverride !== undefined
        ? { gameGoalOverride: preferences.retroAchievementsGoalOverride }
        : {}),
      onSetGlobalGoal: preferences.setGlobalRetroAchievementsGoal,
      onSetGameGoalOverride: preferences.setRetroAchievementsGameGoal,
    })] : []),
    { key: "manage", label: `Manage Suggestions (${model?.hiddenAchievements.length ?? 0} hidden)`, items: model?.hiddenAchievements.length
      ? model.hiddenAchievements.map((achievement) => ({ key: `restore:${achievement.achievementId}`, label: `Restore ${achievement.title}`, tone: "positive" as const, onSelect: () => preferences.restoreSuggestion(achievement.achievementId) }))
      : [{ key: "none", label: "No hidden suggestions" }] },
    { key: "restore-all", label: "Restore All Suggestions", tone: "positive", onSelect: () => preferences.restoreAllSuggestions() },
    ...(suggestion === undefined ? [] : [{ key: "skip", label: "Skip Current Suggestion", tone: "destructive" as const, onSelect: skip }]),
  ];
  const artworkUrl = displayedGame.coverImageUrl ?? displayedGame.boxArtImageUrl ?? displayedGame.systemIconUrl;
  const loading = effectiveState.status === "idle" || effectiveState.status === "loading" || shouldAdvance;
  const statusText = loading ? undefined : effectiveState.status === "error" && effectiveState.data === undefined
    ? "Recommendations unavailable"
    : model?.outcome.kind === "completed"
      ? providerId === "steam" ? "Perfected" : `${preferences.retroAchievementsGoal === "beat" ? "Beat" : "Master"} goal complete`
      : model?.outcome.kind === "all-hidden" ? "All suggestions hidden"
        : model?.outcome.kind === "empty" ? "No eligible recommendations right now." : undefined;

  return <section data-ac-compact-up-next={providerId} style={{ display: "flex", flexDirection: "column", gap: theme.compactProfileSpacing.content, minWidth: 0 }}>
    <div style={{ color: theme.color.accent, fontSize: theme.type.compact.heading, fontWeight: 850, letterSpacing: "0.055em", lineHeight: 1, textTransform: "uppercase" }}>{sectionTitle}</div>
    <div style={{ width: "100%", minWidth: 0, padding: 10, display: "flex", flexDirection: "column", gap: 8, boxSizing: "border-box", borderRadius: theme.radius.medium,
      border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentCard, color: theme.color.textPrimary }}>
      <div style={{ display: "grid", gridTemplateColumns: "46px minmax(0, 1fr)", alignItems: "center", gap: 9, minWidth: 0 }}>
        {artworkUrl !== undefined || displayedGame.appid !== undefined ? <DeckyGameArtwork compact size={46} title={displayedGame.title} {...(artworkUrl !== undefined ? { src: artworkUrl } : {})} {...(displayedGame.appid !== undefined ? { steamAppId: displayedGame.appid } : {})} /> : <Initials title={displayedGame.title} />}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <strong title={displayedGame.title} style={{ ...lineClamp(2), fontSize: 13, fontWeight: 800, lineHeight: 1.08 }}>{displayedGame.title}</strong>
          <span style={{ ...lineClamp(1), color: theme.color.textMuted, fontSize: 10, lineHeight: 1.15 }}>{displayedGame.platformLabel ?? (providerId === "steam" ? "Steam" : "RetroAchievements")}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0, color: theme.color.textSecondary, fontSize: 10, fontWeight: 700, lineHeight: 1.1 }}>
          <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{formatCount(progress.unlockedCount, progress.totalCount)}</span>
          {completionPercent !== undefined ? <span style={{ flexShrink: 0 }}>{completionPercent}%</span> : null}
        </div>
        {completionPercent !== undefined ? <div aria-label={`${completionPercent}% complete`} style={{ width: "100%", height: 4, overflow: "hidden", borderRadius: theme.radius.pill, background: theme.surface.progressTrack }}><span style={{ display: "block", width: `${completionPercent}%`, height: "100%", background: theme.surface.progressFill }} /></div> : null}
      </div>
      <Focusable noFocusRing role="button" tabIndex={0} aria-label={recommendationsUnavailable ? "Recommendations unavailable. Retry" : suggestion === undefined ? statusText ?? "Loading recommendation" : `${suggestion.achievement.title}. ${suggestion.achievement.description ?? ""}`}
        preferredFocus={recommendationTargetProps.preferredFocus} ref={(node) => { recommendationRef.current = node; recommendationTargetProps.elementRef?.(node); }}
        onActivate={activateRecommendation} onClick={activateRecommendation} onCancel={onCancel}
        {...(suggestion === undefined || !recommendationFocused ? {} : {
          onSecondaryActionDescription: "Skip",
          onOptionsActionDescription: "List",
          onSecondaryButton: (event: GamepadEvent) => { event.preventDefault(); event.stopPropagation(); if (!event.detail.is_repeat) skip(); },
          onOptionsButton: (event: GamepadEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (!event.detail.is_repeat) {
              if (recommendationRef.current !== null) recommendationTargetProps.onActivated(recommendationRef.current);
              openAchievements();
            }
          },
        })}
        onGamepadFocus={() => {
          setRecommendationFocused(true);
          if (recommendationRef.current !== null) {
            scrollDeckyFocusTargetIntoView(recommendationRef.current);
            recommendationTargetProps.onFocused(recommendationRef.current);
          }
        }} onGamepadBlur={() => setRecommendationFocused(false)}
        style={{ flex: "1 1 auto", minHeight: 66, minWidth: 0, padding: "8px 9px", boxSizing: "border-box", borderRadius: theme.radius.small,
          border: `1px solid ${recommendationFocused ? theme.focus.compactBorder : theme.color.borderSubtle}`, background: recommendationFocused ? theme.surface.focusedContentStat : theme.surface.contentStat,
          boxShadow: recommendationFocused ? theme.focus.compactShadow : "none", display: "grid", gridTemplateColumns: suggestion?.achievement.badgeImageUrl ? "48px minmax(0, 1fr)" : "minmax(0, 1fr)", alignItems: "center", gap: 9 }}>
        {suggestion?.achievement.badgeImageUrl ? <DeckyGameArtwork compact size={48} title={suggestion.achievement.title} src={suggestion.achievement.badgeImageUrl} /> : null}
        {loading ? <div aria-label="Loading Up Next" style={{ display: "flex", flexDirection: "column", gap: 7 }}><span style={{ width: 62, height: 7, borderRadius: theme.radius.pill, background: theme.surface.progressTrack }} /><span style={{ width: "72%", height: 12, borderRadius: 4, background: theme.surface.interactive }} /><span style={{ width: "92%", height: 9, borderRadius: 4, background: theme.surface.progressTrack }} /></div>
          : suggestion !== undefined ? <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}><span style={{ color: theme.color.accent, fontSize: 10, fontWeight: 800, letterSpacing: "0.055em" }}>{recommendationLabel}</span><strong title={suggestion.achievement.title} style={{ ...lineClamp(2), fontSize: 13, lineHeight: 1.08 }}>{suggestion.achievement.title}</strong>{suggestion.achievement.description ? <span title={suggestion.achievement.description} style={{ ...lineClamp(2), color: theme.color.textSecondary, fontSize: 10.5, lineHeight: 1.16 }}>{suggestion.achievement.description}</span> : null}</div>
            : <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, minWidth: 0 }}><strong style={{ fontSize: 12.5 }}>{statusText}</strong>{recommendationsUnavailable ? <span style={{ color: theme.color.accent, fontSize: 10, fontWeight: 800 }}>Retry</span> : model?.outcome.kind === "all-hidden" ? <span style={{ color: theme.color.textMuted, fontSize: 10 }}>A Restore Suggestions</span> : null}</div>}
      </Focusable>
      <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 48px", gap: 7, minWidth: 0 }}>
        <SecondaryAction label={`View achievements for ${currentGame.title}`} onActivate={openAchievements} onCancel={onCancel} targetProps={getFocusTargetProps("achievements", currentGame.gameId)}>Achievements</SecondaryAction>
        {(() => {
          const optionTargetProps = getFocusTargetProps("options", currentGame.gameId);
          return <DeckyOverviewMenuButton label="Options" displayLabel={<span aria-hidden="true" style={{ fontSize: 16, letterSpacing: 2 }}>•••</span>} items={menuItems} compact preserveCompactSession minHeight={38} onCancel={onCancel}
            preferredFocus={optionTargetProps.preferredFocus}
            {...(optionTargetProps.elementRef !== undefined ? { elementRef: optionTargetProps.elementRef } : {})}
            onActivated={optionTargetProps.onActivated}
            onFocused={optionTargetProps.onFocused} />;
        })()}
      </Focusable>
    </div>
  </section>;
}
