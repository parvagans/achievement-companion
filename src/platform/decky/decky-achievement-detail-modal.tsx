import { Focusable } from "@decky/ui";
import type { GameDetailSnapshot } from "@core/domain";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { initialDeckyGameDetailState, loadDeckyGameDetailState, loadDeckySteamHuntersEnrichedGameDetail } from "./decky-app-services";
import { buildDeckyAchievementModalModel, type DeckyAchievementModalMetric } from "./decky-achievement-detail-modal-model";
import { getDeckyStandardModalContentStyle, getDeckyStandardModalTabStyle, openDeckyStandardModal } from "./decky-standard-modal";
import { applyAchievementCompanionTheme } from "./decky-theme-palette";
import { readDeckySettings } from "./decky-settings";
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

const metricStyle: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 3, minWidth: 0,
  minHeight: 0, boxSizing: "border-box", padding: "7px 9px", border: `1px solid ${theme.color.borderSubtle}`,
  borderRadius: theme.radius.large, background: theme.surface.contentStat,
};

// The supplied two-row RA Community reference has a 242px content area at
// Steam's logical scale. Keep the native shell width and reserve this height
// for every tab, provider, loading state, and optional enrichment result.
const ACHIEVEMENT_MODAL_CONTENT_HEIGHT_PX = 242;

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

function AchievementModalContent({ providerId, gameId, achievementId }: {
  readonly providerId: string;
  readonly gameId: string;
  readonly achievementId: string;
}): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"your-unlock" | "community">("your-unlock");
  const [focusedTab, setFocusedTab] = useState<string>();
  const [identityFocused, setIdentityFocused] = useState(false);
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
  const metrics = activeTab === "your-unlock" ? model?.yourUnlockMetrics : model?.communityMetrics;
  const tabs = [{ id: "your-unlock", label: "Your Unlock" }, { id: "community", label: "Community" }] as const;
  const boundedLine: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const showSteamCommunityHeading = model?.isSteamProvider && activeTab === "community" && (metrics?.length ?? 0) > 0;
  const denseSteamCommunity = showSteamCommunityHeading && (metrics?.length ?? 0) > 3;

  return <div ref={rootRef} data-achievement-companion-achievement-modal="true" style={{
    ...getDeckyStandardModalContentStyle(), color: theme.color.textPrimary,
    fontFamily: theme.type.fontFamily, fontSize: theme.type.fullscreen.body,
    display: "grid", gridTemplateRows: "88px 32px minmax(0, 1fr)", gap: 8, minWidth: 0, minHeight: 0,
    height: ACHIEVEMENT_MODAL_CONTENT_HEIGHT_PX, boxSizing: "border-box",
  }}>
    {model === undefined ? <div role="status" style={{ gridRow: "1 / -1", display: "grid", placeItems: "center", padding: 20, color: theme.color.textSecondary }}>
      {snapshot === undefined && state.status !== "error" ? "Loading achievement details…" : state.error?.userMessage ?? "Achievement details are unavailable."}
    </div> : <>
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", alignItems: "center", gap: 12, minWidth: 0, minHeight: 0 }}>
        <div style={{ width: 72, height: 72, boxSizing: "border-box", borderRadius: 10, overflow: "hidden", background: theme.surface.contentStat, border: `1px solid ${theme.color.borderSubtle}` }}>
          {model.artworkUrl !== undefined ? <img src={model.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
        </div>
        <Focusable noFocusRing tabIndex={0} aria-label="Achievement information"
          onFocus={() => setIdentityFocused(true)} onGamepadFocus={() => setIdentityFocused(true)}
          onBlur={() => setIdentityFocused(false)} onGamepadBlur={() => setIdentityFocused(false)}
          style={{ ...getQamPassiveCardFocusStyle(identityFocused), height: "100%", minWidth: 0, minHeight: 0, overflow: "hidden", padding: "1px 3px", boxSizing: "border-box", borderRadius: theme.radius.small }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minHeight: "100%" }}>
            <div title={model.gameTitle} style={{ color: theme.color.textSecondary, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, fontWeight: 700, ...boundedLine }}>{model.gameTitle}</div>
            <div title={model.title} style={{ fontSize: theme.type.fullscreen.title, fontWeight: 800, lineHeight: 1.12, overflowWrap: "anywhere", ...boundedLine }}>{model.title}</div>
            <div title={model.description} style={{ color: theme.color.textSecondary, fontSize: theme.type.fullscreen.metadata, lineHeight: 1.25, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{model.description}</div>
            {model.metadata.length > 0 ? <div style={{ display: "flex", flexWrap: "nowrap", columnGap: 12, rowGap: 2, color: theme.color.textMuted, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, ...boundedLine }}>
              {model.metadata.map((metric) => <span key={metric.label} style={{ overflowWrap: "anywhere" }}>{metric.label}: {metric.value}</span>)}
            </div> : null}
          </div>
        </Focusable>
      </div>
      <Focusable role="tablist" aria-label="Achievement details" flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "flex", gap: 8, minHeight: 0 }}>
        {tabs.map((tab, index) => <Focusable key={tab.id} role="tab" aria-label={tab.label} aria-selected={activeTab === tab.id} preferredFocus={index === 0} noFocusRing tabIndex={0}
          onActivate={() => setActiveTab(tab.id)} onClick={() => setActiveTab(tab.id)}
          onFocus={() => { setFocusedTab(tab.id); setActiveTab(tab.id); }}
          onGamepadFocus={() => { setFocusedTab(tab.id); setActiveTab(tab.id); }}
          onBlur={() => setFocusedTab((current) => current === tab.id ? undefined : current)}
          onGamepadBlur={() => setFocusedTab((current) => current === tab.id ? undefined : current)}
          style={{ ...getDeckyStandardModalTabStyle(), boxSizing: "border-box", height: "100%", minHeight: 0, background: focusedTab === tab.id ? theme.surface.focusedSelectedContentStat : activeTab === tab.id ? theme.surface.selectedContentStat : theme.surface.contentStat, borderColor: focusedTab === tab.id ? theme.focus.border : theme.color.borderSubtle, boxShadow: focusedTab === tab.id ? theme.focus.shadow : undefined }}>
          {tab.label}
        </Focusable>)}
      </Focusable>
      <div role="tabpanel" aria-label={activeTab === "your-unlock" ? "Your Unlock" : model.communityTitle} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, minHeight: 0 }}>
        {activeTab === "your-unlock" || showSteamCommunityHeading ? <div style={{ color: activeTab === "community" || model.isUnlocked ? theme.color.accent : theme.color.textMuted, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase" }}>{activeTab === "your-unlock" ? model.unlockHeading : model.communityTitle}</div> : null}
        <div style={{ display: "grid", flex: 1, gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gridTemplateRows: (metrics?.length ?? 0) > 3 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 8, minWidth: 0, minHeight: 0 }}>
        {metrics?.length ? metrics.map((metric, index) => <div key={metric.label} style={{ ...metricStyle, padding: denseSteamCommunity ? "2px 9px" : "4px 9px", gap: denseSteamCommunity ? 2 : 3, gridColumn: `span ${getMetricSpan(metrics.length, index)}` }}>
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
}): void {
  openDeckyStandardModal({
    title: "Achievement Details",
    renderContent: () => <AchievementModalContent providerId={args.providerId} gameId={args.gameId} achievementId={args.achievementId} />,
    ...(args.onClose !== undefined ? { onClose: args.onClose } : {}),
  });
}
