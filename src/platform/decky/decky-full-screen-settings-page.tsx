import { Focusable, Menu, MenuItem, showContextMenu, type GamepadEvent } from "@decky/ui";
import { ACHIEVEMENT_COMPANION_COUNT_OPTIONS, ACTIVITY_CALENDAR_WEEK_OPTIONS, type AchievementCompanionCount, type ActivityCalendarWeeks } from "@core/settings";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { STEAM_PROVIDER_ID, type SteamProviderConfig } from "../../providers/steam/config";
import { loadDeckyDashboardState, refreshDeckySteamHuntersProfileState, runDeckySteamFullLibraryScan } from "./decky-app-services";
import { DeckyCredentialTextField, getDeckyCredentialTextFieldMaskStyle } from "./decky-credential-text-field";
import { clearDeckyDashboardSnapshot } from "./decky-dashboard-snapshot-cache";
import { DeckyFullScreenFooterOverlay, markDeckyFullscreenOnScreenKeyboardOpen, STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS, useDeckyFullscreenOnScreenKeyboardLifecycle } from "./decky-full-screen-footer-overlay";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { clearDeckySteamGameDetailCache } from "./decky-steam-game-detail-cache";
import { removeDeckyStorageTextsByPrefix } from "./storage";
import { clearDeckySteamLibraryAchievementScanSummary, clearDeckySteamProviderConfig, readDeckySteamProviderConfig, useDeckySteamLibraryAchievementScanSummary, useDeckySteamProviderConfig } from "./providers/steam";
import { writeValidatedDeckySteamProviderConfig } from "./providers/steam/config";
import { getSteamApiKeyInputDescriptor, getSteamCredentialsFieldSpecs } from "./providers/steam/credentials-help";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import infoIconUrl from "./assets/info.svg";
import refreshIconUrl from "./assets/refresh.svg";
import usersIconUrl from "./assets/users.svg";
import calendarIconUrl from "./assets/calendar.svg";
import settingsIconUrl from "./assets/settings.svg";
import databaseIconUrl from "./assets/database.svg";
import caretDownIconUrl from "./assets/caret-down.svg";
import checkCircleIconUrl from "./assets/check-circle.svg";
import lockIconUrl from "./assets/unlocked-lock.svg";
import { steamTheme, steamRecipes } from "./steam-theme";
import { requestDeckySteamGamepadFocusAfterMount, takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { DeckyFocusStyles, DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { getSteamCompactAchievementFilterStyle } from "./decky-steam-compact-action-styles";
import { DeckySettingsSection, handleDeckySettingsDirection, settingsSaveButtonStyle, settingsScrollStyle } from "./decky-settings-section";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";

const RECENT_CACHE_PREFIX = "achievement-companion:decky:recent-achievements";

type OperationState = "idle" | "refreshing-steam" | "refreshing-library" | "steam-refreshed" | "library-refreshed" | "cleared" | "reset" | "error";
type SteamSettingsSection = "account" | "fullscreen" | "compact" | "data";

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
    style.textContent = `.ac-steam-settings-page .ac-settings-action{outline:none!important}.ac-steam-settings-page .ac-settings-action:not(.gpfocus):not(.gpfocuswithin):not(:focus):not(:focus-within){box-shadow:none!important}.ac-steam-settings-page .ac-settings-action:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){border-color:${steamTheme.focus.border}!important;box-shadow:${steamTheme.focus.shadow}!important;background:${steamTheme.focus.background}!important}.ac-steam-settings-input{min-height:0!important;margin:0!important}.ac-steam-settings-input,.ac-steam-settings-input *{font-size:${steamTheme.type.fullscreen.body}px!important;line-height:1.2!important}.ac-steam-settings-input [class*="DialogInput"]{min-height:0!important;margin:0!important;padding-block:0!important}
    .ac-steam-settings-page .ac-steam-settings-input input{height:30px!important;min-height:30px!important;padding:3px 9px!important}`;
    style.textContent += `.ac-steam-settings-page .ac-settings-action[data-ac-settings-content-row="true"]:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){background:${steamTheme.surface.focusedContentStat}!important}`;
    style.textContent += `.ac-steam-settings-page .ac-settings-action[data-ac-settings-tone="danger"]:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){background:${steamTheme.status.danger.surface}!important}.ac-steam-settings-page .ac-settings-action[data-ac-settings-tone="success"]:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){background:${steamTheme.status.success.surface}!important}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

const iconStyle = (size = 22): CSSProperties => ({ width: size, height: size, objectFit: "contain", filter: steamTheme.iconFilter.accent, flexShrink: 0 });
const cardStyle: CSSProperties = { ...steamRecipes.card("fullscreen"), padding: undefined };

function Heading({ children }: { readonly children: ReactNode }): JSX.Element {
  const label = children === "DATA & SYNC" ? "STEAM DATA & SYNC" : children;
  return <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em", lineHeight: 1.3 }}>{label}</div>;
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
  const background = danger ? steamTheme.status.danger.surface : success ? steamTheme.status.success.surface : steamTheme.surface.contentStat;
  return <Focusable className="ac-settings-action" data-ac-settings-content-row={!danger && !success ? "true" : undefined} data-ac-settings-tone={danger ? "danger" : success ? "success" : undefined} noFocusRing aria-label={title} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1} {...(interactive ? { role: "button" as const, onActivate, onClick: onActivate, onGamepadDirection } : {})} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${borderColor}`, borderRadius: steamTheme.radius.small, background, color: accent, opacity: disabled ? .56 : 1 }}>
    <img alt="" aria-hidden="true" src={icon} style={{ ...iconStyle(17), ...(iconFilter !== undefined ? { filter: iconFilter } : {}) }} />
    <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: metadata === undefined ? "normal" : "nowrap", fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong, lineHeight: 1.2 }}>{title}</div>{subtitle !== undefined ? <div style={{ marginTop: 2, color: subtitleColor, fontSize: steamTheme.type.fullscreen.metadata, lineHeight: 1.2 }}>{subtitle}</div> : null}</div>
    {metadata !== undefined ? <span style={{ flexShrink: 0, color: subtitleColor, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.medium, whiteSpace: "nowrap" }}>{metadata}</span> : null}
    {interactive ? <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={{ ...iconStyle(15), opacity: .85 }} /> : null}
  </Focusable>;
}

