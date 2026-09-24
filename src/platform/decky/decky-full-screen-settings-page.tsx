import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";
import {
  loadDeckyDashboardState,
  refreshDeckySteamLibraryForExplicitRefresh,
} from "./decky-app-services";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { clearDeckyDashboardSnapshot } from "./decky-dashboard-snapshot-cache";
import { DeckyFullScreenFooterOverlay, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS } from "./decky-full-screen-footer-overlay";
import { clearDeckySteamGameDetailCache } from "./decky-steam-game-detail-cache";
import { createDeckySettingsStore } from "./decky-settings";
import { removeDeckyStorageTextsByPrefix } from "./storage";
import { getDeckyProviderOptions, useDeckyProviderConfigs } from "./providers";
import { clearDeckyProviderConfig as clearRetroAchievementsAccount } from "./providers/retroachievements";
import { clearDeckySteamLibraryAchievementScanSummary, clearDeckySteamProviderConfig, useDeckySteamLibraryAchievementScanSummary } from "./providers/steam";
import { useSteamConnectionState } from "./providers/steam/connection";
import bellIconUrl from "./assets/bell.svg";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import databaseIconUrl from "./assets/database.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import gamepadIconUrl from "./assets/gamepad.svg";
import infoIconUrl from "./assets/info.svg";
import refreshIconUrl from "./assets/refresh.svg";
import settingsIconUrl from "./assets/settings.svg";
import trashIconUrl from "./assets/trash.svg";
import brandLogoUrl from "./assets/brand/AC_main_logo.png";
import brandSecondaryLogoUrl from "./assets/brand/AC_secondary_logo.png";
import retroAchievementsLogoUrl from "./assets/providers/retroachievements/retroachievements.png";
import steamLogoUrl from "./assets/providers/steam/steam.png";

const VERSION = "0.4.0";
const RELEASES_URL = "https://github.com/parvagans/achievement-companion/releases";
const REPOSITORY_URL = "https://github.com/parvagans/achievement-companion";
const ISSUES_URL = "https://github.com/parvagans/achievement-companion/issues";
const RECENT_CACHE_PREFIX = "achievement-companion:decky:recent-achievements";
const CYAN_FILTER = "brightness(0) saturate(100%) invert(63%) sepia(89%) saturate(1795%) hue-rotate(166deg) brightness(103%) contrast(103%)";

type OperationState = "idle" | "refreshing" | "refreshed" | "cleared" | "reset" | "error";
type UpdateState =
  | { readonly status: "idle" | "checking" | "error" }
  | { readonly status: "current"; readonly latestVersion: string }
  | { readonly status: "available"; readonly latestVersion: string; readonly releaseUrl: string };

