import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../providers/steam/config";
import { loadDeckyDashboardState, refreshDeckySteamHuntersProfileState, runDeckySteamFullLibraryScan } from "./decky-app-services";
import { DeckyCredentialTextField, getDeckyCredentialTextFieldMaskStyle } from "./decky-credential-text-field";
import { clearDeckyDashboardSnapshot } from "./decky-dashboard-snapshot-cache";
import { clearDeckyFullscreenOnScreenKeyboardOpen, DeckyFullScreenFooterOverlay, isDeckyFullscreenOnScreenKeyboardOpen, markDeckyFullscreenOnScreenKeyboardOpen, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS } from "./decky-full-screen-footer-overlay";
import { clearDeckySteamGameDetailCache } from "./decky-steam-game-detail-cache";
import { removeDeckyStorageTextsByPrefix } from "./storage";
import { clearDeckySteamLibraryAchievementScanSummary, clearDeckySteamProviderConfig, useDeckySteamLibraryAchievementScanSummary, useDeckySteamProviderConfig } from "./providers/steam";
import { writeValidatedDeckySteamProviderConfig } from "./providers/steam/config";
import { STEAM_CREDENTIAL_HELPER_COPY, getSteamApiKeyInputDescriptor, getSteamCredentialsFieldSpecs } from "./providers/steam/credentials-help";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import infoIconUrl from "./assets/info.svg";
import refreshIconUrl from "./assets/refresh.svg";
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

export interface DeckyFullScreenSettingsPageProps {
  readonly onBack: () => void;
  readonly isActive?: boolean;
  /** Retained for the separate provider-settings route; Steam Settings no longer launches it. */
  readonly onOpenProviderSettings: (providerId: string) => void;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly onOpenActivity?: () => void;
  readonly onOpenProfile?: () => void;
  readonly showSteamProfileFooter?: boolean;
}

function Styles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const document = anchorRef.current?.ownerDocument;
    if (document === undefined) return;
    const style = document.createElement("style");
    style.textContent = `.ac-settings-action{outline:none!important}.ac-settings-action.gpfocus,.ac-settings-action.gpfocuswithin,.ac-settings-action:focus,.ac-settings-action:focus-within{border-color:#25bfff!important;box-shadow:0 0 0 2px rgba(37,191,255,.78),0 0 18px rgba(20,151,229,.35),inset 0 0 0 1px rgba(255,255,255,.12)!important;background:linear-gradient(180deg,rgba(27,77,109,.88),rgba(12,43,64,.94))!important}[data-settings-column=right] .Panel.Focusable[role=button]{min-height:30px!important}.ac-steam-settings-input{min-height:0!important;margin:0!important}.ac-steam-settings-input,.ac-steam-settings-input *{font-size:10px!important;line-height:1.1!important}.ac-steam-settings-input [class*="DialogInput"]{min-height:0!important;margin:0!important;padding-block:0!important}
    input{height:22px!important;min-height:22px!important;padding:2px 7px!important}`;
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

function ActionRow({ title, subtitle, icon, onActivate, danger = false, success = false, disabled = false, onGamepadDirection }: { readonly title: string; readonly subtitle?: string; readonly icon: string; readonly onActivate?: () => void; readonly danger?: boolean; readonly success?: boolean; readonly disabled?: boolean; readonly onGamepadDirection?: (event: GamepadEvent) => void }): JSX.Element {
  const interactive = onActivate !== undefined && !disabled;
  const accent = danger ? "#ff6075" : success ? "#72e0a8" : "#eef8ff";
  const subtitleColor = danger ? "#ffc0c8" : success ? "#a9e9c6" : "#a8bed0";
  const iconFilter = danger
    ? "brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(2856%) hue-rotate(324deg) brightness(102%) contrast(101%)"
    : success
      ? "brightness(0) saturate(100%) invert(76%) sepia(82%) saturate(465%) hue-rotate(93deg) brightness(94%) contrast(95%)"
      : undefined;
  const borderColor = danger ? "rgba(255,67,91,.5)" : success ? "rgba(49,226,142,.55)" : "rgba(91,165,213,.18)";
  const background = danger ? "linear-gradient(90deg,rgba(89,17,31,.56),rgba(57,15,27,.45))" : success ? "rgba(10,57,43,.48)" : "rgba(12,35,51,.76)";
  return <Focusable className="ac-settings-action" noFocusRing aria-label={title} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1} {...(interactive ? { role: "button" as const, onActivate, onClick: onActivate, onGamepadDirection } : {})} style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 30, padding: "4px 9px", boxSizing: "border-box", border: `1px solid ${borderColor}`, borderRadius: 7, background, color: accent, opacity: disabled ? .56 : 1 }}>
    <img alt="" aria-hidden="true" src={icon} style={{ ...iconStyle(17), ...(iconFilter !== undefined ? { filter: iconFilter } : {}) }} />
    <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ fontSize: 8.5, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>{subtitle !== undefined ? <div style={{ marginTop: 1, color: subtitleColor, fontSize: 7, lineHeight: 1.05 }}>{subtitle}</div> : null}</div>
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

