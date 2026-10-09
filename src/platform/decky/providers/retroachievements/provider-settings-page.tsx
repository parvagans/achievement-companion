import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { Focusable, GamepadButton, PanelSection, PanelSectionRow, ScrollPanel, ToggleField, type GamepadEvent } from "@decky/ui";
import {
  ACHIEVEMENT_COMPANION_COUNT_OPTIONS,
  formatCompletionProgressFilterLabel,
  type AchievementCompanionCount,
  type AchievementCompanionSettings,
  type CompletionProgressFilter,
} from "@core/settings";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../../../providers/retroachievements";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "../../decky-full-screen-action-controls";
import { DeckyProviderSettingsActionRow } from "../../decky-provider-settings-action-row";
import { DeckyRetroAchievementsCredentialsForm } from "./credentials-form";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "../../decky-settings";
import { TopAlignedScrollViewport } from "../../decky-scroll-viewport";
import { raRecipes, raTheme } from "../../ra-theme";
import { loadDeckyDashboardState } from "../../decky-app-services";
import { DeckyFocusStyles, DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "../../decky-focus-styles";
import { takeDeckySteamGamepadFocus } from "../../decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "../../decky-steam-navigation-sound";
import { DeckyUpdateSettingsPanel } from "../../decky-update-settings-panel";
import { isDeckyFullscreenOnScreenKeyboardOpen } from "../../decky-full-screen-footer-overlay";
import brandSecondaryLogoUrl from "../../assets/brand/AC_secondary_logo.png";
import usersIconUrl from "../../assets/users.svg";
import calendarIconUrl from "../../assets/calendar.svg";
import refreshIconUrl from "../../assets/refresh.svg";
import infoIconUrl from "../../assets/info.svg";
import externalLinkIconUrl from "../../assets/external-link.svg";
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
}

const RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING = 42;
const RETROACHIEVEMENTS_URL = "https://retroachievements.org/";
const RELEASES_URL = "https://github.com/parvagans/achievement-companion/releases";
const REPOSITORY_URL = "https://github.com/parvagans/achievement-companion";
const ISSUES_URL = "https://github.com/parvagans/achievement-companion/issues";

type RetroAchievementsSettingsSection = "account" | "fullscreen" | "updates";

