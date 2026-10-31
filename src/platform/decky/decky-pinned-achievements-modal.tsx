import { readDeckyCompactNavigation, setDeckyCompactNavigation, subscribeDeckyCompactNavigation } from "./decky-compact-navigation";
import { requestDeckyCompactFocusRestore } from "./decky-compact-focus-restore";
import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { beginDeckyCompactPopup } from "./decky-compact-popup-state";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { applyAchievementCompanionTheme } from "./decky-theme-palette";
import { readDeckySettings } from "./decky-settings";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { DeckyAchievementArtwork } from "./decky-achievement-artwork";
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

function ModalAction({ label, activate, onFocused, elementRef, preferredFocus = false }: {
  label: string; activate: () => void; onFocused?: () => void; elementRef?: (node: HTMLDivElement | null) => void; preferredFocus?: boolean;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useDeckyVisualFocusState(ref, setFocused);
  return <Focusable ref={(node) => { ref.current = node; elementRef?.(node); }} noFocusRing role="button" tabIndex={0} preferredFocus={preferredFocus} onOKActionDescription={label} onActivate={activate} onClick={activate}
    onGamepadFocus={() => { setFocused(true); onFocused?.(); }} onGamepadBlur={() => setFocused(false)}
    style={{ minHeight: 38, padding: "0 10px", border: `1px solid ${theme.color.borderSubtle}`, borderRadius: theme.radius.small, background: theme.surface.contentStat, color: theme.color.textPrimary, fontSize: theme.type.fullscreen.metadata, display: "grid", placeItems: "center", ...(focused ? getQamCompactFocusControlStyle() : {}) }}>{label}</Focusable>;
}

export function PinnedAchievementsContent({ initialProvider, focusGameId, focusCloseButton, onDetails }: {
  initialProvider: string; focusGameId?: string; focusCloseButton: () => boolean;
  onDetails: (pin: SavedPinnedAchievement, snapshot: GameDetailSnapshot) => void;
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
    if (doc) applyAchievementCompanionTheme(doc, readDeckySettings().theme);
  }, []);
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
  return <div ref={root} data-ac-pinned-modal style={{ ...getDeckyStandardModalContentStyle(), fontFamily: theme.type.fontFamily, fontSize: theme.type.fullscreen.body, color: theme.color.textPrimary }}>
    <style>{`[data-ac-pinned-modal] [data-ac-pinned-list]::-webkit-scrollbar { width:8px; } [data-ac-pinned-modal] [data-ac-pinned-list]::-webkit-scrollbar-track { background:${theme.surface.progressTrack}; } [data-ac-pinned-modal] [data-ac-pinned-list]::-webkit-scrollbar-thumb { background:${theme.color.accent}; border-radius:${theme.radius.pill}px; }`}</style>
    {providers.length > 1 ? <Focusable role="tablist" flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {providers.map((id, index) => <Focusable key={id} role="tab" aria-selected={active === id} noFocusRing tabIndex={0} preferredFocus={id === active}
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
        style={{ ...getDeckyStandardModalTabStyle(), whiteSpace: "nowrap", background: active === id ? theme.surface.selectedContentStat : theme.surface.contentStat, ...(focusedTab === id ? getQamCompactFocusControlStyle() : {}) }}>{id === "steam" ? "Steam" : "RetroAchievements"} ({pins.filter((pin) => pin.providerId === id).length})</Focusable>)}
    </Focusable> : null}
    <div ref={viewport} data-ac-pinned-list role="tabpanel" onScroll={measureVisible} style={{ height: 220, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", scrollbarGutter: "stable" }}>
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
        return <article key={key(pin)} data-ac-pin-game={pin.gameId} style={{ padding: 10, marginBottom: 8, border: `1px solid ${theme.color.borderSubtle}`, borderRadius: theme.radius.medium, background: theme.surface.contentCard, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minWidth: 0 }}>
            {snapshot ? <DeckyGameArtwork compact size={32} title={snapshot.game.title} {...(snapshot.game.coverImageUrl ? { src: snapshot.game.coverImageUrl } : {})} /> : null}
            <strong style={{ fontSize: 14, minWidth: 0, overflowWrap: "anywhere" }}>{snapshot?.game.title ?? `Game #${pin.gameId}`}</strong>
            {pin.providerId === "retroachievements" ? <span style={{ fontSize: 11, color: theme.color.textSecondary }}>{snapshot?.game.platformLabel} · {pin.completionMode === "both" ? "Any mode" : pin.completionMode}</span> : null}
          </div>
          {achievement ? <div style={{ display: "grid", gridTemplateColumns: achievement.badgeImageUrl ? "40px minmax(0,1fr)" : "minmax(0,1fr)", gap: 8, marginBottom: 8 }}>
            {achievement.badgeImageUrl ? <DeckyAchievementArtwork size={40} src={achievement.badgeImageUrl} /> : null}
            <div><strong style={{ fontSize: 14 }}>{achievement.title}</strong>{achievement.description ? <div style={{ fontSize: 12, lineHeight: 1.3, color: theme.color.textSecondary, overflowWrap: "anywhere" }}>{achievement.description}</div> : null}</div>
          </div> : <p role="status" style={{ fontSize: 12 }}>{state === undefined ? "Loading pinned achievement…" : "Pinned achievement information is unavailable. Your pin is saved."}</p>}
          <Focusable flow-children="left-right" noFocusRing tabIndex={-1} onGamepadDirection={(event) => {
            if (event.detail.button === GamepadButton.DIR_UP) move(event, controls.current.get(index ? `entry:${visible[index - 1]?.gameId}` : `tab:${active}`));
            if (event.detail.button === GamepadButton.DIR_DOWN) {
              if (index + 1 < visible.length) move(event, controls.current.get(`entry:${visible[index + 1]?.gameId}`));
              else if (focusCloseButton()) { event.preventDefault(); event.stopPropagation(); }
            }
          }} style={{ display: "flex", gap: 8 }}>
            {achievement && snapshot ? <>
              <ModalAction label="Details" activate={() => onDetails(pin, snapshot)} elementRef={(node) => { if (node) controls.current.set(`entry:${pin.gameId}`, node); }} onFocused={scroll} />
            </> : null}
            <ModalAction label="Unpin" activate={() => { if (!currentAccount(pin)) return; pendingFocus.current = visible[index + 1]?.gameId ?? visible[index - 1]?.gameId; unpinAchievement(pin, pin.achievementId); }}
              {...(!achievement ? { elementRef: (node: HTMLDivElement | null) => { if (node) controls.current.set(`entry:${pin.gameId}`, node); } } : {})} onFocused={scroll} />
          </Focusable>
        </article>;
      })}
    </div>
  </div>;
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
