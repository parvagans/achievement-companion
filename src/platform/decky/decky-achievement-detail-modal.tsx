import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import type { GameDetailSnapshot } from "@core/domain";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { initialDeckyGameDetailState, loadDeckyGameDetailState, loadDeckySteamHuntersEnrichedGameDetail } from "./decky-app-services";
import { buildDeckyAchievementModalModel, type DeckyAchievementModalMetric } from "./decky-achievement-detail-modal-model";
import { getDeckyStandardModalContentStyle, getDeckyStandardModalTabStyle, openDeckyStandardModal } from "./decky-standard-modal";
import { applyAchievementCompanionTheme } from "./decky-theme-palette";
import { readDeckySettings } from "./decky-settings";
import { useDeckyGameOverviewPreferences } from "./decky-game-overview-preferences";
import { isAchievementCompleteForPin } from "./decky-game-overview-recommendations";
import { DeckyOverviewMenuButton } from "./decky-full-screen-game-overview-content";
import { achievementCompanionQamTheme as theme, getQamPassiveCardFocusStyle } from "./decky-qam-theme";
import { raRecipes, raTheme } from "./ra-theme";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { useAsyncResourceState } from "./useAsyncResourceState";
import calendarIconUrl from "./assets/calendar.svg";
import clockIconUrl from "./assets/clock.svg";
import usersIconUrl from "./assets/users.svg";
import pieChartIconUrl from "./assets/pie-chart.svg";
import { RA_COIN_ICON_URL } from "./decky-retroachievements-points-icon";
import { DeckySteamHuntersIcon } from "./decky-steam-icons";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";

const metricStyle: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 3, minWidth: 0,
  minHeight: 0, boxSizing: "border-box", padding: "7px 9px", border: `1px solid ${theme.color.borderSubtle}`,
  borderRadius: theme.radius.large, background: theme.surface.contentStat,
};

// The supplied two-row RA Community reference has a 242px content area at
// Steam's logical scale. Short content keeps that footprint; expanded identity
// text adds a bounded 70px without changing the metrics or tab geometry.
const ACHIEVEMENT_MODAL_CONTENT_HEIGHT_PX = 242;
const ACHIEVEMENT_MODAL_EXPANDED_CONTENT_HEIGHT_PX = 312;
const ACHIEVEMENT_MODAL_IDENTITY_HEIGHT_PX = 88;
const ACHIEVEMENT_MODAL_EXPANDED_IDENTITY_HEIGHT_PX = 158;

function getMetricSpan(count: number, index: number): number {
  if (count === 1) return 6;
  if (count === 2) return 3;
  if (count === 4 && index === 3) return 6;
  if (count === 5 && index >= 3) return 3;
  return 2;
}

function getMetricColor(tone: DeckyAchievementModalMetric["tone"]): string {
  if (tone === "positive") return theme.color.success;
  if (tone === "hardcore") return raTheme.color.hardcore;
  if (tone === "softcore") return raTheme.color.softcore;
  if (tone === "warning") return theme.color.warning;
  if (tone === "danger") return theme.color.danger;
  return theme.color.textSecondary;
}

function MetricIcon({ metric }: { readonly metric: DeckyAchievementModalMetric }): JSX.Element | null {
  if (metric.icon === undefined) return null;
  if (metric.icon === "points") return <img src={RA_COIN_ICON_URL} alt="" style={{ width: 14, height: 14 }} />;
  if (metric.icon === "steam-hunters") return <DeckySteamHuntersIcon size={14} color={theme.color.accent} />;
  const url = metric.icon === "date" ? calendarIconUrl : metric.icon === "time" ? clockIconUrl : metric.icon === "community" ? pieChartIconUrl : usersIconUrl;
  return <span aria-hidden="true" style={{ width: 14, height: 14, flexShrink: 0, background: metric.tone ? getMetricColor(metric.tone) : theme.color.accent,
    WebkitMask: `url("${url}") center / contain no-repeat`, mask: `url("${url}") center / contain no-repeat` }} />;
}

