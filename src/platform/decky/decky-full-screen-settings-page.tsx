import { Focusable, GamepadButton, Menu, MenuItem, showContextMenu, type GamepadEvent } from "@decky/ui";
import { ACTIVITY_CALENDAR_WEEK_OPTIONS, type ActivityCalendarWeeks } from "@core/settings";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../providers/steam/config";
import { loadDeckyDashboardState, refreshDeckySteamHuntersProfileState, runDeckySteamFullLibraryScan } from "./decky-app-services";
import { DeckyCredentialTextField, getDeckyCredentialTextFieldMaskStyle } from "./decky-credential-text-field";
import { clearDeckyDashboardSnapshot } from "./decky-dashboard-snapshot-cache";
import { DeckyFullScreenFooterOverlay, isDeckyFullscreenOnScreenKeyboardOpen, markDeckyFullscreenOnScreenKeyboardOpen, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS, useDeckyFullscreenOnScreenKeyboardLifecycle } from "./decky-full-screen-footer-overlay";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { clearDeckySteamGameDetailCache } from "./decky-steam-game-detail-cache";
import { removeDeckyStorageTextsByPrefix } from "./storage";
import { clearDeckySteamLibraryAchievementScanSummary, clearDeckySteamProviderConfig, useDeckySteamLibraryAchievementScanSummary, useDeckySteamProviderConfig } from "./providers/steam";
import { writeValidatedDeckySteamProviderConfig } from "./providers/steam/config";
import { getSteamApiKeyInputDescriptor, getSteamCredentialsFieldSpecs } from "./providers/steam/credentials-help";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";
import infoIconUrl from "./assets/info.svg";
import refreshIconUrl from "./assets/refresh.svg";
import usersIconUrl from "./assets/users.svg";
import calendarIconUrl from "./assets/calendar.svg";
import caretDownIconUrl from "./assets/caret-down.svg";
import checkCircleIconUrl from "./assets/check-circle.svg";
import lockIconUrl from "./assets/unlocked-lock.svg";
import brandSecondaryLogoUrl from "./assets/brand/AC_secondary_logo.png";
import { steamTheme, steamRecipes } from "./steam-theme";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { DeckyFocusStyles, DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";
import { DeckyUpdateSettingsPanel } from "./decky-update-settings-panel";

const RELEASES_URL = "https://github.com/parvagans/achievement-companion/releases";
const REPOSITORY_URL = "https://github.com/parvagans/achievement-companion";
const ISSUES_URL = "https://github.com/parvagans/achievement-companion/issues";
const RECENT_CACHE_PREFIX = "achievement-companion:decky:recent-achievements";

type OperationState = "idle" | "refreshing-steam" | "refreshing-library" | "steam-refreshed" | "library-refreshed" | "cleared" | "reset" | "error";
type SteamSettingsSection = "account" | "fullscreen" | "updates";

export interface DeckyFullScreenSettingsPageProps {
  readonly isActive?: boolean;
  /** Retained for the separate provider-settings route; Steam Settings no longer launches it. */
  readonly onOpenProviderSettings: (providerId: string) => void;
  readonly onOpenExternalUrl: (url: string) => void;
  readonly onOpenActivity?: () => void;
  readonly onOpenProfile?: () => void;
  readonly showSteamProfileFooter?: boolean;
  /** Reserve the shared Steam profile footer when its retained-session parent owns rendering it. */
  readonly reserveSteamProfileFooter?: boolean;
}

function Styles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const document = anchorRef.current?.ownerDocument;
    if (document === undefined) return;
    const style = document.createElement("style");
    style.textContent = `.ac-settings-action{outline:none!important}.ac-settings-action.gpfocus,.ac-settings-action.gpfocuswithin,.ac-settings-action:focus,.ac-settings-action:focus-within{border-color:${steamTheme.focus.border}!important;box-shadow:${steamTheme.focus.shadow}!important;background:${steamTheme.focus.background}!important}.ac-steam-settings-page [data-settings-column=right] .Panel.Focusable[role=button]{min-height:30px!important}.ac-steam-settings-input{min-height:0!important;margin:0!important}.ac-steam-settings-input,.ac-steam-settings-input *{font-size:${steamTheme.type.fullscreen.caption}px!important;line-height:1.1!important}.ac-steam-settings-input [class*="DialogInput"]{min-height:0!important;margin:0!important;padding-block:0!important}
    .ac-steam-settings-page .ac-steam-settings-input input{height:22px!important;min-height:22px!important;padding:2px 7px!important}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

const iconStyle = (size = 22): CSSProperties => ({ width: size, height: size, objectFit: "contain", filter: steamTheme.iconFilter.accent, flexShrink: 0 });
const cardStyle: CSSProperties = { ...steamRecipes.card("fullscreen"), padding: undefined };

function Heading({ children }: { readonly children: ReactNode }): JSX.Element {
  const label = children === "DATA & SYNC" ? "STEAM DATA & SYNC" : children;
  return <div style={{ color: steamTheme.color.textSecondary, fontSize: 10, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".14em", lineHeight: 1.2 }}>{label}</div>;
}

function Logo(): JSX.Element {
  return <img alt="Achievement Companion" src={brandSecondaryLogoUrl} style={{ display: "block", width: 48, height: 48, flex: "0 0 auto", objectFit: "contain" }} />;
}

function ActionRow({ title, subtitle, metadata, icon, onActivate, danger = false, success = false, disabled = false, onGamepadDirection }: { readonly title: string; readonly subtitle?: string; readonly metadata?: string; readonly icon: string; readonly onActivate?: () => void; readonly danger?: boolean; readonly success?: boolean; readonly disabled?: boolean; readonly onGamepadDirection?: (event: GamepadEvent) => void }): JSX.Element {
  const interactive = onActivate !== undefined && !disabled;
  const accent = danger ? steamTheme.color.danger : success ? steamTheme.color.success : steamTheme.color.textPrimary;
  const subtitleColor = danger ? steamTheme.status.danger.text : success ? steamTheme.status.success.text : steamTheme.color.textSecondary;
  const iconFilter = danger
    ? steamTheme.iconFilter.danger
    : success
      ? steamTheme.iconFilter.success
      : undefined;
  const borderColor = danger ? steamTheme.status.danger.border : success ? steamTheme.status.success.border : steamTheme.color.borderSubtle;
  const background = danger ? steamTheme.status.danger.surface : success ? steamTheme.status.success.surface : steamTheme.surface.interactive;
  return <Focusable className="ac-settings-action" noFocusRing aria-label={title} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1} {...(interactive ? { role: "button" as const, onActivate, onClick: onActivate, onGamepadDirection } : {})} style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 30, padding: "4px 9px", boxSizing: "border-box", border: `1px solid ${borderColor}`, borderRadius: steamTheme.radius.small, background, color: accent, opacity: disabled ? .56 : 1 }}>
    <img alt="" aria-hidden="true" src={icon} style={{ ...iconStyle(17), ...(iconFilter !== undefined ? { filter: iconFilter } : {}) }} />
    <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: metadata === undefined ? "normal" : "nowrap", fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.strong, lineHeight: 1.05 }}>{title}</div>{subtitle !== undefined ? <div style={{ marginTop: 1, color: subtitleColor, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.05 }}>{subtitle}</div> : null}</div>
    {metadata !== undefined ? <span style={{ flexShrink: 0, color: subtitleColor, fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.medium, whiteSpace: "nowrap" }}>{metadata}</span> : null}
    {interactive ? <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={{ ...iconStyle(15), opacity: .85 }} /> : null}
  </Focusable>;
}

function SteamSettingsSectionPill({ title, icon, selected, initialFocusRef, onSelect, onGamepadDirection }: { readonly title: string; readonly icon: string; readonly selected: boolean; readonly initialFocusRef?: React.Ref<HTMLDivElement>; readonly onSelect: () => void; readonly onGamepadDirection: (event: GamepadEvent) => void }): JSX.Element {
  const [focused, setFocused] = useState(false);
  return <Focusable ref={initialFocusRef} className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} noFocusRing role="button" aria-pressed={selected} aria-label={`${title}, ${selected ? "selected" : "not selected"}`} tabIndex={0} onActivate={onSelect} onClick={onSelect} onGamepadDirection={onGamepadDirection} onFocus={() => setFocused(true)} onGamepadFocus={() => setFocused(true)} onBlur={() => setFocused(false)} data-settings-section-pill="true" style={{ ...getSteamCompactAchievementFilterStyle(selected, focused), flex: "1 1 0", width: "auto", minHeight: 28, padding: "4px 8px", gap: 7, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", overflowWrap: "normal" }}>
    <img alt="" aria-hidden="true" src={icon} style={iconStyle(16)} />
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
  </Focusable>;
}

function SteamSettingsContent({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div data-settings-section-content style={{ ...cardStyle, padding: "7px 12px", display: "flex", flex: "1 1 auto", flexDirection: "column", gap: 4, minHeight: 0, overflow: "hidden" }}>{children}</div>;
}

function SteamActivityCalendarWeeksPicker({ value, onChange, onGamepadDirection }: {
  readonly value: ActivityCalendarWeeks;
  readonly onChange: (value: ActivityCalendarWeeks) => void;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu> | undefined>(undefined);
  const unregisterCancelRef = useRef<(() => void) | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = (): void => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    unregisterCancelRef.current?.();
    unregisterCancelRef.current = undefined;
    setMenuOpen(false);
  };
  const openMenu = (): void => {
    if (menuRef.current !== undefined || triggerRef.current === null) return;
    setMenuOpen(true);
    menuRef.current = showContextMenu(
      <Menu label="Activity Calendar weeks" onCancel={closeMenu}>
        {ACTIVITY_CALENDAR_WEEK_OPTIONS.map((option) => (
          <MenuItem key={option} selected={value === option} onClick={() => { onChange(option); closeMenu(); }}>
            {`${option} weeks`}
          </MenuItem>
        ))}
      </Menu>,
      triggerRef.current,
      { bModal: true, bMatchWidth: true },
    );
    unregisterCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
  };
  useEffect(() => closeMenu, []);
  return <Focusable
    ref={triggerRef}
    className="ac-settings-action"
    noFocusRing
    role="button"
    tabIndex={0}
    aria-expanded={menuOpen}
    aria-label={`Activity Calendar: ${value} weeks`}
    onActivate={openMenu}
    onClick={openMenu}
    onGamepadDirection={onGamepadDirection}
    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 36, padding: "5px 9px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.interactive }}
  >
    <span style={{ minWidth: 0, fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.strong }}>Activity Calendar</span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, color: steamTheme.color.accent, fontSize: 10, fontWeight: 800 }}><span>{`${value} weeks`}</span><img alt="" src={caretDownIconUrl} style={iconStyle(12)} /></span>
  </Focusable>;
}

function formatSyncTime(timestamp: number | undefined): { readonly date: string; readonly time: string } {
  if (timestamp === undefined) return { date: "Never", time: "Not synced" };
  const date = new Date(timestamp);
  return { date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), time: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) };
}

function CredentialStatusLabel({ label, valid }: { readonly label: string; readonly valid: boolean }): JSX.Element {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
    <span>{label}</span>
    <img
      alt={valid ? "Valid" : "Not configured"}
      src={valid ? checkCircleIconUrl : lockIconUrl}
      style={{ ...iconStyle(13), filter: valid ? steamTheme.iconFilter.success : steamTheme.iconFilter.danger }}
    />
  </span>;
}

function SteamAccountFields({ config, onSaved }: { readonly config: SteamProviderConfig | undefined; readonly onSaved: (message: string, isError: boolean) => void }): JSX.Element {
  const fields = getSteamCredentialsFieldSpecs(); const apiKeyDescriptor = getSteamApiKeyInputDescriptor(config?.hasApiKey === true);
  const [steamId64, setSteamId64] = useState(config?.steamId64 ?? ""); const [apiKeyDraft, setApiKeyDraft] = useState(""); const [language, setLanguage] = useState(config?.language ?? "english"); const [saving, setSaving] = useState(false);
  useEffect(() => { setSteamId64(config?.steamId64 ?? ""); setApiKeyDraft(""); setLanguage(config?.language ?? "english"); }, [config?.hasApiKey, config?.language, config?.steamId64]);
  const save = async (): Promise<void> => { setSaving(true); try { const result = await writeValidatedDeckySteamProviderConfig({ steamId64, language, recentAchievementsCount: config?.recentAchievementsCount ?? 5, recentlyPlayedCount: config?.recentlyPlayedCount ?? 5, includePlayedFreeGames: config?.includePlayedFreeGames ?? false }, apiKeyDraft); onSaved(result.userMessage, !result.saved); } catch { onSaved("Unable to save Steam account settings.", true); } finally { setSaving(false); } };
  const inputStyle: CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box" };
  const steamId64Valid = /^\d{17}$/u.test(steamId64.trim());
  const apiKeyValid = apiKeyDraft.trim().length === 0 ? config?.hasApiKey === true : /^[0-9a-f]{32}$/iu.test(apiKeyDraft.trim());
  return <>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={<CredentialStatusLabel label={fields.steamId64.label} valid={steamId64Valid} />} value={steamId64} onClick={(event) => markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)} onChange={(event) => setSteamId64(event.currentTarget.value)} style={inputStyle} /></div>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={<CredentialStatusLabel label={fields.apiKey.label} valid={apiKeyValid} />} value={apiKeyDraft} {...apiKeyDescriptor} description={undefined} onClick={(event) => markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)} style={{ ...inputStyle, ...getDeckyCredentialTextFieldMaskStyle() }} onChange={(event) => setApiKeyDraft(event.currentTarget.value)} /></div>
    <div className="ac-steam-settings-input"><DeckyCredentialTextField label={fields.language.label} value={language} onClick={(event) => markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument)} onChange={(event) => setLanguage(event.currentTarget.value)} style={inputStyle} /></div>
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 7px", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.interactive }}><img alt="" src={infoIconUrl} style={iconStyle(17)} /><div style={{ minWidth: 0, color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption, lineHeight: 1.2 }}>SteamID64: steamid.io · Web API key: steamcommunity.com/dev/apikey.</div></div>
    <Focusable className="ac-settings-action" noFocusRing role="button" aria-label="Save Steam account settings" aria-disabled={saving} tabIndex={saving ? -1 : 0} onActivate={() => { void save(); }} onClick={() => { void save(); }} style={{ alignSelf: "flex-end", padding: "3px 9px", borderRadius: steamTheme.radius.pill, border: "1px solid rgba(56,177,241,.55)", background: "rgba(11,80,121,.6)", color: steamTheme.color.textPrimary, fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.strong }}>{saving ? "Saving…" : "Save account settings"}</Focusable>
  </>;
}

export function DeckyFullScreenSettingsPage({ isActive = true, onOpenExternalUrl, onOpenActivity, onOpenProfile, showSteamProfileFooter = false, reserveSteamProfileFooter = false }: DeckyFullScreenSettingsPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null); const initialFocusRef = useRef<HTMLDivElement>(null);
  const settings = useDeckySettings();
  const [selectedSection, setSelectedSection] = useState<SteamSettingsSection>("account"); const [accountMessage, setAccountMessage] = useState<{ readonly message: string; readonly isError: boolean }>();
  const handleColumnDirection = (event: GamepadEvent): void => { const button = event.detail.button; const isVertical = button === GamepadButton.DIR_UP || button === GamepadButton.DIR_DOWN; const isHorizontal = button === GamepadButton.DIR_LEFT || button === GamepadButton.DIR_RIGHT; if (!isVertical && !isHorizontal) return; if (isHorizontal && event.detail.is_repeat === true) return; const page = pageRef.current; const active = page?.ownerDocument.activeElement; const HTMLElementConstructor = page?.ownerDocument.defaultView?.HTMLElement; if (page === null || page === undefined || HTMLElementConstructor === undefined || !(active instanceof HTMLElementConstructor)) return; if (isHorizontal && active.matches("[data-settings-section-pill]")) { const pills = [...page.querySelectorAll<HTMLElement>("[data-settings-section-pill]")]; const index = pills.indexOf(active); const nextIndex = button === GamepadButton.DIR_LEFT ? index - 1 : index + 1; if (nextIndex >= 0 && nextIndex < pills.length) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); const nextPill = pills[nextIndex]; if (nextPill !== undefined && takeDeckySteamGamepadFocus(nextPill)) playDeckySteamNavigationSound(page.ownerDocument); return; } if (button === GamepadButton.DIR_LEFT) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); return; } } const sourceId = active.closest<HTMLElement>("[data-settings-column]")?.dataset["settingsColumn"]; const destinationId = isVertical ? sourceId : sourceId === "left" ? "right" : sourceId === "right" ? "left" : undefined; if (destinationId === undefined) return; const destination = page.querySelector<HTMLElement>(`[data-settings-column="${destinationId}"]`); if (destination === null) return; const activeBounds = active.getBoundingClientRect(); const activeCenter = activeBounds.top + activeBounds.height / 2; const targets = [...destination.querySelectorAll<HTMLElement>(".Panel.Focusable[role='button']:not([aria-disabled='true']), .Panel.Focusable[role='switch']:not([aria-disabled='true']), input:not([disabled]), textarea:not([disabled]), [contenteditable='true']")]; const target = targets.reduce<{ readonly element: HTMLElement; readonly distance: number } | undefined>((closest, candidate) => { if (candidate === active) return closest; const bounds = candidate.getBoundingClientRect(); const delta = bounds.top + bounds.height / 2 - activeCenter; if (isVertical && (button === GamepadButton.DIR_UP ? delta >= 0 : delta <= 0)) return closest; const distance = Math.abs(delta); return closest === undefined || distance < closest.distance ? { element: candidate, distance } : closest; }, undefined)?.element; if (target === undefined) return; event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); const moved = takeDeckySteamGamepadFocus(target); if (!moved && (target.matches("input, textarea") || target.isContentEditable)) target.focus(); if (moved || page.ownerDocument.activeElement === target) { scrollDeckyFocusTargetIntoView(target); playDeckySteamNavigationSound(page.ownerDocument); } };
  useDeckyFullscreenOnScreenKeyboardLifecycle(pageRef);
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
  useLayoutEffect(() => { if (!isActive) return; const page = pageRef.current; const ownerWindow = page?.ownerDocument.defaultView; if (page === null || page === undefined || ownerWindow === null || ownerWindow === undefined) return; const frame = ownerWindow.requestAnimationFrame(() => { if (!page.contains(page.ownerDocument.activeElement)) takeDeckySteamGamepadFocus(initialFocusRef.current); }); return () => ownerWindow.cancelAnimationFrame(frame); }, [isActive]);
  const refreshSteamAndSteamHunters = async (): Promise<void> => { setOperation("refreshing-steam"); const steamId64 = steamConfig?.steamId64.trim(); try { const [dashboard] = await Promise.all([loadDeckyDashboardState(STEAM_PROVIDER_ID, { forceRefresh: true }), steamId64 === undefined || steamId64.length === 0 ? Promise.resolve(undefined) : refreshDeckySteamHuntersProfileState(steamId64).catch(() => undefined)]); setOperation(dashboard.data !== undefined && dashboard.error === undefined ? "steam-refreshed" : "error"); } catch { setOperation("error"); } };
  const refreshLibrary = async (): Promise<void> => { setOperation("refreshing-library"); try { const summary = await runDeckySteamFullLibraryScan(); setOperation(summary !== undefined ? "library-refreshed" : "error"); } catch { setOperation("error"); } };
  const clearCache = (): void => { clearDeckyDashboardSnapshot(STEAM_PROVIDER_ID); clearDeckySteamGameDetailCache(); clearDeckySteamLibraryAchievementScanSummary(); removeDeckyStorageTextsByPrefix(RECENT_CACHE_PREFIX); setArmedAction(undefined); setOperation("cleared"); };
  const resetSteamData = async (): Promise<void> => { clearCache(); const cleared = await clearDeckySteamProviderConfig(); setArmedAction(undefined); setOperation(cleared ? "reset" : "error"); };
  const operationMessage = operation === "steam-refreshed" ? "Steam and SteamHunters refreshed" : operation === "library-refreshed" ? "Full Steam library scan completed" : operation === "cleared" ? "Steam cached data cleared" : operation === "reset" ? "Steam settings reset" : operation === "error" ? "The operation could not be completed" : undefined;
  const steamConnected = steamConfig?.hasApiKey === true;
  const fullScanAt = steamScan?.scannedAt;
  const parsedFullScanAt = fullScanAt === undefined ? Number.NaN : Date.parse(fullScanAt);
  const fullScan = Number.isFinite(parsedFullScanAt) ? formatSyncTime(parsedFullScanAt) : undefined;
  const updateFullscreenCalendarWeeks = (steamFullscreenActivityCalendarWeeks: ActivityCalendarWeeks): void => {
    void saveDeckySettings({ ...readDeckySettings(), steamFullscreenActivityCalendarWeeks });
  };
  return <div ref={pageRef} className="ac-steam-settings-page" data-ac-steam-theme="fullscreen" style={{ position: "relative", height: "100vh", minHeight: 0, overflow: "hidden", padding: `calc(env(safe-area-inset-top, 0px) + 43px) 12px ${showSteamProfileFooter || reserveSteamProfileFooter ? 50 : 10}px`, boxSizing: "border-box", color: steamTheme.color.textPrimary, background: steamTheme.surface.page }}><Styles /><DeckyFocusStyles /><div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", minHeight: 31 }}><Heading>STEAM SETTINGS</Heading></div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.9fr) minmax(270px,.95fr)", gap: 10, minHeight: 0, flex: "1 1 auto" }}>
      <div data-settings-column="left" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden", paddingBottom: steamTheme.space.sm, boxSizing: "border-box" }}>
        <Focusable flow-children="left-right" noFocusRing tabIndex={-1} data-settings-section-tabs="true" style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flex: "0 0 auto" }}>
          <SteamSettingsSectionPill title="Account" icon={usersIconUrl} selected={selectedSection === "account"} initialFocusRef={initialFocusRef} onSelect={() => setSelectedSection("account")} onGamepadDirection={handleColumnDirection} />
          <SteamSettingsSectionPill title="Full-Screen Settings" icon={calendarIconUrl} selected={selectedSection === "fullscreen"} onSelect={() => setSelectedSection("fullscreen")} onGamepadDirection={handleColumnDirection} />
          <SteamSettingsSectionPill title="Updates" icon={refreshIconUrl} selected={selectedSection === "updates"} onSelect={() => setSelectedSection("updates")} onGamepadDirection={handleColumnDirection} />
        </Focusable>
        {selectedSection === "account" ? <SteamSettingsContent><SteamAccountFields config={steamConfig} onSaved={(message, isError) => setAccountMessage({ message, isError })} />{accountMessage !== undefined ? <div style={{ color: accountMessage.isError ? steamTheme.color.danger : steamTheme.color.success, fontSize: steamTheme.type.fullscreen.caption, textAlign: "right" }}>{accountMessage.message}</div> : null}</SteamSettingsContent> : null}
        {selectedSection === "fullscreen" ? <SteamSettingsContent><SteamActivityCalendarWeeksPicker value={settings.steamFullscreenActivityCalendarWeeks} onChange={updateFullscreenCalendarWeeks} onGamepadDirection={handleColumnDirection} /></SteamSettingsContent> : null}
        {selectedSection === "updates" ? <DeckyUpdateSettingsPanel onGamepadDirection={handleColumnDirection} /> : null}
      </div>
      <div data-settings-column="right" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden", justifyContent: "flex-start", paddingBottom: steamTheme.space.sm, boxSizing: "border-box" }}>
        <div style={{ ...cardStyle, padding: 10 }}><Heading>ABOUT</Heading><div style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 43, padding: "2px 3px 5px" }}><Logo /><div><div style={{ fontSize: steamTheme.type.fullscreen.caption, fontWeight: steamTheme.type.weight.strong }}>Achievement Companion</div></div></div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="Changelog" onActivate={() => onOpenExternalUrl(RELEASES_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={externalLinkIconUrl} title="GitHub" onActivate={() => onOpenExternalUrl(REPOSITORY_URL)} /><ActionRow onGamepadDirection={handleColumnDirection} icon={infoIconUrl} title="Report Issue" onActivate={() => onOpenExternalUrl(ISSUES_URL)} /></div></div>
        <div style={{ ...cardStyle, padding: 10 }}><Heading>DATA &amp; SYNC</Heading><div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 7 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing-steam" ? "Refreshing Steam & SteamHunters…" : "Refresh Steam & SteamHunters"} disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshSteamAndSteamHunters(); }} /><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing-library" ? "Running Full Library Scan…" : "Full Library Scan"} metadata={operation === "refreshing-library" ? "Scanning…" : fullScan === undefined ? "Never" : `${fullScan.date} · ${fullScan.time}`} success={fullScan !== undefined} danger={fullScan === undefined} disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshLibrary(); }} /></div>{operationMessage !== undefined ? <div style={{ marginTop: 5, color: operation === "error" ? steamTheme.color.danger : steamTheme.color.success, fontSize: steamTheme.type.fullscreen.caption, textAlign: "center" }}>{operationMessage}</div> : null}</div>
        <div data-settings-danger-zone style={{ ...cardStyle, padding: 10, flex: "1 1 auto" }}><Heading>DANGEROUS ZONE</Heading><div style={{ marginTop: 7 }}><ActionRow onGamepadDirection={handleColumnDirection} danger icon={refreshIconUrl} title={armedAction === "reset" ? "Press again to reset Steam data" : "Reset Steam Data"} subtitle="Clear cache, local data, and Steam settings" onActivate={() => { if (armedAction === "reset") void resetSteamData(); else setArmedAction("reset"); }} /></div></div>
      </div>
    </div>
  </div>{showSteamProfileFooter && onOpenActivity !== undefined && onOpenProfile !== undefined ? <DeckyFullScreenFooterOverlay isActive={isActive} activeNavigationItemId="settings" ariaLabel="Steam profile navigation" navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS} onPreviousNavigationItem={onOpenActivity} onNextNavigationItem={onOpenProfile} /> : null}</div>;
}