function getPageFrameStyle(inProviderSwitcher: boolean): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${inProviderSwitcher ? 62 : 12}px)`,
    boxSizing: "border-box",
  };
}

function getHeroCardStyle(): CSSProperties {
  return { ...raRecipes.card("fullscreen"), display: "flex", flexDirection: "column", gap: 10, padding: 18 };
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

function getSettingsSummaryStyle(): CSSProperties { return { display: "flex", flexDirection: "column", gap: 8 }; }
function getSettingsSectionSupportStyle(): CSSProperties { return { ...raRecipes.text("fullscreen", "metadata"), lineHeight: 1.35 }; }
function getCurrentValueLabel(value: string): string { return `Current: ${value}`; }

function getProviderCountValue(providerCount: AchievementCompanionCount | undefined, fallbackCount: AchievementCompanionCount): AchievementCompanionCount {
  return providerCount ?? fallbackCount;
}

function getNextCountOption(current: AchievementCompanionCount): AchievementCompanionCount {
  const currentIndex = ACHIEVEMENT_COMPANION_COUNT_OPTIONS.indexOf(current);
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS[(currentIndex + 1) % ACHIEVEMENT_COMPANION_COUNT_OPTIONS.length]!;
}

function getNextCompletionProgressFilter(current: CompletionProgressFilter): CompletionProgressFilter {
  const filters: readonly CompletionProgressFilter[] = ["all", "unfinished", "beaten", "mastered"];
  const currentIndex = filters.indexOf(current);
  return filters[(currentIndex + 1) % filters.length]!;
}

function SettingsHeading({ children }: { readonly children: string }): JSX.Element {
  return <div style={{ color: raTheme.color.accent, fontSize: 10, fontWeight: raTheme.type.weight.strong, letterSpacing: ".14em", lineHeight: 1.2 }}>{children}</div>;
}

function SettingsActionRow({ title, subtitle, metadata, icon, disabled = false, danger = false, onActivate, onGamepadDirection }: {
  readonly title: string;
  readonly subtitle?: string;
  readonly metadata?: string;
  readonly icon: string;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly onActivate?: () => void;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  const interactive = onActivate !== undefined && !disabled;
  const color = danger ? raTheme.color.danger : raTheme.color.textPrimary;
  return <Focusable className="ac-settings-action" noFocusRing aria-label={title} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1}
    {...(interactive ? { role: "button" as const, onActivate, onClick: onActivate } : {})}
    {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
    onFocus={() => setFocused(true)} onGamepadFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 34, padding: "5px 9px", boxSizing: "border-box", border: `1px solid ${danger ? "rgba(255, 113, 130, .42)" : raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.small, background: danger ? raTheme.surface.error : raTheme.surface.interactive, color, opacity: disabled ? .56 : 1, ...(focused ? { borderColor: raTheme.focus.border, boxShadow: raTheme.focus.shadow, background: raTheme.focus.background } : {}) }}>
    <img alt="" aria-hidden="true" src={icon} style={{ width: 17, height: 17, flex: "0 0 auto", objectFit: "contain", filter: danger ? "brightness(0) saturate(100%) invert(65%) sepia(24%) saturate(1657%) hue-rotate(302deg) brightness(104%) contrast(101%)" : raTheme.iconFilter.primary }} />
    <div style={{ minWidth: 0, flex: "1 1 auto" }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: metadata === undefined ? "normal" : "nowrap", fontSize: raTheme.type.fullscreen.caption, fontWeight: raTheme.type.weight.strong, lineHeight: 1.08 }}>{title}</div>{subtitle !== undefined ? <div style={{ marginTop: 2, color: danger ? raTheme.color.danger : raTheme.color.textSecondary, fontSize: raTheme.type.fullscreen.caption, lineHeight: 1.1 }}>{subtitle}</div> : null}</div>
    {metadata !== undefined ? <span style={{ flexShrink: 0, color: raTheme.color.textSecondary, fontSize: raTheme.type.fullscreen.caption, whiteSpace: "nowrap" }}>{metadata}</span> : null}
    {interactive ? <img alt="" aria-hidden="true" src={externalLinkIconUrl} style={{ width: 15, height: 15, flex: "0 0 auto", objectFit: "contain", filter: raTheme.iconFilter.primary }} /> : null}
  </Focusable>;
}

function SettingsSectionPill({ title, icon, selected, initialFocusRef, onSelect, onGamepadDirection }: {
  readonly title: string;
  readonly icon: string;
  readonly selected: boolean;
  readonly initialFocusRef?: React.Ref<HTMLDivElement>;
  readonly onSelect: () => void;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  const [focused, setFocused] = useState(false);
  return <Focusable ref={initialFocusRef} className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS} noFocusRing role="button" aria-pressed={selected} aria-label={`${title}, ${selected ? "selected" : "not selected"}`} tabIndex={0} onActivate={onSelect} onClick={onSelect} onGamepadDirection={onGamepadDirection} onFocus={() => setFocused(true)} onGamepadFocus={() => setFocused(true)} onBlur={() => setFocused(false)} data-settings-section-pill="true" style={{ ...raRecipes.filter(selected, focused), flex: "1 1 0", width: "auto", minWidth: 0, minHeight: 29, padding: "4px 8px", gap: 7, fontSize: 10, fontWeight: raTheme.type.weight.strong, whiteSpace: "nowrap", overflowWrap: "normal" }}>
    <img alt="" aria-hidden="true" src={icon} style={{ width: 16, height: 16, flex: "0 0 auto", objectFit: "contain", filter: raTheme.iconFilter.primary }} />
    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
  </Focusable>;
}

