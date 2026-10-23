import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Focusable, PanelSection, PanelSectionRow, ScrollPanel, type GamepadEvent } from "@decky/ui";
import {
  ACHIEVEMENT_COMPANION_COUNT_OPTIONS,
  ACTIVITY_CALENDAR_WEEK_OPTIONS,
  RECENT_ACTIVITY_INTERVAL_OPTIONS,
  formatRecentActivityInterval,
  type AchievementCompanionCount,
  type AchievementCompanionSettings,
  type ActivityCalendarWeeks,
  type RecentActivityInterval,
  type RetroAchievementsAchievementMode,
  type RetroAchievementsRankDisplay,
} from "@core/settings";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../../../providers/retroachievements";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "../../decky-full-screen-action-controls";
import { DeckyProviderSettingsActionRow } from "../../decky-provider-settings-action-row";
import { DeckyRetroAchievementsCredentialsForm } from "./credentials-form";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "../../decky-settings";
import { TopAlignedScrollViewport } from "../../decky-scroll-viewport";
import { raRecipes, raTheme } from "../../ra-theme";
import { steamTheme } from "../../steam-theme";
import { loadDeckyDashboardState } from "../../decky-app-services";
import { DeckyFocusStyles } from "../../decky-focus-styles";
import { takeDeckySteamGamepadFocus } from "../../decky-steam-gamepad-focus";
import { DeckySettingsSection, handleDeckySettingsDirection, settingsScrollStyle } from "../../decky-settings-section";
import { DeckySettingsDropdown } from "../../decky-settings-dropdown";
import { DeckySettingsGeneralLink } from "../../decky-settings-controls";
import { isDeckyProviderSettingsWebReturnPending, useDeckyProviderSettingsWebReturnFocus } from "../../decky-provider-settings-web-return";
import { getRetroAchievementsRefreshActionPresentation } from "./settings-view-model";
import refreshIconUrl from "../../assets/refresh.svg";
import infoIconUrl from "../../assets/info.svg";
import checkCircleIconUrl from "../../assets/check-circle.svg";
import chevronRightIconUrl from "../../assets/chevron-right.svg";
import {
  clearDeckyRetroAchievementsAccountState,
  useDeckyProviderConfig,
  writeDeckyProviderConfig,
  writeDeckyRetroAchievementsProviderConfig,
} from "./config";

export interface DeckyFullScreenProviderSettingsPageProps {
  readonly providerId: string;
  readonly onBack: () => void;
  readonly inProviderSwitcher?: boolean;
  readonly onRebuildSubsetIndex?: () => Promise<void> | void;
  readonly onOpenExternalUrl?: (url: string) => void;
  readonly onOpenGeneralSettings?: () => void;
}

const RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING = 42;
const RA_RANK_OPTIONS: readonly RetroAchievementsRankDisplay[] = ["site", "casual"];
const RA_ACHIEVEMENT_MODE_OPTIONS: readonly RetroAchievementsAchievementMode[] = ["hardcore", "softcore", "both"];