function SteamSettingsSectionPill({ title, icon, selected, initialFocusRef, onSelect, onGamepadDirection }: { readonly title: string; readonly icon: string; readonly selected: boolean; readonly initialFocusRef?: React.Ref<HTMLDivElement>; readonly onSelect: () => void; readonly onGamepadDirection: (event: GamepadEvent) => void }): JSX.Element {
  const [focused, setFocused] = useState(false);
  return <Focusable ref={initialFocusRef} className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} noFocusRing role="button" aria-pressed={selected} aria-label={`${title}, ${selected ? "selected" : "not selected"}`} tabIndex={0} onActivate={onSelect} onClick={onSelect} onGamepadDirection={onGamepadDirection} onFocus={() => setFocused(true)} onGamepadFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onGamepadBlur={() => setFocused(false)} data-settings-section-pill="true" data-settings-provider="steam" style={{ ...getSteamCompactAchievementFilterStyle(selected, focused), flex: "1 1 0", width: "auto", minWidth: 0, minHeight: 38, padding: "7px 10px", gap: 8, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: 700, whiteSpace: "nowrap", overflowWrap: "normal" }}>
    <img alt="" aria-hidden="true" src={icon} style={iconStyle(14)} />
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
  </Focusable>;
}

function SteamSettingsContent({ children }: { readonly children: ReactNode }): JSX.Element {
  return <DeckySettingsSection>{children}</DeckySettingsSection>;
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
    data-ac-settings-content-row="true"
    noFocusRing
    role="button"
    tabIndex={0}
    aria-expanded={menuOpen}
    aria-label={`Activity Calendar: ${value} weeks`}
    onActivate={openMenu}
    onClick={openMenu}
    onGamepadDirection={onGamepadDirection}
    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat }}
  >
    <span style={{ minWidth: 0, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong }}>Activity Calendar</span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, color: steamTheme.color.accent, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: 800 }}><span>{`${value} weeks`}</span><img alt="" src={caretDownIconUrl} style={iconStyle(12)} /></span>
  </Focusable>;
}

function SteamCompactCountPicker({ label, value, disabled = false, onChange, onGamepadDirection }: {
  readonly label: string;
  readonly value: AchievementCompanionCount;
  readonly disabled?: boolean;
  readonly onChange: (value: AchievementCompanionCount) => void;
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
    if (triggerRef.current !== null) requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };
  const openMenu = (): void => {
    if (disabled || menuRef.current !== undefined || triggerRef.current === null) return;
    setMenuOpen(true);
    menuRef.current = showContextMenu(
      <Menu label={label} onCancel={closeMenu}>
        {ACHIEVEMENT_COMPANION_COUNT_OPTIONS.map((option) => (
          <MenuItem key={option} selected={value === option} onClick={() => { onChange(option); closeMenu(); }}>
            {String(option)}
          </MenuItem>
        ))}
      </Menu>,
      triggerRef.current,
      { bModal: true, bMatchWidth: true },
    );
    unregisterCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
  };
  useEffect(() => () => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    unregisterCancelRef.current?.();
    unregisterCancelRef.current = undefined;
  }, []);
  return <Focusable ref={triggerRef} className="ac-settings-action" data-ac-settings-content-row="true" noFocusRing role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-expanded={menuOpen} aria-label={`${label}: ${value}`} onActivate={openMenu} onClick={openMenu} onGamepadDirection={onGamepadDirection} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat, color: disabled ? steamTheme.color.textSecondary : steamTheme.color.textPrimary, opacity: disabled ? .65 : 1 }}>
    <span style={{ minWidth: 0, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong }}>{label}</span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, color: steamTheme.color.accent, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong }}><span>{value}</span><img alt="" src={caretDownIconUrl} style={iconStyle(12)} /></span>
  </Focusable>;
}