export function DeckyRetroAchievementsProviderSettingsPage({ providerId, onBack, inProviderSwitcher = false, onRebuildSubsetIndex, onOpenExternalUrl }: DeckyFullScreenProviderSettingsPageProps): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number>();
  const providerConfig = useDeckyProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
  const settings = useDeckySettings();
  const [subsetIndexOperation, setSubsetIndexOperation] = useState<"idle" | "refreshing" | "refreshed" | "error">("idle");
  const [selectedSection, setSelectedSection] = useState<RetroAchievementsSettingsSection>("account");
  const [refreshOperation, setRefreshOperation] = useState<"idle" | "refreshing" | "refreshed" | "error">("idle");
  const [signOutArmed, setSignOutArmed] = useState(false);
  const [signOutOperation, setSignOutOperation] = useState<"idle" | "signing-out" | "signed-out" | "error">("idle");
  const providerLabel = providerId === RETROACHIEVEMENTS_PROVIDER_ID ? "RetroAchievements" : providerId;

  useLayoutEffect(() => {
    if (!inProviderSwitcher) return;
    const ownerWindow = pageRef.current?.ownerDocument.defaultView;
    if (ownerWindow !== undefined && ownerWindow !== null) setViewportHeight(ownerWindow.innerHeight - 50);
  }, [inProviderSwitcher]);

  const updateSettings = (updater: (current: AchievementCompanionSettings) => AchievementCompanionSettings): void => {
    void saveDeckySettings(updater(readDeckySettings()));
  };
  const persistProviderCounts = (nextSettings: AchievementCompanionSettings): void => {
    if (providerConfig?.hasApiKey !== true) return;
    void writeDeckyProviderConfig({ username: providerConfig.username, recentAchievementsCount: nextSettings.recentAchievementsCount, recentlyPlayedCount: nextSettings.recentlyPlayedCount }, "");
  };
  const providerRecentAchievementsCount = getProviderCountValue(providerConfig?.recentAchievementsCount, settings.recentAchievementsCount);
  const providerRecentlyPlayedCount = getProviderCountValue(providerConfig?.recentlyPlayedCount, settings.recentlyPlayedCount);
  const rebuildSubsetIndex = async (): Promise<void> => {
    if (onRebuildSubsetIndex === undefined || subsetIndexOperation === "refreshing") return;
    setSubsetIndexOperation("refreshing");
    try { await onRebuildSubsetIndex(); setSubsetIndexOperation("refreshed"); }
    catch { setSubsetIndexOperation("error"); }
  };

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
    if (isHorizontal && active.matches("[data-settings-section-pill]")) {
      const pills = [...page.querySelectorAll<HTMLElement>("[data-settings-section-pill]")];
      const index = pills.indexOf(active);
      const nextIndex = button === GamepadButton.DIR_LEFT ? index - 1 : index + 1;
      if (nextIndex >= 0 && nextIndex < pills.length) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        const nextPill = pills[nextIndex];
        if (nextPill !== undefined && takeDeckySteamGamepadFocus(nextPill)) playDeckySteamNavigationSound(page.ownerDocument);
        return;
      }
      if (button === GamepadButton.DIR_LEFT) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); return; }
    }
    const sourceId = active.closest<HTMLElement>("[data-settings-column]")?.dataset["settingsColumn"];
    const destinationId = isVertical ? sourceId : sourceId === "left" ? "right" : sourceId === "right" ? "left" : undefined;
    if (destinationId === undefined) return;
    const destination = page.querySelector<HTMLElement>(`[data-settings-column="${destinationId}"]`);
    if (destination === null) return;
    const activeCenter = active.getBoundingClientRect().top + active.getBoundingClientRect().height / 2;
    const targets = [...destination.querySelectorAll<HTMLElement>(".Panel.Focusable[role='button']:not([aria-disabled='true']), .Panel.Focusable[role='switch']:not([aria-disabled='true']), input:not([disabled]), textarea:not([disabled]), [contenteditable='true']")];
    const target = targets.reduce<{ readonly element: HTMLElement; readonly distance: number } | undefined>((closest, candidate) => {
      if (candidate === active) return closest;
      const bounds = candidate.getBoundingClientRect(); const delta = bounds.top + bounds.height / 2 - activeCenter;
      if (isVertical && (button === GamepadButton.DIR_UP ? delta >= 0 : delta <= 0)) return closest;
      const distance = Math.abs(delta);
      return closest === undefined || distance < closest.distance ? { element: candidate, distance } : closest;
    }, undefined)?.element;
    if (target === undefined) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const moved = takeDeckySteamGamepadFocus(target);
    if (!moved && (target.matches("input, textarea") || target.isContentEditable)) target.focus();
    if (moved || page.ownerDocument.activeElement === target) playDeckySteamNavigationSound(page.ownerDocument);
  };

  useLayoutEffect(() => {
    if (!inProviderSwitcher) return;
    const page = pageRef.current; const ownerWindow = page?.ownerDocument.defaultView;
    if (page === null || page === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const onButtonDown = (event: Event): void => { if (!isDeckyFullscreenOnScreenKeyboardOpen(page.ownerDocument)) handleColumnDirection(event as GamepadEvent); };
    ownerWindow.addEventListener("vgp_onbuttondown", onButtonDown, true);
    return () => ownerWindow.removeEventListener("vgp_onbuttondown", onButtonDown, true);
  });
  useLayoutEffect(() => {
    if (!inProviderSwitcher) return;
    const page = pageRef.current; const ownerWindow = page?.ownerDocument.defaultView;
    if (page === null || page === undefined || ownerWindow === null || ownerWindow === undefined) return;
    const frame = ownerWindow.requestAnimationFrame(() => { if (!page.contains(page.ownerDocument.activeElement)) takeDeckySteamGamepadFocus(initialFocusRef.current); });
    return () => ownerWindow.cancelAnimationFrame(frame);
  }, [inProviderSwitcher]);

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
          <DeckyProviderSettingsActionRow label="Recent Achievements count" description={getCurrentValueLabel(String(providerRecentAchievementsCount))} onClick={() => { const currentSettings = readDeckySettings(); const nextSettings = { ...currentSettings, recentAchievementsCount: getNextCountOption(currentSettings.recentAchievementsCount) }; void saveDeckySettings(nextSettings); persistProviderCounts(nextSettings); }} />
          <DeckyProviderSettingsActionRow label="Recently Played count" description={getCurrentValueLabel(String(providerRecentlyPlayedCount))} onClick={() => { const currentSettings = readDeckySettings(); const nextSettings = { ...currentSettings, recentlyPlayedCount: getNextCountOption(currentSettings.recentlyPlayedCount) }; void saveDeckySettings(nextSettings); persistProviderCounts(nextSettings); }} />
        </PanelSection>
        <PanelSection title="Full-screen game data"><DeckyProviderSettingsActionRow label={subsetIndexOperation === "refreshing" ? "Preparing subset index rebuild" : "Rebuild subset index on next game open"} description={subsetIndexOperation === "refreshed" ? "The next parent game page will run a fresh verified scan." : subsetIndexOperation === "error" ? "Unable to clear the saved subset index." : "Use this after RA adds or changes a subset relationship."} actionLabel={subsetIndexOperation === "refreshing" ? "Working…" : "Rebuild"} disabled={onRebuildSubsetIndex === undefined || subsetIndexOperation === "refreshing"} onClick={() => { void rebuildSubsetIndex(); }} /></PanelSection>
        <PanelSection title="Global app/completion settings">
          <PanelSectionRow><ToggleField label="Show subsets" description="Include subset games in Completion Progress." checked={settings.showCompletionProgressSubsets} highlightOnFocus onChange={(showCompletionProgressSubsets) => updateSettings((current) => ({ ...current, showCompletionProgressSubsets }))} /></PanelSectionRow>
          <DeckyProviderSettingsActionRow label="Default Completion Progress filter" description={getCurrentValueLabel(formatCompletionProgressFilterLabel(settings.defaultCompletionProgressFilter))} onClick={() => updateSettings((current) => ({ ...current, defaultCompletionProgressFilter: getNextCompletionProgressFilter(current.defaultCompletionProgressFilter) }))} />
          <PanelSectionRow><div style={getSettingsSummaryStyle()}><div style={getSettingsSectionSupportStyle()}>These choices affect the default view state for the compact provider chooser and the full-screen completion browser.</div></div></PanelSectionRow>
        </PanelSection>
      </div>
    </TopAlignedScrollViewport>
  );
  if (!inProviderSwitcher) return <ScrollPanel>{legacyContent}</ScrollPanel>;

  const refreshMessage = refreshOperation === "refreshed" ? "RetroAchievements refreshed" : refreshOperation === "error" ? "Unable to refresh RetroAchievements right now." : undefined;
  const subsetMessage = subsetIndexOperation === "refreshed" ? "A fresh verified scan will run on the next parent game open." : subsetIndexOperation === "error" ? "Unable to prepare the subset index rebuild." : "Rebuild the verified relationship index on the next parent game open.";
  const sectionPanelStyle: CSSProperties = { ...raRecipes.card("fullscreen", true), display: "flex", flex: "1 1 auto", flexDirection: "column", gap: 6, minHeight: 0, overflow: "hidden", padding: "8px 11px" };
  const sideCardStyle: CSSProperties = { ...raRecipes.card("fullscreen"), padding: 9 };
  const onGamepadDirection = (event: GamepadEvent): void => handleColumnDirection(event);

  return <div ref={pageRef} className="ac-ra-fullscreen-settings-page" data-ac-ra-theme="fullscreen" style={{ position: "relative", height: viewportHeight ?? "calc(100vh - 50px)", flexShrink: 0, minHeight: 0, overflow: "hidden", padding: "calc(env(safe-area-inset-top, 0px) + 43px) 12px 8px", boxSizing: "border-box", color: raTheme.color.textPrimary, background: raTheme.surface.page }}>
    <DeckyFocusStyles />
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 31 }}><SettingsHeading>RETROACHIEVEMENTS SETTINGS</SettingsHeading></div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.9fr) minmax(260px, .95fr)", gap: 10, minHeight: 0, flex: "1 1 auto" }}>
        <div data-settings-column="left" style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0, overflow: "hidden", paddingBottom: raTheme.space.sm, boxSizing: "border-box" }}>
          <Focusable flow-children="left-right" noFocusRing tabIndex={-1} data-settings-section-tabs="true" style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flex: "0 0 auto" }}>
            <SettingsSectionPill title="Account" icon={usersIconUrl} selected={selectedSection === "account"} initialFocusRef={initialFocusRef} onSelect={() => setSelectedSection("account")} onGamepadDirection={onGamepadDirection} />
            <SettingsSectionPill title="Full-Screen Settings" icon={calendarIconUrl} selected={selectedSection === "fullscreen"} onSelect={() => setSelectedSection("fullscreen")} onGamepadDirection={onGamepadDirection} />
            <SettingsSectionPill title="Updates" icon={refreshIconUrl} selected={selectedSection === "updates"} onSelect={() => setSelectedSection("updates")} onGamepadDirection={onGamepadDirection} />
          </Focusable>
          {selectedSection === "account" ? <div data-settings-section-content style={sectionPanelStyle}>
            <div style={{ color: raTheme.color.textSecondary, fontSize: raTheme.type.fullscreen.caption, fontWeight: raTheme.type.weight.strong }}>ACCOUNT</div>
            <div style={{ minHeight: 0, overflowY: "auto", scrollPadding: "6px 0" }}><DeckyRetroAchievementsCredentialsForm config={providerConfig} statusLabel="Account status" saveLabel="Save provider settings" useSharedFullscreenFooter onSave={(nextConfig, apiKeyDraft) => writeDeckyRetroAchievementsProviderConfig({ ...nextConfig, recentAchievementsCount: providerConfig?.recentAchievementsCount ?? settings.recentAchievementsCount, recentlyPlayedCount: providerConfig?.recentlyPlayedCount ?? settings.recentlyPlayedCount }, apiKeyDraft)} /></div>
          </div> : null}
          {selectedSection === "fullscreen" ? <div data-settings-section-content style={sectionPanelStyle}>
            <div style={{ color: raTheme.color.textSecondary, fontSize: raTheme.type.fullscreen.caption, fontWeight: raTheme.type.weight.strong }}>FULL-SCREEN SETTINGS</div>
            <div style={{ minHeight: 0, overflowY: "auto", scrollPadding: "6px 0" }}>
              <PanelSection title="Provider dashboard preferences">
                <DeckyProviderSettingsActionRow label="Recent Achievements count" description={getCurrentValueLabel(String(providerRecentAchievementsCount))} onClick={() => { const currentSettings = readDeckySettings(); const nextSettings = { ...currentSettings, recentAchievementsCount: getNextCountOption(currentSettings.recentAchievementsCount) }; void saveDeckySettings(nextSettings); persistProviderCounts(nextSettings); }} />
                <DeckyProviderSettingsActionRow label="Recently Played count" description={getCurrentValueLabel(String(providerRecentlyPlayedCount))} onClick={() => { const currentSettings = readDeckySettings(); const nextSettings = { ...currentSettings, recentlyPlayedCount: getNextCountOption(currentSettings.recentlyPlayedCount) }; void saveDeckySettings(nextSettings); persistProviderCounts(nextSettings); }} />
              </PanelSection>
              <PanelSection title="Completion Progress">
                <PanelSectionRow><ToggleField label="Show subsets" description="Include subset games in Completion Progress." checked={settings.showCompletionProgressSubsets} highlightOnFocus onChange={(showCompletionProgressSubsets) => updateSettings((current) => ({ ...current, showCompletionProgressSubsets }))} /></PanelSectionRow>
                <DeckyProviderSettingsActionRow label="Default Completion Progress filter" description={getCurrentValueLabel(formatCompletionProgressFilterLabel(settings.defaultCompletionProgressFilter))} onClick={() => updateSettings((current) => ({ ...current, defaultCompletionProgressFilter: getNextCompletionProgressFilter(current.defaultCompletionProgressFilter) }))} />
                <PanelSectionRow><div style={getSettingsSectionSupportStyle()}>These choices set the default filters and collection size in RetroAchievements profile views.</div></PanelSectionRow>
              </PanelSection>
              <PanelSection title="Subset relationships"><DeckyProviderSettingsActionRow label={subsetIndexOperation === "refreshing" ? "Preparing subset index rebuild" : "Rebuild subset index on next game open"} description={subsetMessage} actionLabel={subsetIndexOperation === "refreshing" ? "Working…" : "Rebuild"} disabled={onRebuildSubsetIndex === undefined || subsetIndexOperation === "refreshing"} onClick={() => { void rebuildSubsetIndex(); }} /></PanelSection>
            </div>
          </div> : null}
          {selectedSection === "updates" ? <div data-settings-section-content data-ac-steam-theme="fullscreen" style={{ ...sectionPanelStyle, padding: 0 }}><DeckyUpdateSettingsPanel onGamepadDirection={onGamepadDirection} /></div> : null}
        </div>
        <div data-settings-column="right" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, minHeight: 0, overflow: "hidden", paddingBottom: raTheme.space.sm, boxSizing: "border-box" }}>
          <div style={sideCardStyle}><SettingsHeading>ABOUT</SettingsHeading><div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "3px 2px 5px" }}><img alt="" src={brandSecondaryLogoUrl} style={{ width: 40, height: 40, objectFit: "contain", flex: "0 0 auto" }} /><div style={{ minWidth: 0, color: raTheme.color.textPrimary, fontSize: raTheme.type.fullscreen.caption, fontWeight: raTheme.type.weight.strong }}>Achievement Companion</div></div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SettingsActionRow title="RetroAchievements" icon={externalLinkIconUrl} onGamepadDirection={onGamepadDirection} onActivate={() => onOpenExternalUrl?.(RETROACHIEVEMENTS_URL)} />
            <SettingsActionRow title="Changelog" icon={externalLinkIconUrl} onGamepadDirection={onGamepadDirection} onActivate={() => onOpenExternalUrl?.(RELEASES_URL)} />
            <SettingsActionRow title="GitHub" icon={externalLinkIconUrl} onGamepadDirection={onGamepadDirection} onActivate={() => onOpenExternalUrl?.(REPOSITORY_URL)} />
            <SettingsActionRow title="Report Issue" icon={infoIconUrl} onGamepadDirection={onGamepadDirection} onActivate={() => onOpenExternalUrl?.(ISSUES_URL)} />
          </div></div>
          <div style={sideCardStyle}><SettingsHeading>DATA &amp; SYNC</SettingsHeading><div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}><SettingsActionRow title={refreshOperation === "refreshing" ? "Refreshing RetroAchievements…" : "Refresh RetroAchievements"} icon={refreshIconUrl} disabled={refreshOperation === "refreshing" || providerConfig?.hasApiKey !== true} onGamepadDirection={onGamepadDirection} onActivate={() => { void refreshRetroAchievements(); }} />{refreshMessage !== undefined ? <div style={{ color: refreshOperation === "error" ? raTheme.color.danger : raTheme.color.success, fontSize: raTheme.type.fullscreen.caption, textAlign: "center" }}>{refreshMessage}</div> : null}</div></div>
          <div data-settings-danger-zone style={{ ...sideCardStyle, flex: "1 1 auto" }}><SettingsHeading>DANGEROUS ZONE</SettingsHeading><div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}><SettingsActionRow title={signOutOperation === "signing-out" ? "Signing out…" : signOutArmed ? "Press again to sign out" : "Sign Out of RetroAchievements"} subtitle={signOutOperation === "signed-out" ? "Signed out." : signOutOperation === "error" ? "Unable to sign out right now." : "Remove the saved account and cached data from this device."} icon={infoIconUrl} danger disabled={signOutOperation === "signing-out" || providerConfig === undefined} onGamepadDirection={onGamepadDirection} onActivate={() => { void signOut(); }} /></div></div>
        </div>
      </div>
    </div>
  </div>;
}

export { DeckyRetroAchievementsProviderSettingsPage as DeckyFullScreenProviderSettingsPage };
