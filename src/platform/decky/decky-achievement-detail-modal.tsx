import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import type { GameDetailSnapshot } from "@core/domain";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { initialDeckyGameDetailState, loadDeckyGameDetailState, loadDeckySteamHuntersEnrichedGameDetail } from "./decky-app-services";
import { buildDeckyAchievementModalModel, type DeckyAchievementModalMetric } from "./decky-achievement-detail-modal-model";
import { getDeckyStandardModalContentStyle, getDeckyStandardModalTabStyle, openDeckyStandardModal } from "./decky-standard-modal";
import { applyAchievementCompanionTheme } from "./decky-theme-palette";
import { readDeckySettings } from "./decky-settings";
import { achievementCompanionQamTheme as theme, getQamPassiveCardFocusStyle } from "./decky-qam-theme";
import { raTheme } from "./ra-theme";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { useAsyncResourceState } from "./useAsyncResourceState";

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

/** Long descriptions stay readable inside the fixed identity area. */
function handleIdentityScroll(event: GamepadEvent): void {
  const direction = event.detail.button;
  if (direction !== GamepadButton.DIR_UP && direction !== GamepadButton.DIR_DOWN) return;
  const viewport = event.currentTarget as HTMLElement;
  const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const next = Math.max(0, Math.min(maximum, viewport.scrollTop + (direction === GamepadButton.DIR_UP ? -36 : 36)));
  if (Math.abs(next - viewport.scrollTop) < 1) return;
  viewport.scrollTop = next;
  event.preventDefault();
  event.stopPropagation();
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

  return <div ref={rootRef} data-achievement-companion-achievement-modal="true" style={{
    ...getDeckyStandardModalContentStyle(), color: theme.color.textPrimary,
    fontFamily: theme.type.fontFamily, fontSize: theme.type.fullscreen.body,
    display: "grid", gridTemplateRows: "72px 40px minmax(0, 1fr)", gap: 8, minWidth: 0, minHeight: 0,
    height: ACHIEVEMENT_MODAL_CONTENT_HEIGHT_PX, boxSizing: "border-box",
  }}>
    {model === undefined ? <div role="status" style={{ gridRow: "1 / -1", display: "grid", placeItems: "center", padding: 20, color: theme.color.textSecondary }}>
      {snapshot === undefined && state.status !== "error" ? "Loading achievement details…" : state.error?.userMessage ?? "Achievement details are unavailable."}
    </div> : <>
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", alignItems: "center", gap: 12, minWidth: 0, minHeight: 0 }}>
        <div style={{ width: 72, height: 72, boxSizing: "border-box", borderRadius: 10, overflow: "hidden", background: theme.surface.contentStat, border: `1px solid ${theme.color.borderSubtle}` }}>
          {model.artworkUrl !== undefined ? <img src={model.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
        </div>
        <Focusable noFocusRing tabIndex={0} aria-label="Achievement information" onGamepadDirection={handleIdentityScroll}
          onFocus={() => setIdentityFocused(true)} onGamepadFocus={() => setIdentityFocused(true)}
          onBlur={() => setIdentityFocused(false)} onGamepadBlur={() => setIdentityFocused(false)}
          style={{ ...getQamPassiveCardFocusStyle(identityFocused), height: "100%", minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", padding: "1px 3px", boxSizing: "border-box", borderRadius: theme.radius.small }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minHeight: "100%" }}>
            <div style={{ color: theme.color.textSecondary, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, fontWeight: 700 }}>{model.gameTitle}</div>
            <div style={{ fontSize: theme.type.fullscreen.title, fontWeight: 800, lineHeight: 1.12, overflowWrap: "anywhere" }}>{model.title}</div>
            <div style={{ color: theme.color.textSecondary, fontSize: theme.type.fullscreen.metadata, lineHeight: 1.25, overflowWrap: "anywhere" }}>{model.description}</div>
            {model.metadata.length > 0 ? <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12, rowGap: 2, color: theme.color.textMuted, fontSize: theme.type.fullscreen.caption, lineHeight: 1.2 }}>
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
      <div role="tabpanel" aria-label={activeTab === "your-unlock" ? "Your Unlock" : model.communityTitle} style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gridTemplateRows: (metrics?.length ?? 0) > 3 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 8, minWidth: 0, minHeight: 0 }}>
        {metrics?.length ? metrics.map((metric, index) => <div key={metric.label} style={{ ...metricStyle, gridColumn: `span ${getMetricSpan(metrics.length, index)}` }}>
          <div style={{ color: getMetricColor(metric.tone), fontSize: theme.type.fullscreen.caption, lineHeight: 1.2, fontWeight: 700 }}>{metric.label}</div>
          <div style={{ color: metric.tone === "muted" ? theme.color.textSecondary : theme.color.textPrimary, fontSize: activeTab === "your-unlock" ? theme.type.fullscreen.title : theme.type.fullscreen.body, fontWeight: 800, overflowWrap: "anywhere", lineHeight: 1.15 }}>{metric.value}</div>
        </div>) : <div style={{ ...metricStyle, gridColumn: "1 / -1", color: theme.color.textSecondary }}>{activeTab === "your-unlock" ? "No unlock date recorded." : "No community data available."}</div>}
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