function SteamCompactSettings({ config, activityCalendarWeeks, onActivityCalendarWeeksChange, onGamepadDirection }: {
  readonly config: SteamProviderConfig | undefined;
  readonly activityCalendarWeeks: ActivityCalendarWeeks;
  readonly onActivityCalendarWeeksChange: (value: ActivityCalendarWeeks) => void;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  const connected = config?.hasApiKey === true;
  const settings = useDeckySettings();
  const persistProviderConfig = (changes: Partial<Pick<SteamProviderConfig, "recentAchievementsCount" | "recentlyPlayedCount">>): void => {
    const current = readDeckySteamProviderConfig(STEAM_PROVIDER_ID);
    if (current === undefined) return;
    void writeValidatedDeckySteamProviderConfig({
      steamId64: current.steamId64,
      language: current.language,
      recentAchievementsCount: changes.recentAchievementsCount ?? current.recentAchievementsCount,
      recentlyPlayedCount: changes.recentlyPlayedCount ?? current.recentlyPlayedCount,
      includePlayedFreeGames: current.includePlayedFreeGames,
    }, "");
  };
  return <SteamSettingsContent><div style={{ ...settingsScrollStyle, display: "flex", flexDirection: "column", gap: 10 }}>
    <Heading>COMPACT PROFILE</Heading>
    {!connected ? <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.caption }}>Connect a Steam account to edit compact profile content and display counts.</div> : null}
    <SteamCompactCountPicker label="Recent Activity" value={config?.recentAchievementsCount ?? settings.recentAchievementsCount} disabled={!connected} onChange={(value) => persistProviderConfig({ recentAchievementsCount: value })} onGamepadDirection={onGamepadDirection} />
    <SteamCompactCountPicker label="Recently Played" value={config?.recentlyPlayedCount ?? settings.recentlyPlayedCount} disabled={!connected} onChange={(value) => persistProviderConfig({ recentlyPlayedCount: value })} onGamepadDirection={onGamepadDirection} />
    <SteamActivityCalendarWeeksPicker value={activityCalendarWeeks} onChange={onActivityCalendarWeeksChange} onGamepadDirection={onGamepadDirection} />
  </div></SteamSettingsContent>;
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
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat }}><img alt="" src={infoIconUrl} style={iconStyle(19)} /><div style={{ minWidth: 0, color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, lineHeight: 1.3 }}>SteamID64: steamid.io · Web API key: steamcommunity.com/dev/apikey.</div></div>
    <Focusable className="ac-settings-action" noFocusRing role="button" aria-label="Save Steam account settings" aria-disabled={saving} tabIndex={saving ? -1 : 0} onActivate={() => { void save(); }} onClick={() => { void save(); }} style={settingsSaveButtonStyle}>{saving ? "Saving…" : "Save account settings"}</Focusable>
  </>;
}