function SteamAccountFields({ config, onSaved }: { readonly config: SteamProviderConfig | undefined; readonly onSaved: (message: string, isError: boolean) => void }): JSX.Element {
  const fields = getSteamCredentialsFieldSpecs(); const apiKeyDescriptor = getSteamApiKeyInputDescriptor(config?.hasApiKey === true);
  const [steamId64, setSteamId64] = useState(config?.steamId64 ?? ""); const [apiKeyDraft, setApiKeyDraft] = useState(""); const [language, setLanguage] = useState(config?.language ?? "english"); const [saving, setSaving] = useState(false);
  useEffect(() => { setSteamId64(config?.steamId64 ?? ""); setApiKeyDraft(""); setLanguage(config?.language ?? "english"); }, [config?.hasApiKey, config?.language, config?.steamId64]);
  const save = async (): Promise<void> => { setSaving(true); try { const result = await writeValidatedDeckySteamProviderConfig({ steamId64, language, recentAchievementsCount: config?.recentAchievementsCount ?? 5, recentlyPlayedCount: config?.recentlyPlayedCount ?? 5, includePlayedFreeGames: config?.includePlayedFreeGames ?? false }, apiKeyDraft); onSaved(result.userMessage, !result.saved); } catch { onSaved("Unable to save Steam account settings.", true); } finally { setSaving(false); } };
  const inputStyle: CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box" };
  return <>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={fields.steamId64.label} description={fields.steamId64.description} value={steamId64} onClick={(event) => markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)} onChange={(event) => setSteamId64(event.currentTarget.value)} style={inputStyle} /></div>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={fields.apiKey.label} value={apiKeyDraft} {...apiKeyDescriptor} onClick={(event) => markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)} style={{ ...inputStyle, ...getDeckyCredentialTextFieldMaskStyle() }} onChange={(event) => setApiKeyDraft(event.currentTarget.value)} /></div>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={fields.language.label} description={fields.language.description} value={language} onClick={(event) => markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)} onChange={(event) => setLanguage(event.currentTarget.value)} style={inputStyle} /></div>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 7px", border: "1px solid rgba(51,145,197,.24)", borderRadius: 7, background: "rgba(9,39,58,.72)" }}><img alt="" src={infoIconUrl} style={iconStyle(20)} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 850 }}>Setup help</div><div style={{ marginTop: 1, color: "#aec4d5", fontSize: 9, lineHeight: 1.2 }}>{STEAM_CREDENTIAL_HELPER_COPY}</div></div></div>
    <Focusable className="ac-settings-action" noFocusRing role="button" aria-label="Save Steam account settings" aria-disabled={saving} tabIndex={saving ? -1 : 0} onActivate={() => { void save(); }} onClick={() => { void save(); }} style={{ alignSelf: "flex-end", padding: "3px 9px", borderRadius: 999, border: "1px solid rgba(56,177,241,.55)", background: "rgba(11,80,121,.6)", color: "#e9f8ff", fontSize: 7, fontWeight: 850 }}>{saving ? "Saving…" : "Save account settings"}</Focusable>
  </>;
}