function getPageFrameStyle(inProviderSwitcher: boolean): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${inProviderSwitcher ? 62 : 12}px)`,
    boxSizing: "border-box",
  };
}

function getHeroCardStyle(): CSSProperties {
  return { ...raRecipes.card("fullscreen"), background: raTheme.surface.contentCard, display: "flex", flexDirection: "column", gap: 10, padding: 18 };
}

function getHeroKickerStyle(): CSSProperties {
  return { ...raRecipes.text("fullscreen", "caption"), color: raTheme.color.textMuted, fontWeight: raTheme.type.weight.strong, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 };
}

function getHeroTitleStyle(): CSSProperties {
  return { ...raRecipes.text("fullscreen", "hero"), fontWeight: raTheme.type.weight.strong, lineHeight: 1.08, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

function getHeroSupportStyle(): CSSProperties {
  return { ...raRecipes.text("fullscreen", "body"), color: raTheme.color.textSecondary, lineHeight: 1.4, whiteSpace: "pre-wrap" };
}

function getCurrentValueLabel(value: string): string { return `Current: ${value}`; }

function getProviderCountValue(providerCount: AchievementCompanionCount | undefined, fallbackCount: AchievementCompanionCount): AchievementCompanionCount {
  return providerCount ?? fallbackCount;
}

function getNextCountOption(current: AchievementCompanionCount): AchievementCompanionCount {
  const currentIndex = ACHIEVEMENT_COMPANION_COUNT_OPTIONS.indexOf(current);
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS[(currentIndex + 1) % ACHIEVEMENT_COMPANION_COUNT_OPTIONS.length]!;
}

function SettingsHeading({ children }: { readonly children: string }): JSX.Element {
  return <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.strong, letterSpacing: ".1em", lineHeight: 1.3 }}>{children}</div>;
}

function SettingsGroup({ title, status, children, first = false }: {
  readonly title: string;
  readonly status?: string;
  readonly children: ReactNode;
  readonly first?: boolean;
}): JSX.Element {
  return <section aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 8, padding: first ? "2px 0 16px" : "16px 0", borderTop: first ? undefined : `1px solid ${steamTheme.color.borderSubtle}` }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
      <SettingsHeading>{title}</SettingsHeading>
      {status !== undefined ? <span role="status" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, textAlign: "right" }}>{status}</span> : null}
    </div>
    {children}
  </section>;
}

function SettingsStyles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const document = anchorRef.current?.ownerDocument;
    if (document === undefined) return;
    const style = document.createElement("style");
    style.textContent = `.ac-ra-fullscreen-settings-page .ac-settings-action{outline:none!important}.ac-ra-fullscreen-settings-page .ac-settings-action:not(.gpfocus):not(.gpfocuswithin):not(:focus):not(:focus-within){box-shadow:none!important}.ac-ra-fullscreen-settings-page .ac-settings-action:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){border-color:${steamTheme.focus.border}!important;box-shadow:${steamTheme.focus.shadow}!important;background:${steamTheme.focus.background}!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-input,.ac-ra-fullscreen-settings-page .ac-steam-settings-input{min-height:0!important;margin:0!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-input,.ac-ra-fullscreen-settings-page .ac-ra-settings-input *,.ac-ra-fullscreen-settings-page .ac-steam-settings-input,.ac-ra-fullscreen-settings-page .ac-steam-settings-input *{font-size:${steamTheme.type.fullscreen.body}px!important;line-height:1.2!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-input [class*="DialogInput"],.ac-ra-fullscreen-settings-page .ac-steam-settings-input [class*="DialogInput"]{min-height:0!important;margin:0!important;padding-block:0!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-input input,.ac-ra-fullscreen-settings-page .ac-steam-settings-input input{height:30px!important;min-height:30px!important;padding:3px 9px!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-save{outline:none!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-save.gpfocus,.ac-ra-fullscreen-settings-page .ac-ra-settings-save.gpfocuswithin,.ac-ra-fullscreen-settings-page .ac-ra-settings-save:focus,.ac-ra-fullscreen-settings-page .ac-ra-settings-save:focus-within{border-color:${steamTheme.focus.border}!important;box-shadow:${steamTheme.focus.shadow}!important;background:${steamTheme.focus.background}!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-help-link{outline:none!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-help-link:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){outline:2px solid ${steamTheme.focus.border}!important;outline-offset:1px;background:${steamTheme.focus.background}!important;box-shadow:${steamTheme.focus.shadow}!important;color:${steamTheme.color.textPrimary}!important}`;
    style.textContent += `.ac-ra-fullscreen-settings-page .ac-settings-action:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){background:${raTheme.surface.focusedContentStat}!important}.ac-ra-fullscreen-settings-page .ac-ra-settings-save[data-ac-settings-tone="success"]:is(.gpfocus,.gpfocuswithin,:focus,:focus-within){border-color:${steamTheme.status.success.border}!important;background:${steamTheme.status.success.surface}!important;color:${steamTheme.status.success.text}!important}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

function SettingsActionRow({ title, subtitle, metadata, icon, disabled = false, danger = false, success = false, onActivate, onGamepadDirection }: {
  readonly title: string;
  readonly subtitle?: string;
  readonly metadata?: string;
  readonly icon: string;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly success?: boolean;
  readonly onActivate?: () => void;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
  const interactive = onActivate !== undefined && !disabled;
  const color = danger ? steamTheme.color.danger : success ? steamTheme.color.success : steamTheme.color.textPrimary;
  const subtitleColor = danger ? steamTheme.status.danger.text : success ? steamTheme.status.success.text : steamTheme.color.textSecondary;
  const iconFilter = danger ? steamTheme.iconFilter.danger : success ? steamTheme.iconFilter.success : steamTheme.iconFilter.accent;
  const borderColor = danger ? steamTheme.status.danger.border : success ? steamTheme.status.success.border : steamTheme.color.borderSubtle;
  const tone = danger ? steamTheme.status.danger.surface : success ? steamTheme.status.success.surface : undefined;
  const background = tone === undefined
    ? raTheme.surface.contentStat
    : `linear-gradient(180deg, ${tone}, ${tone}), ${raTheme.surface.contentStat}`;
  return <Focusable className="ac-settings-action" noFocusRing aria-label={title} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1}
    {...(interactive ? { role: "button" as const, onActivate, onClick: onActivate, onGamepadDirection } : {})}
    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${borderColor}`, borderRadius: steamTheme.radius.small, background, color, opacity: disabled ? .56 : 1 }}>
    <img alt="" aria-hidden="true" src={icon} style={{ width: 17, height: 17, flex: "0 0 auto", objectFit: "contain", filter: iconFilter }} />
    <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: metadata === undefined ? "normal" : "nowrap", fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong, lineHeight: 1.2 }}>{title}</div>{subtitle !== undefined ? <div style={{ marginTop: 2, color: subtitleColor, fontSize: steamTheme.type.fullscreen.metadata, lineHeight: 1.2 }}>{subtitle}</div> : null}</div>
    {metadata !== undefined ? <span style={{ flexShrink: 0, color: subtitleColor, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.medium, whiteSpace: "nowrap" }}>{metadata}</span> : null}
    {interactive ? <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={{ width: 15, height: 15, flex: "0 0 auto", objectFit: "contain", filter: steamTheme.iconFilter.accent, opacity: .85 }} /> : null}
  </Focusable>;
}

export function DeckyRetroAchievementsProviderSettingsPage({ providerId, onBack, inProviderSwitcher = false, onRebuildSubsetIndex, onOpenExternalUrl, onOpenGeneralSettings }: DeckyFullScreenProviderSettingsPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const restoringFromWeb = isDeckyProviderSettingsWebReturnPending("retroachievements");
  useDeckyProviderSettingsWebReturnFocus(pageRef, "retroachievements");
  const [viewportHeight, setViewportHeight] = useState<number>();
  const providerConfig = useDeckyProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
  const settings = useDeckySettings();
  const [subsetIndexOperation, setSubsetIndexOperation] = useState<"idle" | "refreshing" | "refreshed" | "error">("idle");
  const [refreshOperation, setRefreshOperation] = useState<"idle" | "refreshing" | "refreshed" | "error">("idle");
  const [signOutArmed, setSignOutArmed] = useState(false);
  const [signOutOperation, setSignOutOperation] = useState<"idle" | "signing-out" | "signed-out" | "error">("idle");
  const providerLabel = providerId === RETROACHIEVEMENTS_PROVIDER_ID ? "RetroAchievements" : providerId;

  useLayoutEffect(() => {
    if (!inProviderSwitcher) return;
    const ownerWindow = pageRef.current?.ownerDocument.defaultView;
    if (ownerWindow !== undefined && ownerWindow !== null) setViewportHeight(ownerWindow.innerHeight);
  }, [inProviderSwitcher]);

  const updateSettings = (updater: (current: AchievementCompanionSettings) => AchievementCompanionSettings): void => {
    void saveDeckySettings(updater(readDeckySettings()));
  };
  const persistProviderCounts = (changes: Partial<Pick<AchievementCompanionSettings, "recentAchievementsCount" | "recentlyPlayedCount">>): void => {
    if (providerConfig?.hasApiKey !== true) return;
    void writeDeckyProviderConfig({ username: providerConfig.username, recentAchievementsCount: changes.recentAchievementsCount ?? providerRecentAchievementsCount, recentlyPlayedCount: changes.recentlyPlayedCount ?? providerRecentlyPlayedCount }, "");
  };
  const providerRecentAchievementsCount = getProviderCountValue(providerConfig?.recentAchievementsCount, settings.recentAchievementsCount);
  const providerRecentlyPlayedCount = getProviderCountValue(providerConfig?.recentlyPlayedCount, settings.recentlyPlayedCount);
  const rebuildSubsetIndex = async (): Promise<void> => {
    if (onRebuildSubsetIndex === undefined || subsetIndexOperation === "refreshing") return;
    setSubsetIndexOperation("refreshing");
    try { await onRebuildSubsetIndex(); setSubsetIndexOperation("refreshed"); }
    catch { setSubsetIndexOperation("error"); }
  };

  const handleColumnDirection = (event: GamepadEvent): void => handleDeckySettingsDirection(pageRef.current, event);

  useLayoutEffect(() => {
    if (!inProviderSwitcher || restoringFromWeb) return;
    const page = pageRef.current; const ownerWindow = page?.ownerDocument.defaultView;
    if (page === null || page === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => {
      if (!page.contains(page.ownerDocument.activeElement)) {
        takeDeckySteamGamepadFocus(page.querySelector<HTMLElement>("[data-settings-section-content] input") ?? page.querySelector<HTMLElement>("[data-settings-section-content] [tabindex='0']"));
      }
    });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [inProviderSwitcher, restoringFromWeb]);

  const refreshRetroAchievements = async (): Promise<void> => {
    setRefreshOperation("refreshing");
    try { const state = await loadDeckyDashboardState(RETROACHIEVEMENTS_PROVIDER_ID, { forceRefresh: true }); setRefreshOperation(state.data !== undefined && state.error === undefined ? "refreshed" : "error"); }
    catch { setRefreshOperation("error"); }
  };
  const signOut = async (): Promise<void> => {
    if (!signOutArmed) { setSignOutArmed(true); return; }
    setSignOutOperation("signing-out");
    try { const cleared = await clearDeckyRetroAchievementsAccountState(); setSignOutOperation(cleared ? "signed-out" : "error"); setSignOutArmed(false); }
    catch { setSignOutOperation("error"); setSignOutArmed(false); }
  };

  const legacyContent = (
    <TopAlignedScrollViewport scrollKey={`full-screen-provider-settings:${providerId}`}>
      <div data-ac-ra-theme="fullscreen" style={getPageFrameStyle(inProviderSwitcher)}>
        {!inProviderSwitcher ? <PanelSection title="Navigation"><DeckyFullscreenActionRow><DeckyFullscreenActionButton label="Back" isFullscreenBackAction onClick={onBack} /></DeckyFullscreenActionRow></PanelSection> : null}
        <PanelSection title="Provider"><PanelSectionRow><div style={getHeroCardStyle()}><div style={getHeroKickerStyle()}>Achievement Companion</div><div style={getHeroTitleStyle()}>{providerLabel}</div><div style={getHeroSupportStyle()}>Manage account settings and provider-specific preferences for this provider on this device.</div></div></PanelSectionRow></PanelSection>
        <PanelSection title="Account"><DeckyRetroAchievementsCredentialsForm config={providerConfig} statusLabel="Account status" saveLabel="Save provider settings" clearLabel="Sign out" useSharedFullscreenFooter={inProviderSwitcher} onSave={(nextConfig, apiKeyDraft) => writeDeckyRetroAchievementsProviderConfig({ ...nextConfig, recentAchievementsCount: providerConfig?.recentAchievementsCount ?? settings.recentAchievementsCount, recentlyPlayedCount: providerConfig?.recentlyPlayedCount ?? settings.recentlyPlayedCount }, apiKeyDraft)} onClear={() => clearDeckyRetroAchievementsAccountState()} /></PanelSection>
        <PanelSection title="Provider dashboard preferences">
          <DeckyProviderSettingsActionRow label="Recent Achievements count" description={getCurrentValueLabel(String(providerRecentAchievementsCount))} onClick={() => { const recentAchievementsCount = getNextCountOption(providerRecentAchievementsCount); void saveDeckySettings({ ...readDeckySettings(), recentAchievementsCount }); persistProviderCounts({ recentAchievementsCount }); }} />
          <DeckyProviderSettingsActionRow label="Recently Played count" description={getCurrentValueLabel(String(providerRecentlyPlayedCount))} onClick={() => { const recentlyPlayedCount = getNextCountOption(providerRecentlyPlayedCount); void saveDeckySettings({ ...readDeckySettings(), recentlyPlayedCount }); persistProviderCounts({ recentlyPlayedCount }); }} />
        </PanelSection>
        <PanelSection title="Subset discovery cache"><DeckyProviderSettingsActionRow label={subsetIndexOperation === "refreshing" ? "Preparing subset recheck" : "Recheck subset links on next game open"} description={subsetIndexOperation === "refreshed" ? "The next base-game page will verify its subset links again." : subsetIndexOperation === "error" ? "Unable to prepare the subset recheck." : "Cached, verified links between base games and their RA subsets. Use after RA adds or moves a subset."} actionLabel={subsetIndexOperation === "refreshing" ? "Working…" : "Recheck"} disabled={onRebuildSubsetIndex === undefined || subsetIndexOperation === "refreshing"} onClick={() => { void rebuildSubsetIndex(); }} /></PanelSection>
      </div>
    </TopAlignedScrollViewport>
  );
  if (!inProviderSwitcher) return <ScrollPanel>{legacyContent}</ScrollPanel>;

  const refreshAction = getRetroAchievementsRefreshActionPresentation(refreshOperation);
  const subsetMessage = subsetIndexOperation === "refreshed" ? "The next base-game page will verify its subset links again." : subsetIndexOperation === "error" ? "Unable to prepare the subset recheck." : "Use this if a subset is missing or moved.";
  const onGamepadDirection = (event: GamepadEvent): void => handleColumnDirection(event);
  const saveCompactCalendarWeeks = (retroAchievementsCompactActivityCalendarWeeks: ActivityCalendarWeeks): void => updateSettings((current) => ({ ...current, retroAchievementsCompactActivityCalendarWeeks }));
  const saveFullscreenCalendarWeeks = (retroAchievementsFullscreenActivityCalendarWeeks: ActivityCalendarWeeks): void => updateSettings((current) => ({ ...current, retroAchievementsFullscreenActivityCalendarWeeks }));
  const saveRecentActivityInterval = (retroAchievementsFullscreenRecentActivityInterval: RecentActivityInterval): void => updateSettings((current) => ({ ...current, retroAchievementsFullscreenRecentActivityInterval }));
  const accountStatus = providerConfig?.hasApiKey === true && providerConfig.username.trim().length > 0
    ? `Credentials saved · ${providerConfig.username}`
    : providerConfig?.username.trim().length ? "API key needed" : "Not configured";

  return <div ref={pageRef} className="ac-ra-fullscreen-settings-page" data-ac-steam-theme="fullscreen" style={{ position: "relative", height: viewportHeight ?? "100vh", flexShrink: 0, minHeight: 0, overflow: "hidden", padding: "calc(env(safe-area-inset-top, 0px) + 43px) 12px 50px", boxSizing: "border-box", color: steamTheme.color.textPrimary, background: steamTheme.surface.page, fontFamily: steamTheme.type.fontFamily }}>
    <SettingsStyles /><DeckyFocusStyles />
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 31 }}><SettingsHeading>RETROACHIEVEMENTS SETTINGS</SettingsHeading></div>
      <DeckySettingsSection themeVariant="ra"><div style={{ ...settingsScrollStyle, display: "flex", flexDirection: "column" }}>
        {onOpenGeneralSettings !== undefined ? <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 4px 8px" }}><DeckySettingsGeneralLink onOpen={onOpenGeneralSettings} onGamepadDirection={handleColumnDirection} /></div> : null}
        <SettingsGroup title="ACCOUNT" status={accountStatus} first>
          <DeckyRetroAchievementsCredentialsForm config={providerConfig} statusLabel="Account status" saveLabel="Save account settings" useSharedFullscreenFooter {...(onOpenExternalUrl !== undefined ? { onOpenExternalUrl } : {})} onGamepadDirection={onGamepadDirection} onSave={(nextConfig, apiKeyDraft) => writeDeckyRetroAchievementsProviderConfig({ ...nextConfig, recentAchievementsCount: providerConfig?.recentAchievementsCount ?? settings.recentAchievementsCount, recentlyPlayedCount: providerConfig?.recentlyPlayedCount ?? settings.recentlyPlayedCount }, apiKeyDraft)} />
        </SettingsGroup>
        <SettingsGroup title="PROFILE">
          <div style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, lineHeight: 1.3 }}>Applies to compact and full-screen RetroAchievements profiles.</div>
        <DeckySettingsDropdown themeVariant="ra" label="Rank Display" value={settings.retroAchievementsRankDisplay} options={RA_RANK_OPTIONS} formatOption={(rank) => rank === "site" ? "Site Rank" : "Casual Rank"} onChange={(retroAchievementsRankDisplay) => updateSettings((current) => ({ ...current, retroAchievementsRankDisplay }))} onGamepadDirection={onGamepadDirection} />
        <DeckySettingsDropdown themeVariant="ra" label="Achievement Mode" value={settings.retroAchievementsAchievementMode} options={RA_ACHIEVEMENT_MODE_OPTIONS} formatOption={(mode) => mode === "hardcore" ? "Hardcore" : mode === "softcore" ? "Softcore" : "Both"} onChange={(retroAchievementsAchievementMode) => updateSettings((current) => ({ ...current, retroAchievementsAchievementMode }))} onGamepadDirection={onGamepadDirection} />
        </SettingsGroup>
        <SettingsGroup title="ACTIVITY">
          <SettingsHeading>FULL-SCREEN</SettingsHeading>
        <DeckySettingsDropdown themeVariant="ra" label="Activity Calendar" description="Choose how many weeks of achievement activity the full-screen calendar shows." value={settings.retroAchievementsFullscreenActivityCalendarWeeks} options={ACTIVITY_CALENDAR_WEEK_OPTIONS} formatOption={(weeks) => `${weeks} weeks`} onChange={saveFullscreenCalendarWeeks} onGamepadDirection={onGamepadDirection} />
        <DeckySettingsDropdown themeVariant="ra" label="Recent Activity graph" description="Choose the time range and bar grouping for the full-screen Activity graph." value={settings.retroAchievementsFullscreenRecentActivityInterval} options={RECENT_ACTIVITY_INTERVAL_OPTIONS} formatOption={formatRecentActivityInterval} onChange={saveRecentActivityInterval} onGamepadDirection={onGamepadDirection} />
          <SettingsHeading>COMPACT PROFILE</SettingsHeading>
        <DeckySettingsDropdown themeVariant="ra" label="Recent Activity" description="Number of recent achievement unlocks shown on the compact profile." value={providerRecentAchievementsCount} options={ACHIEVEMENT_COMPANION_COUNT_OPTIONS} onChange={(recentAchievementsCount) => { updateSettings((current) => ({ ...current, recentAchievementsCount })); persistProviderCounts({ recentAchievementsCount }); }} onGamepadDirection={onGamepadDirection} />
        <DeckySettingsDropdown themeVariant="ra" label="Recently Played" description="Number of recently played games shown on the compact profile." value={providerRecentlyPlayedCount} options={ACHIEVEMENT_COMPANION_COUNT_OPTIONS} onChange={(recentlyPlayedCount) => { updateSettings((current) => ({ ...current, recentlyPlayedCount })); persistProviderCounts({ recentlyPlayedCount }); }} onGamepadDirection={onGamepadDirection} />
        <DeckySettingsDropdown themeVariant="ra" label="Activity Calendar" description="Choose how many weeks of achievement activity the compact calendar shows." value={settings.retroAchievementsCompactActivityCalendarWeeks} options={ACTIVITY_CALENDAR_WEEK_OPTIONS} formatOption={(weeks) => `${weeks} weeks`} onChange={saveCompactCalendarWeeks} onGamepadDirection={onGamepadDirection} />
        </SettingsGroup>
        <SettingsGroup title="DATA & SYNC">
          <SettingsActionRow title={refreshAction.title} {...(providerConfig?.hasApiKey === true ? {} : { subtitle: "Save an API key to enable refresh." })} success={refreshAction.success} danger={refreshAction.danger} icon={refreshAction.success ? checkCircleIconUrl : refreshIconUrl} disabled={refreshOperation === "refreshing" || providerConfig?.hasApiKey !== true} onGamepadDirection={onGamepadDirection} onActivate={() => { void refreshRetroAchievements(); }} />
          <SettingsActionRow title={subsetIndexOperation === "refreshing" ? "Preparing subset recheck" : "Recheck subset links on next game open"} subtitle={subsetMessage} icon={refreshIconUrl} disabled={onRebuildSubsetIndex === undefined || subsetIndexOperation === "refreshing"} onGamepadDirection={onGamepadDirection} onActivate={() => { void rebuildSubsetIndex(); }} />
          <div data-settings-danger-zone style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 14, borderTop: `1px solid ${steamTheme.color.borderSubtle}` }}>
            <SettingsHeading>DANGER ZONE</SettingsHeading>
            <SettingsActionRow title={signOutOperation === "signing-out" ? "Signing out…" : signOutArmed ? "Press again to sign out" : "Sign Out of RetroAchievements"} subtitle={signOutOperation === "signed-out" ? "Signed out." : signOutOperation === "error" ? "Unable to sign out right now." : "Remove the saved account and cached data from this device."} icon={infoIconUrl} danger disabled={signOutOperation === "signing-out" || providerConfig === undefined} onGamepadDirection={onGamepadDirection} onActivate={() => { void signOut(); }} />
          </div>
        </SettingsGroup>
      </div></DeckySettingsSection>
    </div>
  </div>;
}

export { DeckyRetroAchievementsProviderSettingsPage as DeckyFullScreenProviderSettingsPage };
