import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ACHIEVEMENT_COMPANION_COUNT_OPTIONS, type AchievementCompanionCount } from "../../core/settings";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../providers/steam/config";
import { loadDeckyDashboardState, refreshDeckySteamHuntersProfileState, runDeckySteamFullLibraryScan } from "./decky-app-services";
import { DeckyCredentialTextField, getDeckyCredentialTextFieldMaskStyle } from "./decky-credential-text-field";
import { DeckyFullscreenActionButton } from "./decky-full-screen-action-controls";
import { clearDeckyDashboardSnapshot } from "./decky-dashboard-snapshot-cache";
import { DeckyFullScreenFooterOverlay, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS } from "./decky-full-screen-footer-overlay";
import { clearDeckySteamGameDetailCache } from "./decky-steam-game-detail-cache";
import { removeDeckyStorageTextsByPrefix } from "./storage";
import { clearDeckySteamLibraryAchievementScanSummary, clearDeckySteamProviderConfig, useDeckySteamLibraryAchievementScanSummary, useDeckySteamProviderConfig } from "./providers/steam";
import { writeValidatedDeckySteamProviderConfig } from "./providers/steam/config";
import { useSteamConnectionState } from "./providers/steam/connection";
import { STEAM_CREDENTIAL_HELPER_COPY, getSteamApiKeyInputDescriptor, getSteamCredentialsFieldSpecs } from "./providers/steam/credentials-help";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import databaseIconUrl from "./assets/database.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import infoIconUrl from "./assets/info.svg";
import refreshIconUrl from "./assets/refresh.svg";
import settingsIconUrl from "./assets/settings.svg";
import trashIconUrl from "./assets/trash.svg";
import usersIconUrl from "./assets/users.svg";
import brandLogoUrl from "./assets/brand/AC_main_logo.png";
import brandSecondaryLogoUrl from "./assets/brand/AC_secondary_logo.png";

const VERSION = "0.4.0";
const RELEASES_URL = "https://github.com/parvagans/achievement-companion/releases";
const REPOSITORY_URL = "https://github.com/parvagans/achievement-companion";
const ISSUES_URL = "https://github.com/parvagans/achievement-companion/issues";
const RECENT_CACHE_PREFIX = "achievement-companion:decky:recent-achievements";
const CYAN_FILTER = "brightness(0) saturate(100%) invert(63%) sepia(89%) saturate(1795%) hue-rotate(166deg) brightness(103%) contrast(103%)";

type OperationState = "idle" | "refreshing-steam" | "refreshing-library" | "steam-refreshed" | "library-refreshed" | "cleared" | "reset" | "error";
type UpdateState = { readonly status: "idle" | "checking" | "error" } | { readonly status: "current"; readonly latestVersion: string } | { readonly status: "available"; readonly latestVersion: string; readonly releaseUrl: string };

