import { readDeckyCompactNavigation, setDeckyCompactNavigation, subscribeDeckyCompactNavigation } from "./decky-compact-navigation";
import { requestDeckyCompactFocusRestore } from "./decky-compact-focus-restore";
import { DialogButton, Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import type { ResourceState } from "@core/cache";
import { useSavedPinnedAchievements, unpinAchievement, type SavedPinnedAchievement } from "./decky-game-overview-preferences";
import { createPinnedMetadataResolver, pinnedGamesNearViewport } from "./decky-pinned-achievements-model";
import { readDeckyCompactGameState, readDeckyCompactRecommendationGameState, loadDeckyCompactGameState, loadDeckyCompactRecommendationGameState } from "./decky-compact-session-resources";
import { readDeckySteamGameDetailState } from "./decky-steam-game-detail-cache";
import { loadDeckyGameDetailState } from "./decky-app-services";
import { getDeckyAccountRevision } from "./decky-account-revision";
import { readDeckyProviderConfigs } from "./providers/provider-config-store";
import { subscribeDeckyGameDetailPublication } from "./decky-game-detail-publication";
import { openDeckyStandardModal, getDeckyStandardModalContentStyle, getDeckyStandardModalTabStyle } from "./decky-standard-modal";
import { openDeckyAchievementDetailModal } from "./decky-achievement-detail-modal";
import { buildDeckyAchievementModalModel, type DeckyAchievementModalMetric, type DeckyAchievementModalModel } from "./decky-achievement-detail-modal-model";
import { DeckyAchievementArtwork } from "./decky-achievement-artwork";
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { applyAchievementCompanionTheme } from "./decky-theme-palette";
import { readDeckySettings } from "./decky-settings";
import { DeckyPinnedAchievementCard, pinnedCompletionModeLabel } from "./decky-pinned-achievement-card";
import { achievementCompanionQamTheme as theme, getQamCompactFocusControlStyle } from "./decky-qam-theme";
import { useDeckyVisualFocusState } from "./decky-visual-focus-state";

const resolveMetadata = createPinnedMetadataResolver({
  read: (pin) => readDeckyCompactGameState(pin.providerId, pin.gameId)
    ?? (pin.providerId === "steam" ? readDeckySteamGameDetailState(pin.gameId) : readDeckyCompactRecommendationGameState(pin.gameId)),
  load: (pin) => {
    const loader = () => loadDeckyGameDetailState(pin.providerId, pin.gameId, { forceRefresh: false, recommendationOnly: true, entryPoint: "pinned-achievements" });
    return pin.providerId === "retroachievements" ? loadDeckyCompactRecommendationGameState(pin.gameId, loader) : loadDeckyCompactGameState(pin.providerId, pin.gameId, loader);
  },
});
function currentAccount(pin: SavedPinnedAchievement): boolean {
  const config = readDeckyProviderConfigs();
  return pin.accountId === (pin.providerId === "steam" ? config.steam?.steamId64 : config.retroAchievements?.username.toLowerCase());
}

interface OpenArgs {
  readonly providerId: string;
  readonly onClose: () => void;
  readonly focusGameId?: string;
}

interface ModalActionProps {
  label: string; activate: () => void; onFocused?: () => void; elementRef?: (node: HTMLDivElement | null) => void; preferredFocus?: boolean;
}

function ModalAction({ label, activate, onFocused, elementRef, preferredFocus = false }: ModalActionProps): JSX.Element {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useDeckyVisualFocusState(ref, setFocused);
  return <Focusable ref={(node) => { ref.current = node; elementRef?.(node); }} noFocusRing role="button" tabIndex={0} preferredFocus={preferredFocus} onOKActionDescription={label} onActivate={activate} onClick={activate}
    onGamepadFocus={() => { setFocused(true); onFocused?.(); }} onGamepadBlur={() => setFocused(false)}
    style={{ minHeight: 38, padding: "0 10px", border: `1px solid ${theme.color.borderSubtle}`, borderRadius: theme.radius.small, background: theme.surface.contentStat, color: theme.color.textPrimary, fontSize: theme.type.fullscreen.metadata, display: "grid", placeItems: "center", ...(focused ? getQamCompactFocusControlStyle() : {}) }}>{label}</Focusable>;
}

function NativeModalAction({ label, activate, elementRef, onFocused }: ModalActionProps): JSX.Element {
  return <DialogButton ref={elementRef} onClick={activate} onGamepadFocus={() => onFocused?.()} onOKActionDescription={label}
    style={{ flex: "0 0 auto", width: "auto", minWidth: 0, minHeight: 36, padding: "0 12px", whiteSpace: "nowrap" }}>{label}</DialogButton>;
}

const nativeTabStyle: CSSProperties = {
  flex: "1 1 0", minHeight: 38, display: "grid", placeItems: "center", padding: "0 8px", textAlign: "center",
};

export function PinnedAchievementsContent({ initialProvider, focusGameId, focusCloseButton, onDetails, native = false }: {
  initialProvider: string; focusGameId?: string; focusCloseButton: () => boolean;
  onDetails: (pin: SavedPinnedAchievement, snapshot: GameDetailSnapshot) => void;
  native?: boolean;
}): JSX.Element {
  const { pins, accounts } = useSavedPinnedAchievements();
  const providers = Object.keys(accounts).filter((id) => accounts[id as keyof typeof accounts] !== undefined);
  const [chosen, setChosen] = useState(initialProvider);
  const active = providers.includes(chosen) ? chosen : providers[0];
  const visible = pins.filter((pin) => pin.providerId === active);
  const signature = JSON.stringify(visible);
  const accountSignature = JSON.stringify(accounts);
  const [metadata, setMetadata] = useState<Record<string, ResourceState<GameDetailSnapshot>>>({});
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const controls = useRef(new Map<string, HTMLDivElement>());
  const pendingFocus = useRef<string | undefined>(focusGameId);
  const [focusedTab, setFocusedTab] = useState<string>();
  const [visibleGames, setVisibleGames] = useState<readonly string[]>([]);
  const hydrationSignature = JSON.stringify(visibleGames);
  const key = (pin: SavedPinnedAchievement): string => JSON.stringify([pin.providerId, pin.accountId, pin.gameId]);
  const measureVisible = (): void => {
    const view = viewport.current;
    if (!view) return;
    const ids = pinnedGamesNearViewport([...view.querySelectorAll<HTMLElement>("[data-ac-pin-game]")].map((node) => {
      const bounds = node.getBoundingClientRect();
      return { gameId: node.dataset["acPinGame"]!, top: bounds.top, bottom: bounds.bottom };
    }), view.getBoundingClientRect());
    setVisibleGames((previous) => JSON.stringify(previous) === JSON.stringify(ids) ? previous : ids);
  };
  useLayoutEffect(() => {
    const view = viewport.current;
    const focused = view?.querySelector<HTMLElement>(".gpfocus");
    if (view && focused) {
      const bounds = view.getBoundingClientRect(), target = focused.getBoundingClientRect();
      if (target.top < bounds.top) view.scrollTop += target.top - bounds.top;
      else if (target.bottom > bounds.bottom) view.scrollTop += target.bottom - bounds.bottom;
    }
    measureVisible();
  }, [active, signature, metadata]);
  useEffect(() => {
    const doc = root.current?.ownerDocument;
    if (doc && !native) applyAchievementCompanionTheme(doc, readDeckySettings().theme);
  }, [native]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const pin of visible.filter((item) => visibleGames.includes(item.gameId))) {
        if (metadataRef.current[key(pin)] !== undefined) continue;
        const revision = getDeckyAccountRevision(pin.providerId);
        const valid = () => !cancelled && currentAccount(pin) && revision === getDeckyAccountRevision(pin.providerId);
        try {
          const state = await resolveMetadata(pin, valid);
          if (!valid()) return;
          if (state) setMetadata((old) => ({ ...old, [key(pin)]: state }));
          if (state?.error?.kind === "rate_limit") {
            setMetadata((old) => Object.fromEntries([...Object.entries(old), ...visible.filter((item) => old[key(item)] === undefined).map((item) => [key(item), state])]));
            break;
          }
        } catch {
          if (valid()) setMetadata((old) => ({ ...old, [key(pin)]: { status: "error", isStale: false, isRefreshing: false } }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [signature, accountSignature, hydrationSignature]);
  useEffect(() => subscribeDeckyGameDetailPublication((snapshot) => {
    const pin = pins.find((item) => item.providerId === snapshot.game.providerId && item.gameId === snapshot.game.gameId && currentAccount(item));
    if (pin) setMetadata((old) => ({ ...old, [key(pin)]: { status: "success", data: snapshot, isStale: false, isRefreshing: false } }));
  }), [JSON.stringify(pins)]);
  useLayoutEffect(() => {
    const target = (pendingFocus.current ? controls.current.get(`entry:${pendingFocus.current}`) : undefined)
      ?? (providers.length > 1 ? controls.current.get(`tab:${active}`) : undefined)
      ?? controls.current.get(`entry:${visible[0]?.gameId}`);
    pendingFocus.current = undefined;
    if (target) return requestDeckySteamGamepadFocusAfterMount(target);
    focusCloseButton();
  }, [active, signature]);
  const move = (event: GamepadEvent, node: HTMLElement | undefined): void => {
    if (node && takeDeckySteamGamepadFocus(node)) { event.preventDefault(); event.stopPropagation(); }
  };
  const Action = native ? NativeModalAction : ModalAction;
  return <div ref={root} data-ac-pinned-modal data-ac-native-pinned-modal={native || undefined} style={{ ...getDeckyStandardModalContentStyle(), ...(!native ? { fontFamily: theme.type.fontFamily, fontSize: theme.type.fullscreen.body, color: theme.color.textPrimary } : {}) }}>
    {!native ? <style>{`[data-ac-pinned-modal]:not([data-ac-native-pinned-modal]) [data-ac-pinned-list]::-webkit-scrollbar { width:8px; } [data-ac-pinned-modal]:not([data-ac-native-pinned-modal]) [data-ac-pinned-list]::-webkit-scrollbar-track { background:${theme.surface.progressTrack}; } [data-ac-pinned-modal]:not([data-ac-native-pinned-modal]) [data-ac-pinned-list]::-webkit-scrollbar-thumb { background:${theme.color.accent}; border-radius:${theme.radius.pill}px; }`}</style> : null}
    {providers.length > 1 ? <Focusable role="tablist" flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {providers.map((id, index) => <Focusable key={id} role="tab" aria-selected={active === id} noFocusRing={!native} tabIndex={0} preferredFocus={id === active}
        ref={(node) => { if (node) controls.current.set(`tab:${id}`, node); }}
        onActivate={() => setChosen(id)} onClick={() => setChosen(id)} onGamepadFocus={() => { setFocusedTab(id); setChosen(id); }} onGamepadBlur={() => setFocusedTab(undefined)}
        onGamepadDirection={(event) => {
          if (event.detail.button === GamepadButton.DIR_LEFT) move(event, controls.current.get(`tab:${providers[index - 1]}`));
          if (event.detail.button === GamepadButton.DIR_RIGHT) move(event, controls.current.get(`tab:${providers[index + 1]}`));
          if (event.detail.button === GamepadButton.DIR_DOWN) {
            if (visible.length) move(event, controls.current.get(`entry:${visible[0]?.gameId}`));
            else if (focusCloseButton()) { event.preventDefault(); event.stopPropagation(); }
          }
        }}
        style={native ? { ...nativeTabStyle, background: active === id ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.06)", borderBottom: `2px solid ${active === id ? "currentColor" : "transparent"}` }
          : { ...getDeckyStandardModalTabStyle(), whiteSpace: "nowrap", background: active === id ? theme.surface.selectedContentStat : theme.surface.contentStat, ...(focusedTab === id ? getQamCompactFocusControlStyle() : {}) }}>{id === "steam" ? "Steam" : "RetroAchievements"} ({pins.filter((pin) => pin.providerId === id).length})</Focusable>)}
    </Focusable> : null}
    <div ref={viewport} data-ac-pinned-list role="tabpanel" onScroll={measureVisible} style={{ height: 220, maxHeight: native ? "calc(100vh - 164px)" : undefined, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", scrollbarGutter: "stable" }}>
      {visible.length === 0 ? <div style={{ padding: 12, lineHeight: 1.4 }}><strong>No pinned achievements yet.</strong><p>Pin achievements from Up Next, Achievement Details, or supported game views.</p></div> : visible.map((pin, index) => {
        const state = metadata[key(pin)];
        const snapshot = state?.data;
        const achievement = snapshot?.achievements.find((item) => item.achievementId === pin.achievementId);
        const scroll = (): void => { const node = controls.current.get(`entry:${pin.gameId}`); if (node && viewport.current) {
          const view = viewport.current.getBoundingClientRect(), article = node.closest("article")!.getBoundingClientRect();
          const box = article.height <= view.height ? article : node.getBoundingClientRect();
          if (box.top < view.top) viewport.current.scrollTop += box.top - view.top;
          else if (box.bottom > view.bottom) viewport.current.scrollTop += box.bottom - view.bottom;
        } };
        return <DeckyPinnedAchievementCard key={key(pin)} pin={pin} snapshot={snapshot} loading={state === undefined} native={native} actions={
          <Focusable flow-children="left-right" noFocusRing tabIndex={-1} onGamepadDirection={(event) => {
            if (event.detail.button === GamepadButton.DIR_UP) move(event, controls.current.get(index ? `entry:${visible[index - 1]?.gameId}` : `tab:${active}`));
            if (event.detail.button === GamepadButton.DIR_DOWN) {
              if (index + 1 < visible.length) move(event, controls.current.get(`entry:${visible[index + 1]?.gameId}`));
              else if (focusCloseButton()) { event.preventDefault(); event.stopPropagation(); }
            }
          }} style={{ display: "flex", gap: 8 }}>
            {achievement && snapshot ? <>
              <Action label="Details" activate={() => onDetails(pin, snapshot)} elementRef={(node) => { if (node) controls.current.set(`entry:${pin.gameId}`, node); }} onFocused={scroll} />
            </> : null}
            <Action label="Unpin" activate={() => { if (!currentAccount(pin)) return; pendingFocus.current = visible[index + 1]?.gameId ?? visible[index - 1]?.gameId; unpinAchievement(pin, pin.achievementId); }}
              {...(!achievement ? { elementRef: (node: HTMLDivElement | null) => { if (node) controls.current.set(`entry:${pin.gameId}`, node); } } : {})} onFocused={scroll} />
          </Focusable>
        } />;
      })}
    </div>
  </div>;
}

const nativeDetailsHeadingStyle: CSSProperties = {
  margin: 0, fontSize: ".78em", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", opacity: .8,
};
const nativeDetailsPanelStyle: CSSProperties = {
  minWidth: 0, padding: "10px 12px", borderRadius: 4, background: "rgba(255, 255, 255, .05)",
};

function NativeDetailPanel({ title, source, metrics }: {
  readonly title: string;
  readonly source?: string;
  readonly metrics: readonly DeckyAchievementModalMetric[];
}): JSX.Element {
  return <section style={nativeDetailsPanelStyle}>
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "2px 8px", marginBottom: 8, lineHeight: 1.25 }}>
      <h3 style={nativeDetailsHeadingStyle}>{title}</h3>
      {source ? <span style={{ fontSize: ".78em", opacity: .75 }}>{source}</span> : null}
    </div>
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 108px), 1fr))", gap: "10px 12px", margin: 0, lineHeight: 1.25 }}>
      {metrics.map(({ label, value }) => <div key={label} style={{ minWidth: 0 }}>
        <dt style={{ fontSize: ".8em", opacity: .75 }}>{label}</dt>
        <dd style={{ margin: "2px 0 0", fontWeight: 600 }}>{value}</dd>
      </div>)}
    </dl>
  </section>;
}

function NativePinnedAchievementDetails({ model, completionMode }: {
  readonly model: DeckyAchievementModalModel;
  readonly completionMode: SavedPinnedAchievement["completionMode"];
}): JSX.Element {
  const achievementMetrics = [...model.metadata, ...model.communityMetrics.filter(({ valueTone }) => valueTone !== undefined)];
  const communityMetrics = model.communityMetrics.filter(({ valueTone }) => valueTone === undefined).map((metric) => {
    if (metric.label === "Community") return { ...metric, label: model.isSteamProvider ? "Qualified unlock rate" : "Unlock rate" };
    if (metric.label === "Steam global") return { ...metric, label: "Steam global unlock rate" };
    return metric;
  });

  return <div data-ac-native-pinned-details style={{ ...getDeckyStandardModalContentStyle(), maxHeight: "calc(100vh - 164px)", overflowY: "auto", overflowWrap: "anywhere" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {model.artworkUrl ? <DeckyAchievementArtwork src={model.artworkUrl} size={56} /> : null}
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: "1.15em", lineHeight: 1.2 }}>{model.title}</h2>
        <div style={{ marginTop: 3, opacity: .75, fontSize: ".9em" }}>
          {model.isSteamProvider ? model.gameTitle : `${model.gameTitle} · ${pinnedCompletionModeLabel(completionMode)}`}
        </div>
      </div>
    </header>
    <p style={{ margin: "12px 0", whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{model.description}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
      {achievementMetrics.length > 0 ? <NativeDetailPanel title="Achievement" metrics={achievementMetrics} /> : null}
      {communityMetrics.length > 0 ? <NativeDetailPanel title="Community" source={model.communityTitle} metrics={communityMetrics} /> : null}
    </div>
  </div>;
}

export function openDeckyNativePinnedAchievementsModal(args: OpenArgs): void {
  let handoff = false;
  openDeckyStandardModal({ title: "Pinned Achievements", viewportSafe: true, stabilizeCloseFocus: true,
    renderContent: (closeModal, focusCloseButton) => <PinnedAchievementsContent native initialProvider={args.providerId}
      {...(args.focusGameId ? { focusGameId: args.focusGameId } : {})} focusCloseButton={focusCloseButton}
      onDetails={(pin, snapshot) => {
        if (handoff || !currentAccount(pin)) return;
        const model = buildDeckyAchievementModalModel(snapshot, pin.achievementId, pin.completionMode);
        if (model === undefined) return;
        handoff = true;
        closeModal();
        try {
          openDeckyStandardModal({ title: "Achievement Details", viewportSafe: true,
            renderContent: () => <NativePinnedAchievementDetails model={model} completionMode={pin.completionMode} />,
            onClose: () => {
              if (currentAccount(pin)) openDeckyNativePinnedAchievementsModal({ ...args, providerId: pin.providerId, focusGameId: pin.gameId });
              else args.onClose();
            },
          });
        } catch (error) { args.onClose(); throw error; }
      }} />,
    onClose: () => { if (!handoff) args.onClose(); },
  });
}

export function openDeckyPinnedAchievementsModal(args: OpenArgs): void {
  let handoff = false;
  const openGame = (pin: SavedPinnedAchievement, snapshot: GameDetailSnapshot): void => {
    const origin = readDeckyCompactNavigation();
    const unsubscribe = subscribeDeckyCompactNavigation(() => {
      const destination = readDeckyCompactNavigation();
      if (destination.kind === "provider-dashboard") {
        unsubscribe();
        if (origin.kind === "provider-dashboard" && origin.providerId !== destination.providerId) setDeckyCompactNavigation(origin);
        if (currentAccount(pin)) openDeckyPinnedAchievementsModal({ ...args, providerId: pin.providerId, focusGameId: pin.gameId });
        else { requestDeckyCompactFocusRestore(); args.onClose(); }
      } else if (!["game", "achievement-list", "achievement"].includes(destination.kind)
        || !("gameId" in destination) || destination.gameId !== pin.gameId || destination.providerId !== pin.providerId) {
        // Closing QAM or leaving this game's branch cancels the one-shot return.
        unsubscribe();
      }
    });
    try { setDeckyCompactNavigation({ kind: "game", providerId: pin.providerId, gameId: pin.gameId, gameTitle: snapshot.game.title }); }
    catch (error) { unsubscribe(); throw error; }
  };
  openDeckyStandardModal({ title: "Pinned Achievements", stabilizeCloseFocus: true, viewportSafe: true, preserveCompactSession: true,
    renderContent: (closeModal, focusCloseButton) => <PinnedAchievementsContent initialProvider={args.providerId} {...(args.focusGameId ? { focusGameId: args.focusGameId } : {})} focusCloseButton={focusCloseButton}
      onDetails={(pin, snapshot) => {
        if (!currentAccount(pin)) return;
        handoff = true;
        const release = beginDeckyCompactPopup();
        closeModal();
        try { openDeckyAchievementDetailModal({ providerId: pin.providerId, gameId: pin.gameId, achievementId: pin.achievementId,
          compactContext: { onDismiss: () => { try { openDeckyPinnedAchievementsModal({ ...args, providerId: pin.providerId, focusGameId: pin.gameId }); } finally { release(); } },
            onViewGame: () => { try { openGame(pin, snapshot); } finally { release(); } } },
        }); } catch (error) { release(); args.onClose(); throw error; }
      }} />,
    onClose: () => { if (!handoff) { requestDeckyCompactFocusRestore(); args.onClose(); } },
  });
}