function CommunityProgress({ progress }: { readonly progress: NonNullable<DeckyAchievementModalMetric["progress"]> }): JSX.Element {
  return <div role="progressbar" aria-label="Community unlock rate" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}
    style={{ width: "100%", height: 4, flexShrink: 0, display: "flex", overflow: "hidden", borderRadius: theme.radius.pill, background: theme.surface.progressTrack }}>
    {progress.hardcorePercent !== undefined ? <>
      <span style={raRecipes.compactAchievementCommunity.segment("hardcore", progress.hardcorePercent)} />
      <span style={raRecipes.compactAchievementCommunity.segment("softcore", progress.percent - progress.hardcorePercent)} />
    </> : <div style={{ width: `${progress.percent}%`, background: theme.surface.progressFill }} />}
  </div>;
}

function AchievementModalContent({ providerId, gameId, achievementId, onViewGame }: {
  readonly providerId: string;
  readonly gameId: string;
  readonly achievementId: string;
  readonly onViewGame?: (() => void) | undefined;
}): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const preferences = useDeckyGameOverviewPreferences(providerId, gameId);
  const identityContentRef = useRef<HTMLDivElement>(null);
  const initialActionRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"your-unlock" | "community">("your-unlock");
  const [focusedTab, setFocusedTab] = useState<string>();
  const [identityFocused, setIdentityFocused] = useState(false);
  const [identityExpanded, setIdentityExpanded] = useState(false);
  const [identityHasOverflow, setIdentityHasOverflow] = useState(false);
  const [viewGameFocused, setViewGameFocused] = useState(false);
  const [enrichment, setEnrichment] = useState<{ source: GameDetailSnapshot; enriched: GameDetailSnapshot }>();
  const loader = useMemo(() => () => loadDeckyGameDetailState(providerId, gameId, { forceRefresh: false }), [providerId, gameId]);
  const state = useAsyncResourceState(loader, initialDeckyGameDetailState);
  const snapshot = (state.status === "success" || state.status === "stale") ? state.data : undefined;

  useEffect(() => {
    const ownerDocument = rootRef.current?.ownerDocument;
    if (ownerDocument !== undefined) applyAchievementCompanionTheme(ownerDocument, readDeckySettings().theme);
  }, []);

  useEffect(() => {
    if (snapshot === undefined || snapshot.game.providerId !== "steam" || getSteamHuntersGameEnrichment(snapshot) !== undefined) return;
    let cancelled = false;
    void loadDeckySteamHuntersEnrichedGameDetail(snapshot).then((enriched) => {
      if (!cancelled) setEnrichment({ source: snapshot, enriched });
    }).catch(() => {
      // SteamHunters is optional; keep the cached Steam details visible.
    });
    return () => { cancelled = true; };
  }, [snapshot]);

  const currentSnapshot = enrichment !== undefined && enrichment.source === snapshot ? enrichment.enriched : snapshot;
  const model = currentSnapshot === undefined ? undefined : buildDeckyAchievementModalModel(currentSnapshot, achievementId, readDeckySettings().retroAchievementsAchievementMode);
  const isPinned = preferences.pinnedAchievement?.achievementId === achievementId;
  const selectedAchievement = currentSnapshot?.achievements.find((achievement) => achievement.achievementId === achievementId);
  const canPin = preferences.canPin && selectedAchievement !== undefined && !isAchievementCompleteForPin(selectedAchievement, readDeckySettings().retroAchievementsAchievementMode);
  const pinItems = isPinned || canPin ? [{ key: "pin", label: isPinned ? "Remove from Up Next" : "Set as Up Next", onSelect: () => preferences.togglePinnedAchievement(achievementId, readDeckySettings().retroAchievementsAchievementMode) }] : [];
  const metrics = activeTab === "your-unlock" ? model?.yourUnlockMetrics : model?.communityMetrics;
  const tabs = [{ id: "your-unlock", label: "Your Unlock" }, { id: "community", label: "Community" }] as const;
  const boundedLine: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const showSteamCommunityHeading = model?.isSteamProvider && activeTab === "community" && (metrics?.length ?? 0) > 0;
  const denseSteamCommunity = showSteamCommunityHeading && (metrics?.length ?? 0) > 3;

  useLayoutEffect(() => {
    const content = identityContentRef.current;
    if (content === null || model === undefined) return;
    const ownerWindow = content.ownerDocument.defaultView;
    const updateOverflow = (): void => {
      setIdentityHasOverflow(content.scrollHeight > content.clientHeight + 1);
    };
    updateOverflow();
    const frame = ownerWindow?.requestAnimationFrame(updateOverflow);
    return () => {
      if (frame !== undefined) ownerWindow?.cancelAnimationFrame(frame);
    };
  }, [identityExpanded, model]);

  useLayoutEffect(() => {
    if (model === undefined) return;
    return requestDeckySteamGamepadFocusAfterMount(initialActionRef.current);
  }, [achievementId, model === undefined]);

  const handleIdentityScroll = (event: GamepadEvent): void => {
    if (!identityExpanded) return;
    const content = identityContentRef.current;
    if (content === null) return;
    const button = event.detail.button;
    const maxScrollTop = content.scrollHeight - content.clientHeight;
    const nextScrollTop = button === GamepadButton.DIR_DOWN && content.scrollTop < maxScrollTop - 1
      ? Math.min(maxScrollTop, content.scrollTop + 42)
      : button === GamepadButton.DIR_UP && content.scrollTop > 1
        ? Math.max(0, content.scrollTop - 42)
        : undefined;
    if (nextScrollTop === undefined) return;
    content.scrollTo({ top: nextScrollTop, behavior: "auto" });
    event.preventDefault();
    event.stopPropagation();
  };

  return <div ref={rootRef} data-achievement-companion-achievement-modal="true" style={{
    ...getDeckyStandardModalContentStyle(), color: theme.color.textPrimary,
    fontFamily: theme.type.fontFamily, fontSize: theme.type.fullscreen.body,
    display: "grid", gridTemplateRows: `${identityExpanded ? ACHIEVEMENT_MODAL_EXPANDED_IDENTITY_HEIGHT_PX : ACHIEVEMENT_MODAL_IDENTITY_HEIGHT_PX}px 32px minmax(0, 1fr)`, gap: 8, minWidth: 0, minHeight: 0,
    height: identityExpanded ? ACHIEVEMENT_MODAL_EXPANDED_CONTENT_HEIGHT_PX : ACHIEVEMENT_MODAL_CONTENT_HEIGHT_PX,
    maxHeight: "min(312px, calc(100vh - 128px))", boxSizing: "border-box",
  }}>
    {model === undefined ? <div role="status" style={{ gridRow: "1 / -1", display: "grid", placeItems: "center", padding: 20, color: theme.color.textSecondary }}>
      {snapshot === undefined && state.status !== "error" ? "Loading achievement details…" : state.error?.userMessage ?? "Achievement details are unavailable."}
    </div> : <>
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", alignItems: "center", gap: 12, minWidth: 0, minHeight: 0 }}>
        <div style={{ width: 72, height: 72, boxSizing: "border-box", borderRadius: 10, overflow: "hidden", background: theme.surface.contentStat, border: `1px solid ${theme.color.borderSubtle}` }}>
          {model.artworkUrl !== undefined ? <img src={model.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
        </div>
        <Focusable noFocusRing tabIndex={0} aria-label={`Achievement information for ${model.title}${identityHasOverflow ? ". Press A to expand or collapse the complete title and description." : ""}`}
          aria-expanded={identityHasOverflow || identityExpanded ? identityExpanded : undefined}
          onActivate={() => {
            if (identityHasOverflow || identityExpanded) setIdentityExpanded((expanded) => !expanded);
          }}
          onClick={() => {
            if (identityHasOverflow || identityExpanded) setIdentityExpanded((expanded) => !expanded);
          }}
          onGamepadDirection={handleIdentityScroll}
          onFocus={() => setIdentityFocused(true)} onGamepadFocus={() => setIdentityFocused(true)}
          onBlur={() => setIdentityFocused(false)} onGamepadBlur={() => setIdentityFocused(false)}
          style={{ ...getQamPassiveCardFocusStyle(identityFocused), position: "relative", height: "100%", minWidth: 0, minHeight: 0, overflow: "hidden", padding: "1px 3px", boxSizing: "border-box", borderRadius: theme.radius.small }}>
          <div ref={identityContentRef} style={{ display: "flex", flexDirection: "column", justifyContent: identityExpanded ? "flex-start" : "center", gap: 3, height: "100%", minHeight: 0, overflowY: identityExpanded ? "auto" : "hidden", overscrollBehavior: "contain", paddingRight: identityExpanded ? 5 : 0, paddingBottom: identityHasOverflow || identityExpanded ? 15 : 0, boxSizing: "border-box", scrollbarWidth: "thin" }}>
            <div title={model.gameTitle} style={{ color: theme.color.textSecondary, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, fontWeight: 700, ...boundedLine }}>{model.gameTitle}</div>
            <div title={model.title} style={{ fontSize: theme.type.fullscreen.title, fontWeight: 800, lineHeight: 1.12, overflowWrap: "anywhere" }}>{model.title}</div>
            <div title={model.description} style={{ color: theme.color.textSecondary, fontSize: theme.type.fullscreen.metadata, lineHeight: 1.25, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{model.description}</div>
            {model.metadata.length > 0 ? <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 2, color: theme.color.textMuted, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2 }}>
              {model.metadata.map((metric) => <span key={metric.label} style={{ overflowWrap: "anywhere" }}>{metric.label}: {metric.value}</span>)}
            </div> : null}
          </div>
          {identityHasOverflow || identityExpanded ? <span aria-hidden="true" style={{ position: "absolute", right: 5, bottom: 2, color: theme.color.textMuted, fontSize: theme.type.fullscreen.caption, fontWeight: 700, lineHeight: 1 }}>{identityExpanded ? "A  Collapse · ↑↓ Scroll" : "A  Expand details"}</span> : null}
        </Focusable>
      </div>
      <Focusable aria-label="Achievement details and actions" flow-children="left-right" noFocusRing style={{ display: "grid", gridTemplateColumns: `repeat(${(onViewGame === undefined ? 2 : 3) + (pinItems.length > 0 ? 1 : 0)}, minmax(0, 1fr))`, gap: 8, minWidth: 0, minHeight: 0 }}>
          {tabs.map((tab, index) => <Focusable key={tab.id} role="tab" aria-label={tab.label} aria-selected={activeTab === tab.id} preferredFocus={index === 0} noFocusRing tabIndex={0}
            ref={index === 0 ? initialActionRef : undefined}
            onActivate={() => setActiveTab(tab.id)} onClick={() => setActiveTab(tab.id)}
            onFocus={() => { setFocusedTab(tab.id); setActiveTab(tab.id); }}
            onGamepadFocus={() => { setFocusedTab(tab.id); setActiveTab(tab.id); }}
            onBlur={() => setFocusedTab((current) => current === tab.id ? undefined : current)}
            onGamepadBlur={() => setFocusedTab((current) => current === tab.id ? undefined : current)}
            style={{ ...getDeckyStandardModalTabStyle(), width: "100%", boxSizing: "border-box", height: "100%", minHeight: 0, background: focusedTab === tab.id ? theme.surface.focusedSelectedContentStat : activeTab === tab.id ? theme.surface.selectedContentStat : theme.surface.contentStat, borderColor: focusedTab === tab.id ? theme.focus.border : theme.color.borderSubtle, boxShadow: focusedTab === tab.id ? theme.focus.shadow : undefined }}>
            {tab.label}
          </Focusable>)}
        {onViewGame !== undefined ? <Focusable role="button" aria-label={`View ${model.gameTitle} compact game overview`} noFocusRing tabIndex={0}
          onActivate={onViewGame} onClick={onViewGame}
          onFocus={() => setViewGameFocused(true)} onGamepadFocus={() => setViewGameFocused(true)}
          onBlur={() => setViewGameFocused(false)} onGamepadBlur={() => setViewGameFocused(false)}
          style={{ ...getDeckyStandardModalTabStyle(), width: "100%", height: "100%", minHeight: 0, padding: "0 12px", boxSizing: "border-box", background: viewGameFocused ? theme.surface.focusedContentStat : theme.surface.contentStat, borderColor: viewGameFocused ? theme.focus.border : theme.color.borderSubtle, boxShadow: viewGameFocused ? theme.focus.shadow : undefined }}>
          View Game
        </Focusable> : null}
        {pinItems.length > 0 ? <DeckyOverviewMenuButton label="Up Next" items={pinItems} compact minHeight={32} preserveCompactSession /> : null}
      </Focusable>
      <div role="tabpanel" aria-label={activeTab === "your-unlock" ? "Your Unlock" : model.communityTitle} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, minHeight: 0 }}>
        {activeTab === "your-unlock" || showSteamCommunityHeading ? <div style={{ color: activeTab === "community" || model.isUnlocked ? theme.color.accent : theme.color.textMuted, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase" }}>{activeTab === "your-unlock" ? model.unlockHeading : model.communityTitle}</div> : null}
        <div style={{ display: "grid", flex: activeTab === "your-unlock" ? "0 0 auto" : 1, gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gridTemplateRows: (metrics?.length ?? 0) > 3 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 8, minWidth: 0, minHeight: 0 }}>
        {metrics?.length ? metrics.map((metric, index) => <div key={metric.label} style={{ ...metricStyle, padding: activeTab === "your-unlock" ? "8px 12px" : denseSteamCommunity ? "2px 9px" : "4px 9px", gap: denseSteamCommunity ? 2 : 3, gridColumn: `span ${getMetricSpan(metrics.length, index)}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: metric.tone === "warning" || metric.tone === "danger" ? getMetricColor(metric.tone) : theme.color.textMuted, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}><MetricIcon metric={metric} />{metric.label}</div>
          <div style={{ color: metric.valueTone === "points" ? raTheme.color.points : metric.valueTone === "retro-points" ? raTheme.color.retroPoints : metric.tone === "muted" ? theme.color.textSecondary : theme.color.textPrimary, fontSize: activeTab === "your-unlock" ? theme.type.fullscreen.title : theme.type.fullscreen.body, fontWeight: 800, overflowWrap: "anywhere", lineHeight: 1.15 }}>{metric.value}</div>
          {metric.progress !== undefined ? <CommunityProgress progress={metric.progress} /> : null}
        </div>) : <div style={{ ...metricStyle, gridColumn: "1 / -1", color: theme.color.textSecondary }}>{activeTab === "your-unlock" ? "No unlock date recorded." : "No community data available."}</div>}
        </div>
      </div>
    </>}
  </div>;
}

export function openDeckyAchievementDetailModal(args: {
  readonly providerId: string;
  readonly gameId: string;
  readonly achievementId: string;
  readonly onClose?: () => void;
  readonly compactContext?: {
    readonly onDismiss: () => void;
    readonly onViewGame: () => void;
  };
}): void {
  let viewGameRequested = false;
  openDeckyStandardModal({
    title: "Achievement Details",
    renderContent: (closeModal) => <AchievementModalContent providerId={args.providerId} gameId={args.gameId} achievementId={args.achievementId}
      {...(args.compactContext !== undefined ? { onViewGame: () => {
        if (viewGameRequested) return;
        viewGameRequested = true;
        closeModal();
        args.compactContext?.onViewGame();
      } } : {})} />,
    onClose: () => {
      args.onClose?.();
      if (!viewGameRequested) args.compactContext?.onDismiss();
    },
    viewportSafe: args.compactContext !== undefined,
    preserveCompactSession: args.compactContext !== undefined,
  });
}