export interface DeckyFullScreenSettingsPageProps {
  readonly onBack: () => void;
  /** Retained for the separate provider-settings route; Steam Settings no longer launches it. */
  readonly onOpenProviderSettings: (providerId: string) => void;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly onOpenActivity?: () => void;
  readonly onOpenProfile?: () => void;
  readonly showSteamProfileFooter?: boolean;
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string): number[] => value.replace(/^v/iu, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left); const rightParts = parse(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function loadLatestRelease(): Promise<{ readonly version: string; readonly url: string }> {
  const response = await fetch("https://api.github.com/repos/parvagans/achievement-companion/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
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
    style.textContent = `.ac-settings-action{outline:none!important}.ac-settings-action.gpfocus,.ac-settings-action.gpfocuswithin,.ac-settings-action:focus,.ac-settings-action:focus-within{border-color:#25bfff!important;box-shadow:0 0 0 2px rgba(37,191,255,.78),0 0 18px rgba(20,151,229,.35),inset 0 0 0 1px rgba(255,255,255,.12)!important;background:linear-gradient(180deg,rgba(27,77,109,.88),rgba(12,43,64,.94))!important}[data-settings-column=right] .Panel.Focusable[role=button]{min-height:21px!important}.ac-steam-settings-input input{font-size:9px!important;min-height:22px!important}.ac-steam-settings-input .DialogInput{min-height:22px!important}`;
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
  return <img alt="Achievement Companion" src={compact ? brandSecondaryLogoUrl : brandLogoUrl} style={{ display: "block", width: compact ? 48 : 128, height: compact ? 48 : 68, flex: "0 0 auto", objectFit: "contain" }} />;
}

function ActionRow({ title, subtitle, icon, onActivate, danger = false, disabled = false, onGamepadDirection }: { readonly title: string; readonly subtitle?: string; readonly icon: string; readonly onActivate?: () => void; readonly danger?: boolean; readonly disabled?: boolean; readonly onGamepadDirection?: (event: GamepadEvent) => void }): JSX.Element {
  const interactive = onActivate !== undefined && !disabled;
  const actionTitle = title === "Refresh Steam Library" ? "Last Full Scan" : title;
  const actionSubtitle = title === "Refresh Steam Library" ? "Select to run a full library scan" : subtitle;
  return <Focusable className="ac-settings-action" noFocusRing aria-label={actionTitle} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1} {...(interactive ? { role: "button" as const, onActivate, onClick: onActivate, onGamepadDirection } : {})} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, padding: "1px 7px", boxSizing: "border-box", border: `1px solid ${danger ? "rgba(255,67,91,.5)" : "rgba(91,165,213,.18)"}`, borderRadius: 7, background: danger ? "linear-gradient(90deg,rgba(89,17,31,.56),rgba(57,15,27,.45))" : "rgba(12,35,51,.76)", color: danger ? "#ff6075" : "#eef8ff", opacity: disabled ? .56 : 1 }}>
    <img alt="" aria-hidden="true" src={icon} style={{ ...iconStyle(17), ...(danger ? { filter: "brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(2856%) hue-rotate(324deg) brightness(102%) contrast(101%)" } : {}) }} />
    <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ fontSize: 8, fontWeight: 800, lineHeight: 1.05 }}>{actionTitle}</div>{actionSubtitle !== undefined ? <div style={{ marginTop: 1, color: danger ? "#ffc0c8" : "#a8bed0", fontSize: 6.5, lineHeight: 1.05 }}>{actionSubtitle}</div> : null}</div>
    {interactive ? <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={{ ...iconStyle(15), opacity: .85 }} /> : null}
  </Focusable>;
}

function SteamAccordion({ title, subtitle, icon, expanded, initialFocusRef, onToggle, onGamepadDirection, children }: { readonly title: string; readonly subtitle: string; readonly icon: string; readonly expanded: boolean; readonly initialFocusRef?: React.Ref<HTMLDivElement>; readonly onToggle: () => void; readonly onGamepadDirection: (event: GamepadEvent) => void; readonly children?: ReactNode }): JSX.Element {
  return <div style={{ ...cardStyle, overflow: "hidden", borderColor: expanded ? "rgba(44,185,255,.75)" : "rgba(68,151,204,.25)", background: "rgba(6,28,43,.92)" }}>
    <Focusable ref={initialFocusRef} className="ac-settings-action" noFocusRing role="button" aria-expanded={expanded} aria-label={`${title}, ${expanded ? "expanded" : "collapsed"}`} tabIndex={0} onActivate={onToggle} onClick={onToggle} onGamepadDirection={onGamepadDirection} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, padding: "4px 12px", boxSizing: "border-box", border: "1px solid transparent", borderRadius: 8 }}>
      <span style={{ width: 31, height: 31, display: "grid", placeItems: "center", borderRadius: 999, background: "rgba(6,61,94,.68)", border: "1px solid rgba(31,171,241,.42)" }}><img alt="" src={icon} style={iconStyle(19)} /></span><span style={{ minWidth: 0, flex: "1 1 auto" }}><span style={{ display: "block", fontSize: 10, fontWeight: 850 }}>{title}</span><span style={{ display: "block", marginTop: 1, color: "#a9c2d3", fontSize: 7.5 }}>{subtitle}</span></span><span aria-hidden="true" style={{ color: "#2bc3f2", fontSize: 20, fontWeight: 700, transform: expanded ? "rotate(-90deg)" : "rotate(90deg)", lineHeight: 1 }}>›</span>
    </Focusable>
    {expanded ? <div style={{ borderTop: "1px solid rgba(73,154,204,.2)", padding: "5px 12px 7px", display: "flex", flexDirection: "column", gap: 4 }}>{children}</div> : null}
  </div>;
}