export function DeckyFullScreenSettingsPage({ onBack, isActive = true, onOpenExternalUrl, onOpenActivity, onOpenProfile, showSteamProfileFooter = false }: DeckyFullScreenSettingsPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null); const initialFocusRef = useRef<HTMLDivElement>(null);
  const [accountExpanded, setAccountExpanded] = useState(true); const [accountMessage, setAccountMessage] = useState<{ readonly message: string; readonly isError: boolean }>();
  const handleColumnDirection = (event: GamepadEvent): void => { const button = event.detail.button; const isVertical = button === GamepadButton.DIR_UP || button === GamepadButton.DIR_DOWN; const isHorizontal = button === GamepadButton.DIR_LEFT || button === GamepadButton.DIR_RIGHT; if (!isVertical && !isHorizontal) return; if (isHorizontal && event.detail.is_repeat === true) return; const page = pageRef.current; const active = page?.ownerDocument.activeElement; const HTMLElementConstructor = page?.ownerDocument.defaultView?.HTMLElement; if (page === null || page === undefined || HTMLElementConstructor === undefined || !(active instanceof HTMLElementConstructor)) return; const sourceId = active.closest<HTMLElement>("[data-settings-column]")?.dataset["settingsColumn"]; const destinationId = isVertical ? sourceId : sourceId === "left" ? "right" : sourceId === "right" ? "left" : undefined; if (destinationId === undefined) return; const destination = page.querySelector<HTMLElement>(`[data-settings-column="${destinationId}"]`); if (destination === null) return; const activeBounds = active.getBoundingClientRect(); const activeCenter = activeBounds.top + activeBounds.height / 2; const targets = [...destination.querySelectorAll<HTMLElement>(".Panel.Focusable[role='button']:not([aria-disabled='true']), input:not([disabled]), textarea:not([disabled]), [contenteditable='true']")]; const target = targets.reduce<{ readonly element: HTMLElement; readonly distance: number } | undefined>((closest, candidate) => { if (candidate === active) return closest; const bounds = candidate.getBoundingClientRect(); const delta = bounds.top + bounds.height / 2 - activeCenter; if (isVertical && (button === GamepadButton.DIR_UP ? delta >= 0 : delta <= 0)) return closest; const distance = Math.abs(delta); return closest === undefined || distance < closest.distance ? { element: candidate, distance } : closest; }, undefined)?.element; event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); target?.focus(); };
  useEffect(() => {
    const document = pageRef.current?.ownerDocument;
    const keyboardDismissSubscription = globalThis.SteamClient?.Input?.RegisterForUserDismissKeyboardMessages?.(() => {
      if (document !== undefined) clearDeckyFullscreenOnScreenKeyboardOpen(document);
    });
    return () => {
      keyboardDismissSubscription?.unregister();
      if (document !== undefined) clearDeckyFullscreenOnScreenKeyboardOpen(document);
    };
  }, []);
  useLayoutEffect(() => {
    const page = pageRef.current;
    const ownerWindow = page?.ownerDocument.defaultView;
    if (page === null || page === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const onButtonDown = (event: Event): void => {
      const active = page.ownerDocument.activeElement;
      if (!(active instanceof ownerWindow.HTMLInputElement) || !page.contains(active) || isDeckyFullscreenOnScreenKeyboardOpen(page.ownerDocument)) return;
      handleColumnDirection(event as GamepadEvent);
    };
    ownerWindow.addEventListener("vgp_onbuttondown", onButtonDown, true);
    return () => ownerWindow.removeEventListener("vgp_onbuttondown", onButtonDown, true);
  });
  const steamConfig = useDeckySteamProviderConfig(STEAM_PROVIDER_ID); const steamScan = useDeckySteamLibraryAchievementScanSummary(STEAM_PROVIDER_ID);
  const [operation, setOperation] = useState<OperationState>("idle"); const [armedAction, setArmedAction] = useState<"reset">();
  useLayoutEffect(() => { if (!isActive) return; const page = pageRef.current; const ownerWindow = page?.ownerDocument.defaultView; if (page === null || page === undefined || ownerWindow === null || ownerWindow === undefined) return; const frame = ownerWindow.requestAnimationFrame(() => { if (!page.contains(page.ownerDocument.activeElement)) initialFocusRef.current?.focus(); }); return () => ownerWindow.cancelAnimationFrame(frame); }, [isActive]);
  const refreshSteamAndSteamHunters = async (): Promise<void> => { setOperation("refreshing-steam"); const steamId64 = steamConfig?.steamId64.trim(); try { const [dashboard] = await Promise.all([loadDeckyDashboardState(STEAM_PROVIDER_ID, { forceRefresh: true }), steamId64 === undefined || steamId64.length === 0 ? Promise.resolve(undefined) : refreshDeckySteamHuntersProfileState(steamId64).catch(() => undefined)]); setOperation(dashboard.data !== undefined && dashboard.error === undefined ? "steam-refreshed" : "error"); } catch { setOperation("error"); } };
  const refreshLibrary = async (): Promise<void> => { setOperation("refreshing-library"); try { const summary = await runDeckySteamFullLibraryScan(); setOperation(summary !== undefined ? "library-refreshed" : "error"); } catch { setOperation("error"); } };
  const clearCache = (): void => { clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID); clearDeckySteamGameDetailCache(); clearDeckySteamLibraryAchievementScanSummary(); removeDeckyStorageTextsByPrefix(RECENT_CACHE_PREFIX); setArmedAction(undefined); setOperation("cleared"); };
  const resetSteamData = async (): Promise<void> => { clearCache(); const cleared = await clearDeckySteamProviderConfig(); setArmedAction(undefined); setOperation(cleared ? "reset" : "error"); };
  const operationMessage = operation === "steam-refreshed" ? "Steam and SteamHunters refreshed" : operation === "library-refreshed" ? "Full Steam library scan completed" : operation === "cleared" ? "Steam cached data cleared" : operation === "reset" ? "Steam settings reset" : operation === "error" ? "The operation could not be completed" : undefined;
  const steamConnected = steamConfig?.hasApiKey === true;
  const fullScanAt = steamScan?.scannedAt;
  const parsedFullScanAt = fullScanAt === undefined ? Number.NaN : Date.parse(fullScanAt);
  const fullScan = Number.isFinite(parsedFullScanAt) ? formatSyncTime(parsedFullScanAt) : undefined;
  return <div ref={pageRef} style={{ position: "relative", height: "100vh", minHeight: 0, overflow: "hidden", padding: `calc(env(safe-area-inset-top, 0px) + 43px) 12px ${showSteamProfileFooter ? 50 : 10}px`, boxSizing: "border-box", color: "#f2f7fb", background: "linear-gradient(120deg,#06111a,#071724 55%,#06121c)" }}><Styles /><div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", minHeight: 31 }}><Heading>SETTINGS</Heading></div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.9fr) minmax(270px,.95fr)", gap: 10, minHeight: 0, flex: "1 1 auto" }}>
      <div data-settings-column="left" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", minHeight: 70, padding: "4px 14px", background: "linear-gradient(90deg,rgba(9,35,52,.95),rgba(7,29,44,.9))" }}><Logo /><div style={{ alignSelf: "stretch", width: 1, margin: "5px 14px", background: "rgba(102,178,225,.25)" }} /><div style={{ minWidth: 0 }}><div style={{ color: "#b9dff4", fontSize: 7.5, fontWeight: 900, letterSpacing: ".14em" }}>STEAM SETTINGS</div><div style={{ marginTop: 3, fontSize: 16, fontWeight: 900 }}>Steam</div><div style={{ marginTop: 2, color: "#b7cad8", fontSize: 8.5, lineHeight: 1.2 }}>Manage Steam account settings on this device.</div></div></div>
        <SteamAccordion title="Account" subtitle="Manage your Steam account credentials and connection." icon={usersIconUrl} expanded={accountExpanded} initialFocusRef={initialFocusRef} onToggle={() => setAccountExpanded((value) => !value)} onGamepadDirection={handleColumnDirection}><SteamAccountFields config={steamConfig} onSaved={(message, isError) => setAccountMessage({ message, isError })} />{accountMessage !== undefined ? <div style={{ color: accountMessage.isError ? "#ff8695" : "#72e0a8", fontSize: 6.8, textAlign: "right" }}>{accountMessage.message}</div> : null}</SteamAccordion>
      </div>
      <div data-settings-column="right" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden", justifyContent: "flex-start" }}>
        <div style={{ ...cardStyle, padding: 10 }}><Heading>ABOUT</Heading><div style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 43, padding: "2px 3px 5px" }}><Logo compact /><div><div style={{ fontSize: 11, fontWeight: 850 }}>Achievement Companion</div><div style={{ marginTop: 2, color: "#a9bdcd", fontSize: 8 }}>v{VERSION}</div></div></div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="View Changelog" onActivate={() => onOpenExternalUrl(RELEASES_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="GitHub Repository" onActivate={() => onOpenExternalUrl(REPOSITORY_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={infoIconUrl} title="Report an Issue" onActivate={() => onOpenExternalUrl(ISSUES_URL)} /></div></div>
        <div style={{ ...cardStyle, padding: 10 }}><Heading>DATA &amp; SYNC</Heading><div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 7 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing-steam" ? "Refreshing Steam & SteamHunters…" : "Refresh Steam & SteamHunters"} disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshSteamAndSteamHunters(); }} /><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing-library" ? "Running Full Library Scan…" : `Last Full Scan: ${fullScan?.date ?? "Never"}`} subtitle={operation === "refreshing-library" ? "Scanning your complete owned Steam library" : fullScan === undefined ? "Select to run a full library scan" : `${fullScan.time} · Select to run a full library scan`} success={fullScan !== undefined} danger={fullScan === undefined} disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshLibrary(); }} /></div>{operationMessage !== undefined ? <div style={{ marginTop: 5, color: operation === "error" ? "#ff7182" : "#74dba1", fontSize: 7, textAlign: "center" }}>{operationMessage}</div> : null}</div>
        <div style={{ ...cardStyle, padding: 10 }}><Heading>DANGEROUS ZONE</Heading><div style={{ marginTop: 7 }}><ActionRow onGamepadDirection={handleColumnDirection} danger icon={refreshIconUrl} title={armedAction === "reset" ? "Press again to reset Steam data" : "Reset Steam Data"} subtitle="Clear cache, local data, and Steam settings" onActivate={() => { if (armedAction === "reset") void resetSteamData(); else setArmedAction("reset"); }} /></div></div>
      </div>
    </div>
  </div>{showSteamProfileFooter && onOpenActivity !== undefined && onOpenProfile !== undefined ? <DeckyFullScreenFooterOverlay isActive={isActive} activeNavigationItemId="settings" ariaLabel="Steam profile navigation" navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS} onBack={onBack} onPreviousNavigationItem={onOpenActivity} onNextNavigationItem={onOpenProfile} /> : null}</div>;
}