export interface DeckyFullScreenSettingsPageProps {
  readonly onBack: () => void;
  readonly onOpenProviderSettings: (providerId: string) => void;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly onOpenActivity?: () => void;
  readonly onOpenProfile?: () => void;
  readonly showSteamProfileFooter?: boolean;
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string): number[] => value.replace(/^v/iu, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function loadLatestRelease(): Promise<{ readonly version: string; readonly url: string }> {
  const response = await fetch("https://api.github.com/repos/parvagans/achievement-companion/releases/latest", {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  const result = await response.json() as unknown;
  if (typeof result !== "object" || result === null) throw new Error("Invalid release response");
  const record = result as Record<string, unknown>;
  if (typeof record["tag_name"] !== "string" || typeof record["html_url"] !== "string") throw new Error("Incomplete release response");
  return { version: record["tag_name"].replace(/^v/iu, ""), url: record["html_url"] };
}

function Styles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const document = anchorRef.current?.ownerDocument;
    if (document === undefined) return;
    const style = document.createElement("style");
    style.textContent = `.ac-settings-action{outline:none!important}.ac-settings-action.gpfocus,.ac-settings-action.gpfocuswithin,.ac-settings-action:focus,.ac-settings-action:focus-within{border-color:#25bfff!important;box-shadow:0 0 0 2px rgba(37,191,255,.78),0 0 18px rgba(20,151,229,.35),inset 0 0 0 1px rgba(255,255,255,.12)!important;background:linear-gradient(180deg,rgba(27,77,109,.88),rgba(12,43,64,.94))!important}.ac-settings-action.gpfocus .ac-settings-pill,.ac-settings-action:focus .ac-settings-pill{border-color:rgba(75,190,255,.7)!important;background:rgba(25,104,157,.6)!important}[data-settings-column=right] .Panel.Focusable[role=button]{min-height:26px!important}[data-settings-column=right]>div{min-height:0;flex-shrink:1}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

const iconStyle = (size = 22): CSSProperties => ({ width: size, height: size, objectFit: "contain", filter: CYAN_FILTER, flexShrink: 0 });
const cardStyle: CSSProperties = { border: "1px solid rgba(68,151,204,.25)", borderRadius: 9, background: "rgba(7,27,41,.88)" };

function Heading({ children }: { readonly children: ReactNode }): JSX.Element {
  const label = children === "DATA & SYNC" ? "STEAM DATA & SYNC" : children;
  return <div style={{ color: "#b9d7ee", fontSize: 10, fontWeight: 900, letterSpacing: ".14em", lineHeight: 1.2 }}>{label}</div>;
}

function Logo({ compact = false }: { readonly compact?: boolean }): JSX.Element {
  return <img alt="Achievement Companion" src={compact ? brandSecondaryLogoUrl : brandLogoUrl} style={{ display: "block", width: compact ? 48 : 138, height: compact ? 48 : 82, flex: "0 0 auto", objectFit: "contain" }} />;
}

function ActionRow({ title, subtitle, icon, onActivate, danger = false, disabled = false, onGamepadDirection }: {
  readonly title: string;
  readonly subtitle?: string;
  readonly icon: string;
  readonly onActivate?: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
  const interactive = onActivate !== undefined && !disabled;
  return (
    <Focusable className="ac-settings-action" noFocusRing aria-label={title} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1} {...(interactive ? { role: "button" as const, onActivate, onClick: onActivate, onGamepadDirection } : {})} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, padding: "1px 7px", boxSizing: "border-box", border: `1px solid ${danger ? "rgba(255,67,91,.5)" : "rgba(91,165,213,.18)"}`, borderRadius: 7, background: danger ? "linear-gradient(90deg,rgba(89,17,31,.56),rgba(57,15,27,.45))" : "rgba(12,35,51,.76)", color: danger ? "#ff6075" : "#eef8ff", opacity: disabled ? .56 : 1 }}>
      <img alt="" aria-hidden="true" src={icon} style={{ ...iconStyle(17), ...(danger ? { filter: "brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(2856%) hue-rotate(324deg) brightness(102%) contrast(101%)" } : {}) }} />
      <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ fontSize: 8, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>{subtitle !== undefined ? <div style={{ marginTop: 1, color: danger ? "#ffc0c8" : "#a8bed0", fontSize: 6.5, lineHeight: 1.05 }}>{subtitle}</div> : null}</div>
      {interactive ? <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={{ ...iconStyle(15), opacity: .85 }} /> : null}
    </Focusable>
  );
}

function formatSyncTime(timestamp: number | undefined): { readonly date: string; readonly time: string } {
  if (timestamp === undefined) return { date: "Never", time: "Not synced" };
  const date = new Date(timestamp);
  return { date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) };
}

export function DeckyFullScreenSettingsPage({ onBack, onOpenProviderSettings, onOpenExternalUrl, onOpenActivity, onOpenProfile, showSteamProfileFooter = false }: DeckyFullScreenSettingsPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLDivElement>(null);
  const didSetInitialFocus = useRef(false);
  const handleColumnDirection = (event: GamepadEvent): void => {
    const button = event.detail.button;
    const isVertical = button === GamepadButton.DIR_UP || button === GamepadButton.DIR_DOWN;
    const isHorizontal = button === GamepadButton.DIR_LEFT || button === GamepadButton.DIR_RIGHT;
    if (!isVertical && !isHorizontal) return;
    if (isHorizontal && event.detail.is_repeat === true) return;
    const page = pageRef.current;
    const active = page?.ownerDocument.activeElement;
    const HTMLElementConstructor = page?.ownerDocument.defaultView?.HTMLElement;
    if (page === null || page === undefined || HTMLElementConstructor === undefined || !(active instanceof HTMLElementConstructor)) return;
    const sourceId = active.closest<HTMLElement>("[data-settings-column]")?.dataset["settingsColumn"];
    const destinationId = isVertical
      ? sourceId
      : sourceId === "left" ? "right" : sourceId === "right" ? "left" : undefined;
    if (destinationId === undefined) return;
    const destination = page.querySelector<HTMLElement>(`[data-settings-column="${destinationId}"]`);
    if (destination === null) return;
    const activeBounds = active.getBoundingClientRect();
    const activeCenter = activeBounds.top + activeBounds.height / 2;
    const targets = [...destination.querySelectorAll<HTMLElement>(".Panel.Focusable[role='button']:not([aria-disabled='true'])")];
    const target = targets.reduce<{ readonly element: HTMLElement; readonly distance: number } | undefined>((closest, candidate) => {
      if (candidate === active) return closest;
      const bounds = candidate.getBoundingClientRect();
      const center = bounds.top + bounds.height / 2;
      const delta = center - activeCenter;
      if (isVertical && (button === GamepadButton.DIR_UP ? delta >= 0 : delta <= 0)) return closest;
      const distance = Math.abs(delta);
      return closest === undefined || distance < closest.distance ? { element: candidate, distance } : closest;
    }, undefined)?.element;
    // The focused Decky control owns directional input, so consume the event even at
    // a vertical endpoint instead of allowing focus to escape into another region.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    target?.focus();
  };
  const configs = useDeckyProviderConfigs();
  const providers = getDeckyProviderOptions(configs).filter((provider) => provider.enabled);
  const steamConnection = useSteamConnectionState();
  const steamScan = useDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  const [operation, setOperation] = useState<OperationState>("idle");
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [armedAction, setArmedAction] = useState<"clear" | "reset">();
  const lastSync = useMemo(() => formatSyncTime(steamConnection.lastSuccessfulRefreshAt), [steamConnection.lastSuccessfulRefreshAt]);

  useLayoutEffect(() => {
    const ownerWindow = pageRef.current?.ownerDocument.defaultView;
    if (ownerWindow === null || ownerWindow === undefined || didSetInitialFocus.current) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      if (didSetInitialFocus.current) return;
      const target = initialFocusRef.current;
      if (target === null) return;
      target.focus();
      didSetInitialFocus.current = true;
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, []);

  const refreshAll = async (): Promise<void> => {
    setOperation("refreshing");
    try {
      const connectedProviders = providers.filter((provider) => provider.connected);
      const [states] = await Promise.all([
        Promise.all(connectedProviders.map((provider) => loadDeckyDashboardState(provider.id, { forceRefresh: true }))),
        connectedProviders.some((provider) => provider.id === STEAM_PROVIDER_ID)
          ? refreshDeckySteamLibraryForExplicitRefresh()
          : Promise.resolve(undefined),
      ]);
      setOperation(states.every((state) => state.data !== undefined && state.error === undefined) ? "refreshed" : "error");
    } catch { setOperation("error"); }
  };
  const clearCache = (): void => {
    clearDeckyDashboardSnapshot(RETROACHIEVEMENTS_PROVIDER_ID);
    clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID);
    clearDeckySteamGameDetailCache();
    clearDeckySteamLibraryAchievementScanSummary();
    removeDeckyStorageTextsByPrefix(RECENT_CACHE_PREFIX);
    setArmedAction(undefined); setOperation("cleared");
  };
  const resetAll = async (): Promise<void> => {
    clearCache();
    const [retroCleared, steamCleared] = await Promise.all([clearRetroAchievementsAccount(), clearDeckySteamProviderConfig()]);
    await createDeckySettingsStore().delete("achievement-companion:settings");
    setArmedAction(undefined); setOperation(retroCleared && steamCleared ? "reset" : "error");
  };
  const checkUpdates = async (): Promise<void> => {
    if (update.status === "available") { onOpenExternalUrl(update.releaseUrl); return; }
    setUpdate({ status: "checking" });
    try {
      const latest = await loadLatestRelease();
      setUpdate(compareVersions(latest.version, VERSION) > 0 ? { status: "available", latestVersion: latest.version, releaseUrl: latest.url } : { status: "current", latestVersion: latest.version });
    } catch { setUpdate({ status: "error" }); }
  };
  const updateLabel = update.status === "checking" ? "Checking…" : update.status === "available" ? `v${update.latestVersion} available` : update.status === "current" ? "Up to date" : update.status === "error" ? "Try Again" : "Check for Updates";
  const operationMessage = operation === "refreshed" ? "All connected providers refreshed" : operation === "cleared" ? "Cached data cleared" : operation === "reset" ? "All plugin data reset" : operation === "error" ? "The operation could not be completed" : undefined;
  return (
    <div ref={pageRef} style={{ position: "relative", height: "100vh", minHeight: 0, overflow: "hidden", padding: `calc(env(safe-area-inset-top, 0px) + 43px) 12px ${showSteamProfileFooter ? 50 : 10}px`, boxSizing: "border-box", color: "#f2f7fb", background: "linear-gradient(120deg,#06111a,#071724 55%,#06121c)" }}>
      <Styles />
      <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 31 }}><Heading>SETTINGS</Heading>{!showSteamProfileFooter ? <DeckyFullscreenActionButton label="Back" isFullscreenBackAction onClick={onBack} compact /> : null}</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.9fr) minmax(270px,.95fr)", gap: 10, minHeight: 0, flex: "1 1 auto" }}>
          <div data-settings-column="left" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
            <div style={{ ...cardStyle, display: "flex", alignItems: "center", minHeight: 91, padding: "5px 13px", background: "linear-gradient(90deg,rgba(9,35,52,.95),rgba(7,29,44,.9))" }}><Logo /><div style={{ alignSelf: "stretch", width: 1, margin: "5px 13px", background: "rgba(102,178,225,.25)" }} /><div style={{ width: "42%", color: "#afc2d2", fontSize: 9, lineHeight: 1.35 }}>Manage provider accounts, credentials, scans, and display preferences.</div></div>
            <Heading>PROVIDERS</Heading>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{providers.map((provider) => {
              const isSteam = provider.id === STEAM_PROVIDER_ID;
              const account = isSteam ? configs.steam?.steamId64 : configs.retroAchievements?.username;
              const detail = !provider.connected ? "Credentials required" : isSteam && account ? `SteamID • ${account.slice(-6)}` : account || "Account configured";
              return <Focusable key={provider.id} ref={provider.id === RETROACHIEVEMENTS_PROVIDER_ID ? initialFocusRef : undefined} className="ac-settings-action" noFocusRing role="button" aria-label={`Manage ${provider.label}`} tabIndex={0} onActivate={() => onOpenProviderSettings(provider.id)} onClick={() => onOpenProviderSettings(provider.id)} onGamepadDirection={handleColumnDirection} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46, padding: "4px 10px", boxSizing: "border-box", border: "1px solid rgba(71,158,214,.22)", borderRadius: 8, background: "rgba(8,31,47,.88)" }}><div style={{ width: 35, height: 35, borderRadius: 8, border: "1px solid rgba(67,196,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#07141f", flexShrink: 0 }}><img alt="" src={isSteam ? steamLogoUrl : retroAchievementsLogoUrl} style={{ width: 31, height: 31, objectFit: "contain" }} /></div><div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ fontSize: 10, fontWeight: 850 }}>{provider.label}</div><div style={{ marginTop: 2, color: provider.connected ? "#20e884" : "#f5c542", fontSize: 8, fontWeight: 750 }}>●&nbsp; {provider.connected ? "Connected" : "Set up account"}</div><div style={{ marginTop: 1, color: "#8ca8bb", fontSize: 7 }}>{detail}</div></div><span className="ac-settings-pill" style={{ padding: "5px 14px", border: "1px solid rgba(64,165,225,.32)", borderRadius: 999, background: "rgba(12,62,94,.68)", fontSize: 8, fontWeight: 800 }}>Manage</span><img alt="" src={chevronRightIconUrl} style={{ ...iconStyle(17), opacity: .85 }} /></Focusable>;
            })}</div>
            <Heading>GENERAL</Heading>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={settingsIconUrl} title="Display Preferences" subtitle="Theme, layout, date format, and UI options" onActivate={() => onOpenProviderSettings(RETROACHIEVEMENTS_PROVIDER_ID)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={gamepadIconUrl} title="Game Scanning" subtitle="Steam library scan settings and data refresh" onActivate={() => onOpenProviderSettings(STEAM_PROVIDER_ID)} /><ActionRow disabled icon={bellIconUrl} title="Notifications" subtitle="Notification preferences are not available in this build" /></div>
          </div>

          <div data-settings-column="right" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden", justifyContent: "space-between" }}>
            <div style={{ ...cardStyle, padding: 8 }}><Heading>ABOUT</Heading><div style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 43, padding: "2px 3px 4px" }}><Logo compact /><div><div style={{ fontSize: 11, fontWeight: 850 }}>Achievement Companion</div><div style={{ marginTop: 2, color: "#a9bdcd", fontSize: 8 }}>v{VERSION}</div></div></div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="View Changelog" onActivate={() => onOpenExternalUrl(RELEASES_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="GitHub Repository" onActivate={() => onOpenExternalUrl(REPOSITORY_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={infoIconUrl} title="Report an Issue" onActivate={() => onOpenExternalUrl(ISSUES_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={updateLabel} disabled={update.status === "checking"} onActivate={() => { void checkUpdates(); }} /></div></div>
            <div style={{ ...cardStyle, padding: 8 }}><Heading>DATA &amp; SYNC</Heading><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, margin: "6px 0" }}><div style={{ display: "flex", alignItems: "center", gap: 7, padding: 7, borderRadius: 7, border: "1px solid rgba(75,157,208,.18)", background: "rgba(11,39,57,.78)" }}><img alt="" src={databaseIconUrl} style={iconStyle(23)} /><div><div style={{ color: "#a8bdcc", fontSize: 7 }}>Cached Games</div><div style={{ fontSize: 13, fontWeight: 900 }}>{steamScan?.games.length.toLocaleString() ?? "—"}</div></div></div><div style={{ display: "flex", alignItems: "center", gap: 7, padding: 7, borderRadius: 7, border: "1px solid rgba(75,157,208,.18)", background: "rgba(11,39,57,.78)" }}><img alt="" src={refreshIconUrl} style={iconStyle(23)} /><div><div style={{ color: "#a8bdcc", fontSize: 7 }}>Last Sync</div><div style={{ fontSize: 9, fontWeight: 850 }}>{lastSync.date}</div><div style={{ color: "#a8bdcc", fontSize: 7 }}>{lastSync.time}</div></div></div></div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing" ? "Refreshing All Data…" : "Refresh All Data"} disabled={operation === "refreshing" || !providers.some((provider) => provider.connected)} onActivate={() => { void refreshAll(); }} /><ActionRow onGamepadDirection={handleColumnDirection} danger icon={trashIconUrl} title={armedAction === "clear" ? "Press again to clear cached data" : "Clear Cached Data"} onActivate={() => { if (armedAction === "clear") clearCache(); else setArmedAction("clear"); }} /></div>{operationMessage !== undefined ? <div style={{ marginTop: 5, color: operation === "error" ? "#ff7182" : "#74dba1", fontSize: 7, textAlign: "center" }}>{operationMessage}</div> : null}</div>
            <div style={{ ...cardStyle, padding: 8 }}><Heading>DANGEROUS ZONE</Heading><div style={{ marginTop: 6 }}><ActionRow onGamepadDirection={handleColumnDirection} danger icon={refreshIconUrl} title={armedAction === "reset" ? "Press again to reset all data" : "Reset All Data"} subtitle="Clear cache, local data, provider accounts, and settings" onActivate={() => { if (armedAction === "reset") void resetAll(); else setArmedAction("reset"); }} /></div></div>
          </div>
        </div>
      </div>
      {showSteamProfileFooter && onOpenActivity !== undefined && onOpenProfile !== undefined ? <DeckyFullScreenFooterOverlay activeNavigationItemId="settings" ariaLabel="Steam profile navigation" navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS} onBack={onBack} onPreviousNavigationItem={onOpenActivity} onNextNavigationItem={onOpenProfile} /> : null}
    </div>
  );
}