function formatSyncTime(timestamp: number | undefined): { readonly date: string; readonly time: string } {
  if (timestamp === undefined) return { date: "Never", time: "Not synced" };
  const date = new Date(timestamp);
  return { date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) };
}

function SteamAccountFields({ config, connectionStatus, onSaved }: { readonly config: SteamProviderConfig | undefined; readonly connectionStatus: string; readonly onSaved: (message: string, isError: boolean) => void }): JSX.Element {
  const fields = getSteamCredentialsFieldSpecs(); const apiKeyDescriptor = getSteamApiKeyInputDescriptor(config?.hasApiKey === true);
  const [steamId64, setSteamId64] = useState(config?.steamId64 ?? ""); const [apiKeyDraft, setApiKeyDraft] = useState(""); const [language, setLanguage] = useState(config?.language ?? "english"); const [saving, setSaving] = useState(false);
  useEffect(() => { setSteamId64(config?.steamId64 ?? ""); setApiKeyDraft(""); setLanguage(config?.language ?? "english"); }, [config?.hasApiKey, config?.language, config?.steamId64]);
  const save = async (): Promise<void> => { setSaving(true); try { const result = await writeValidatedDeckySteamProviderConfig({ steamId64, language, recentAchievementsCount: config?.recentAchievementsCount ?? 5, recentlyPlayedCount: config?.recentlyPlayedCount ?? 5, includePlayedFreeGames: config?.includePlayedFreeGames ?? false }, apiKeyDraft); onSaved(result.userMessage, !result.saved); } catch { onSaved("Unable to save Steam account settings.", true); } finally { setSaving(false); } };
  const inputStyle: CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box" };
  return <>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 7px", border: "1px solid rgba(51,145,197,.24)", borderRadius: 7, background: "rgba(9,39,58,.72)" }}><img alt="" src={infoIconUrl} style={iconStyle(20)} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 8.5, fontWeight: 850 }}>Setup help</div><div style={{ marginTop: 1, color: "#aec4d5", fontSize: 7.2, lineHeight: 1.2 }}>{STEAM_CREDENTIAL_HELPER_COPY}</div></div></div>
    <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 27, padding: "3px 7px", border: "1px solid rgba(51,145,197,.2)", borderRadius: 7, background: "rgba(8,32,48,.74)" }}><span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: "50%", background: connectionStatus === "connected" ? "#22e785" : "#f5c542", boxShadow: "0 0 9px rgba(34,231,133,.4)" }} /><div><div style={{ fontSize: 8, fontWeight: 850 }}>Account status</div><div style={{ color: "#afc3d3", fontSize: 7 }}>{connectionStatus === "connected" && steamId64 ? `Connected to Steam ID64 ${steamId64}.` : "Enter your Steam account credentials."}</div></div></div>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={fields.steamId64.label} description={fields.steamId64.description} value={steamId64} onChange={(event) => setSteamId64(event.currentTarget.value)} style={inputStyle} /></div>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={fields.apiKey.label} value={apiKeyDraft} {...apiKeyDescriptor} style={{ ...inputStyle, ...getDeckyCredentialTextFieldMaskStyle() }} onChange={(event) => setApiKeyDraft(event.currentTarget.value)} /></div>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={fields.language.label} description={fields.language.description} value={language} onChange={(event) => setLanguage(event.currentTarget.value)} style={inputStyle} /></div>
    <Focusable className="ac-settings-action" noFocusRing role="button" aria-label="Save Steam account settings" aria-disabled={saving} tabIndex={saving ? -1 : 0} onActivate={() => { void save(); }} onClick={() => { void save(); }} style={{ alignSelf: "flex-end", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(56,177,241,.55)", background: "rgba(11,80,121,.6)", color: "#e9f8ff", fontSize: 7, fontWeight: 850 }}>{saving ? "Saving…" : "Save account settings"}</Focusable>
  </>;
}

function SteamDisplayPreferences({ config, onSaved }: { readonly config: SteamProviderConfig | undefined; readonly onSaved: (message: string, isError: boolean) => void }): JSX.Element {
  const [saving, setSaving] = useState(false);
  const save = async (updates: Partial<Pick<SteamProviderConfig, "recentAchievementsCount" | "recentlyPlayedCount" | "includePlayedFreeGames">>): Promise<void> => {
    if (config === undefined) return;
    setSaving(true);
    try {
      const result = await writeValidatedDeckySteamProviderConfig({
        steamId64: config.steamId64,
        language: config.language,
        recentAchievementsCount: updates.recentAchievementsCount ?? config.recentAchievementsCount,
        recentlyPlayedCount: updates.recentlyPlayedCount ?? config.recentlyPlayedCount,
        includePlayedFreeGames: updates.includePlayedFreeGames ?? config.includePlayedFreeGames,
      }, "");
      onSaved(result.userMessage, !result.saved);
    } catch {
      onSaved("Unable to save Steam display preferences.", true);
    } finally {
      setSaving(false);
    }
  };
  const nextCount = (count: AchievementCompanionCount): AchievementCompanionCount => ACHIEVEMENT_COMPANION_COUNT_OPTIONS[(ACHIEVEMENT_COMPANION_COUNT_OPTIONS.indexOf(count) + 1) % ACHIEVEMENT_COMPANION_COUNT_OPTIONS.length] ?? count;
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <ActionRow icon={settingsIconUrl} title={`Recent games shown: ${config?.recentlyPlayedCount ?? 5}`} subtitle="Choose 3, 5, 7, or 10 games" disabled={saving || config === undefined} onActivate={() => { if (config !== undefined) void save({ recentlyPlayedCount: nextCount(config.recentlyPlayedCount) }); }} />
    <ActionRow icon={settingsIconUrl} title={`Recent achievements shown: ${config?.recentAchievementsCount ?? 5}`} subtitle="Choose 3, 5, 7, or 10 achievements" disabled={saving || config === undefined} onActivate={() => { if (config !== undefined) void save({ recentAchievementsCount: nextCount(config.recentAchievementsCount) }); }} />
    <ActionRow icon={settingsIconUrl} title={`Include played free games: ${(config?.includePlayedFreeGames ?? false) ? "On" : "Off"}`} subtitle="Include free Steam games with playtime" disabled={saving || config === undefined} onActivate={() => { if (config !== undefined) void save({ includePlayedFreeGames: !config.includePlayedFreeGames }); }} />
  </div>;
}

export function DeckyFullScreenSettingsPage({ onBack, onOpenExternalUrl, onOpenActivity, onOpenProfile, showSteamProfileFooter = false }: DeckyFullScreenSettingsPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null); const initialFocusRef = useRef<HTMLDivElement>(null); const didSetInitialFocus = useRef(false);
  const [accountExpanded, setAccountExpanded] = useState(false); const [displayExpanded, setDisplayExpanded] = useState(false); const [accountMessage, setAccountMessage] = useState<{ readonly message: string; readonly isError: boolean }>();
  const handleColumnDirection = (event: GamepadEvent): void => { const button = event.detail.button; const isVertical = button === GamepadButton.DIR_UP || button === GamepadButton.DIR_DOWN; const isHorizontal = button === GamepadButton.DIR_LEFT || button === GamepadButton.DIR_RIGHT; if (!isVertical && !isHorizontal) return; if (isHorizontal && event.detail.is_repeat === true) return; const page = pageRef.current; const active = page?.ownerDocument.activeElement; const HTMLElementConstructor = page?.ownerDocument.defaultView?.HTMLElement; if (page === null || page === undefined || HTMLElementConstructor === undefined || !(active instanceof HTMLElementConstructor)) return; const sourceId = active.closest<HTMLElement>("[data-settings-column]")?.dataset["settingsColumn"]; const destinationId = isVertical ? sourceId : sourceId === "left" ? "right" : sourceId === "right" ? "left" : undefined; if (destinationId === undefined) return; const destination = page.querySelector<HTMLElement>(`[data-settings-column="${destinationId}"]`); if (destination === null) return; const activeBounds = active.getBoundingClientRect(); const activeCenter = activeBounds.top + activeBounds.height / 2; const targets = [...destination.querySelectorAll<HTMLElement>(".Panel.Focusable[role='button']:not([aria-disabled='true'])")]; const target = targets.reduce<{ readonly element: HTMLElement; readonly distance: number } | undefined>((closest, candidate) => { if (candidate === active) return closest; const bounds = candidate.getBoundingClientRect(); const delta = bounds.top + bounds.height / 2 - activeCenter; if (isVertical && (button === GamepadButton.DIR_UP ? delta >= 0 : delta <= 0)) return closest; const distance = Math.abs(delta); return closest === undefined || distance < closest.distance ? { element: candidate, distance } : closest; }, undefined)?.element; event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); target?.focus(); };
  const steamConfig = useDeckySteamProviderConfig(STEAM_PROVIDER_ID); const steamConnection = useSteamConnectionState(); const steamScan = useDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  const [operation, setOperation] = useState<OperationState>("idle"); const [update, setUpdate] = useState<UpdateState>({ status: "idle" }); const [armedAction, setArmedAction] = useState<"clear" | "reset">();
  useLayoutEffect(() => { const ownerWindow = pageRef.current?.ownerDocument.defaultView; if (ownerWindow === null || ownerWindow === undefined || didSetInitialFocus.current) return; const frame = ownerWindow.requestAnimationFrame(() => { if (didSetInitialFocus.current) return; initialFocusRef.current?.focus(); didSetInitialFocus.current = true; }); return () => ownerWindow.cancelAnimationFrame(frame); }, []);
  const refreshSteamAndSteamHunters = async (): Promise<void> => { setOperation("refreshing-steam"); const steamId64 = steamConfig?.steamId64.trim(); try { const [dashboard] = await Promise.all([loadDeckyDashboardState(STEAM_PROVIDER_ID, { forceRefresh: true }), steamId64 === undefined || steamId64.length === 0 ? Promise.resolve(undefined) : refreshDeckySteamHuntersProfileState(steamId64).catch(() => undefined)]); setOperation(dashboard.data !== undefined && dashboard.error === undefined ? "steam-refreshed" : "error"); } catch { setOperation("error"); } };
  const refreshLibrary = async (): Promise<void> => { setOperation("refreshing-library"); try { const summary = await runDeckySteamFullLibraryScan(); setOperation(summary !== undefined ? "library-refreshed" : "error"); } catch { setOperation("error"); } };
  const clearCache = (): void => { clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID); clearDeckySteamGameDetailCache(); clearDeckySteamLibraryAchievementScanSummary(); removeDeckyStorageTextsByPrefix(RECENT_CACHE_PREFIX); setArmedAction(undefined); setOperation("cleared"); };
  const resetSteamData = async (): Promise<void> => { clearCache(); const cleared = await clearDeckySteamProviderConfig(); setArmedAction(undefined); setOperation(cleared ? "reset" : "error"); };
  const checkUpdates = async (): Promise<void> => { if (update.status === "available") { onOpenExternalUrl(update.releaseUrl); return; } setUpdate({ status: "checking" }); try { const latest = await loadLatestRelease(); setUpdate(compareVersions(latest.version, VERSION) > 0 ? { status: "available", latestVersion: latest.version, releaseUrl: latest.url } : { status: "current", latestVersion: latest.version }); } catch { setUpdate({ status: "error" }); } };
  const updateLabel = update.status === "checking" ? "Checking…" : update.status === "available" ? `v${update.latestVersion} available` : update.status === "current" ? "Up to date" : update.status === "error" ? "Try Again" : "Check for Updates";
  const operationMessage = operation === "steam-refreshed" ? "Steam and SteamHunters refreshed" : operation === "library-refreshed" ? "Full Steam library scan completed" : operation === "cleared" ? "Steam cached data cleared" : operation === "reset" ? "Steam settings reset" : operation === "error" ? "The operation could not be completed" : undefined;
  const steamConnected = steamConnection.status === "connected" || steamConfig?.hasApiKey === true;
  const fullScanAt = steamScan?.scannedAt;
  const parsedFullScanAt = fullScanAt === undefined ? Number.NaN : Date.parse(fullScanAt);
  const fullScan = Number.isFinite(parsedFullScanAt) ? formatSyncTime(parsedFullScanAt) : undefined;
  return <div ref={pageRef} style={{ position: "relative", height: "100vh", minHeight: 0, overflow: "hidden", padding: `calc(env(safe-area-inset-top, 0px) + 43px) 12px ${showSteamProfileFooter ? 50 : 10}px`, boxSizing: "border-box", color: "#f2f7fb", background: "linear-gradient(120deg,#06111a,#071724 55%,#06121c)" }}><Styles /><div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 31 }}><Heading>SETTINGS</Heading>{!showSteamProfileFooter ? <DeckyFullscreenActionButton label="Back" isFullscreenBackAction onClick={onBack} compact /> : null}</div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.9fr) minmax(270px,.95fr)", gap: 10, minHeight: 0, flex: "1 1 auto" }}>
      <div data-settings-column="left" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", minHeight: 70, padding: "4px 14px", background: "linear-gradient(90deg,rgba(9,35,52,.95),rgba(7,29,44,.9))" }}><Logo /><div style={{ alignSelf: "stretch", width: 1, margin: "5px 14px", background: "rgba(102,178,225,.25)" }} /><div style={{ minWidth: 0 }}><div style={{ color: "#b9dff4", fontSize: 7.5, fontWeight: 900, letterSpacing: ".14em" }}>STEAM SETTINGS</div><div style={{ marginTop: 3, fontSize: 16, fontWeight: 900 }}>Steam</div><div style={{ marginTop: 2, color: "#b7cad8", fontSize: 8.5, lineHeight: 1.2 }}>Manage Steam account settings and display preferences on this device.</div></div></div>
        <SteamAccordion title="Account" subtitle="Manage your Steam account credentials and connection." icon={usersIconUrl} expanded={accountExpanded} initialFocusRef={initialFocusRef} onToggle={() => setAccountExpanded((value) => !value)} onGamepadDirection={handleColumnDirection}><SteamAccountFields config={steamConfig} connectionStatus={steamConnection.status} onSaved={(message, isError) => setAccountMessage({ message, isError })} />{accountMessage !== undefined ? <div style={{ color: accountMessage.isError ? "#ff8695" : "#72e0a8", fontSize: 6.8, textAlign: "right" }}>{accountMessage.message}</div> : null}</SteamAccordion>
        <SteamAccordion title="Display Preferences" subtitle="Steam recent-game and library display options." icon={settingsIconUrl} expanded={displayExpanded} onToggle={() => setDisplayExpanded((value) => !value)} onGamepadDirection={handleColumnDirection}><SteamDisplayPreferences config={steamConfig} onSaved={(message, isError) => setAccountMessage({ message, isError })} />{accountMessage !== undefined ? <div style={{ color: accountMessage.isError ? "#ff8695" : "#72e0a8", fontSize: 6.8, textAlign: "right" }}>{accountMessage.message}</div> : null}</SteamAccordion>
      </div>
      <div data-settings-column="right" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden", justifyContent: "flex-start" }}>
        <div style={{ ...cardStyle, padding: 8 }}><Heading>ABOUT</Heading><div style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 43, padding: "2px 3px 4px" }}><Logo compact /><div><div style={{ fontSize: 11, fontWeight: 850 }}>Achievement Companion</div><div style={{ marginTop: 2, color: "#a9bdcd", fontSize: 8 }}>v{VERSION}</div></div></div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="View Changelog" onActivate={() => onOpenExternalUrl(RELEASES_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="GitHub Repository" onActivate={() => onOpenExternalUrl(REPOSITORY_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={infoIconUrl} title="Report an Issue" onActivate={() => onOpenExternalUrl(ISSUES_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={updateLabel} disabled={update.status === "checking"} onActivate={() => { void checkUpdates(); }} /></div></div>
        <div style={{ ...cardStyle, padding: 8 }}><Heading>DATA &amp; SYNC</Heading><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, margin: "6px 0" }}><div style={{ display: "flex", alignItems: "center", gap: 7, padding: 7, borderRadius: 7, border: "1px solid rgba(75,157,208,.18)", background: "rgba(11,39,57,.78)" }}><img alt="" src={databaseIconUrl} style={iconStyle(23)} /><div><div style={{ color: "#a8bdcc", fontSize: 7 }}>Cached Games</div><div style={{ fontSize: 13, fontWeight: 900 }}>{steamScan?.games.length.toLocaleString() ?? "—"}</div></div></div><div style={{ display: "flex", alignItems: "center", gap: 7, padding: 7, borderRadius: 7, border: `1px solid ${fullScan === undefined ? "rgba(255,84,104,.7)" : "rgba(49,226,142,.55)"}`, background: fullScan === undefined ? "rgba(68,17,31,.38)" : "rgba(10,57,43,.48)" }}><img alt="" src={refreshIconUrl} style={{ ...iconStyle(23), ...(fullScan === undefined ? { filter: "brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(2856%) hue-rotate(324deg) brightness(102%) contrast(101%)" } : { filter: "brightness(0) saturate(100%) invert(76%) sepia(82%) saturate(465%) hue-rotate(93deg) brightness(94%) contrast(95%)" }) }} /><div><div style={{ color: fullScan === undefined ? "#ffb3bd" : "#a9e9c6", fontSize: 7 }}>Last Full Scan</div><div style={{ color: fullScan === undefined ? "#ff7182" : "#72e0a8", fontSize: 9, fontWeight: 850 }}>{fullScan?.date ?? "Never"}</div><div style={{ color: fullScan === undefined ? "#ffb3bd" : "#a9e9c6", fontSize: 7 }}>{fullScan?.time ?? "Library not scanned"}</div></div></div></div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing-steam" ? "Refreshing Steam & SteamHunters…" : "Refresh Steam & SteamHunters"} disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshSteamAndSteamHunters(); }} /><ActionRow onGamepadDirection={handleColumnDirection} icon={databaseIconUrl} title={operation === "refreshing-library" ? "Refreshing Steam Library…" : "Refresh Steam Library"} subtitle="Runs a full library scan" disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshLibrary(); }} /><ActionRow onGamepadDirection={handleColumnDirection} danger icon={trashIconUrl} title={armedAction === "clear" ? "Press again to clear cached data" : "Clear Cached Data"} onActivate={() => { if (armedAction === "clear") clearCache(); else setArmedAction("clear"); }} /></div>{operationMessage !== undefined ? <div style={{ marginTop: 5, color: operation === "error" ? "#ff7182" : "#74dba1", fontSize: 7, textAlign: "center" }}>{operationMessage}</div> : null}</div>
        <div style={{ ...cardStyle, padding: 8 }}><Heading>DANGEROUS ZONE</Heading><div style={{ marginTop: 6 }}><ActionRow onGamepadDirection={handleColumnDirection} danger icon={refreshIconUrl} title={armedAction === "reset" ? "Press again to reset Steam data" : "Reset Steam Data"} subtitle="Clear cache, local data, and Steam settings" onActivate={() => { if (armedAction === "reset") void resetSteamData(); else setArmedAction("reset"); }} /></div></div>
      </div>
    </div>
  </div>{showSteamProfileFooter && onOpenActivity !== undefined && onOpenProfile !== undefined ? <DeckyFullScreenFooterOverlay activeNavigationItemId="settings" ariaLabel="Steam profile navigation" navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS} onBack={onBack} onPreviousNavigationItem={onOpenActivity} onNextNavigationItem={onOpenProfile} /> : null}</div>;
}