export function DeckyFullScreenSettingsPage({ isActive = true, onOpenActivity, onOpenProfile, showSteamProfileFooter = false, reserveSteamProfileFooter = false }: DeckyFullScreenSettingsPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null); const initialFocusRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<number>();
  const settings = useDeckySettings();
  const [selectedSection, setSelectedSection] = useState<SteamSettingsSection>("account"); const [accountMessage, setAccountMessage] = useState<{ readonly message: string; readonly isError: boolean }>();
  const handleColumnDirection = (event: GamepadEvent): void => handleDeckySettingsDirection(pageRef.current, event);
  useDeckyFullscreenOnScreenKeyboardLifecycle(pageRef);
  useLayoutEffect(() => {
    const ownerWindow = pageRef.current?.ownerDocument.defaultView;
    if (ownerWindow !== undefined && ownerWindow !== null) setPageHeight(ownerWindow.innerHeight);
  }, []);
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
  return <div ref={pageRef} className="ac-steam-settings-page" data-ac-steam-theme="fullscreen" style={{ position: "relative", height: pageHeight ?? "100vh", flexShrink: 0, minHeight: 0, overflow: "hidden", padding: `calc(env(safe-area-inset-top, 0px) + 43px) 12px ${showSteamProfileFooter || reserveSteamProfileFooter ? 50 : 10}px`, boxSizing: "border-box", color: steamTheme.color.textPrimary, background: steamTheme.surface.page }}><Styles /><DeckyFocusStyles /><div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", minHeight: 31 }}><Heading>STEAM SETTINGS</Heading></div>
    <Focusable flow-children="left-right" noFocusRing tabIndex={-1} data-settings-section-tabs="true" style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flex: "0 0 auto" }}>
      <SteamSettingsSectionPill title="Account" icon={usersIconUrl} selected={selectedSection === "account"} initialFocusRef={initialFocusRef} onSelect={() => setSelectedSection("account")} onGamepadDirection={handleColumnDirection} />
      <SteamSettingsSectionPill title="Full-Screen Settings" icon={calendarIconUrl} selected={selectedSection === "fullscreen"} onSelect={() => setSelectedSection("fullscreen")} onGamepadDirection={handleColumnDirection} />
      <SteamSettingsSectionPill title="Compact Settings" icon={settingsIconUrl} selected={selectedSection === "compact"} onSelect={() => setSelectedSection("compact")} onGamepadDirection={handleColumnDirection} />
      <SteamSettingsSectionPill title="Data" icon={databaseIconUrl} selected={selectedSection === "data"} onSelect={() => setSelectedSection("data")} onGamepadDirection={handleColumnDirection} />
    </Focusable>
    {selectedSection === "account" ? <SteamSettingsContent><div style={{ ...settingsScrollStyle, display: "flex", flexDirection: "column", gap: 10 }}><SteamAccountFields config={steamConfig} onSaved={(message, isError) => setAccountMessage({ message, isError })} />{accountMessage !== undefined ? <div style={{ color: accountMessage.isError ? steamTheme.color.danger : steamTheme.color.success, fontSize: steamTheme.type.fullscreen.metadata, textAlign: "right" }}>{accountMessage.message}</div> : null}</div></SteamSettingsContent> : null}
    {selectedSection === "fullscreen" ? <SteamSettingsContent><div style={{ width: "100%" }}><SteamActivityCalendarWeeksPicker value={settings.steamFullscreenActivityCalendarWeeks} onChange={updateFullscreenCalendarWeeks} onGamepadDirection={handleColumnDirection} /></div></SteamSettingsContent> : null}
    {selectedSection === "compact" ? <SteamCompactSettings config={steamConfig} activityCalendarWeeks={settings.steamCompactActivityCalendarWeeks} onActivityCalendarWeeksChange={(steamCompactActivityCalendarWeeks) => { void saveDeckySettings({ ...readDeckySettings(), steamCompactActivityCalendarWeeks }); }} onGamepadDirection={handleColumnDirection} /> : null}
    {selectedSection === "data" ? <SteamSettingsContent><div data-settings-data-layout style={{ ...settingsScrollStyle, display: "flex", flexDirection: "column", gap: 14 }}><div style={{ ...cardStyle, padding: 14, boxSizing: "border-box" }}><Heading>DATA &amp; SYNC</Heading><div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing-steam" ? "Refreshing Steam & SteamHunters…" : "Refresh Steam & SteamHunters"} disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshSteamAndSteamHunters(); }} /><ActionRow onGamepadDirection={handleColumnDirection} icon={refreshIconUrl} title={operation === "refreshing-library" ? "Running Full Library Scan…" : "Full Library Scan"} metadata={operation === "refreshing-library" ? "Scanning…" : fullScan === undefined ? "Never" : `${fullScan.date} · ${fullScan.time}`} success={fullScan !== undefined} danger={fullScan === undefined} disabled={operation === "refreshing-steam" || operation === "refreshing-library" || !steamConnected} onActivate={() => { void refreshLibrary(); }} /></div>{operationMessage !== undefined ? <div style={{ marginTop: 8, color: operation === "error" ? steamTheme.color.danger : steamTheme.color.success, fontSize: steamTheme.type.fullscreen.metadata, textAlign: "center" }}>{operationMessage}</div> : null}</div><div data-settings-danger-zone style={{ ...cardStyle, padding: 14, boxSizing: "border-box" }}><Heading>DANGEROUS ZONE</Heading><div style={{ marginTop: 10 }}><ActionRow onGamepadDirection={handleColumnDirection} danger icon={refreshIconUrl} title={armedAction === "reset" ? "Press again to reset Steam data" : "Reset Steam Data"} subtitle="Clear cache, local data, and Steam settings" onActivate={() => { if (armedAction === "reset") void resetSteamData(); else setArmedAction("reset"); }} /></div></div></div></SteamSettingsContent> : null}
  </div>{showSteamProfileFooter && onOpenActivity !== undefined && onOpenProfile !== undefined ? <DeckyFullScreenFooterOverlay isActive={isActive} activeNavigationItemId="settings" ariaLabel="Steam profile navigation" navigationItems={STEAM_PROFILE_FOOTER_NAVIGATION_ITEMS} onPreviousNavigationItem={onOpenActivity} onNextNavigationItem={onOpenProfile} /> : null}</div>;
}
