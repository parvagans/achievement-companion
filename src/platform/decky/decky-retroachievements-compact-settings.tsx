import { DropdownItem, Focusable, NavEntryPositionPreferences, PanelSection, PanelSectionRow, type DropdownOption } from "@decky/ui";
import { useEffect, useRef, useState } from "react";
import { useDeckyCompactDropdownPopupGuard } from "./decky-compact-dropdown-popup-guard";
import { registerCompactProviderCancelCallback } from "./decky-full-screen-cancel-bridge";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "./decky-settings";
import { raRecipes, raTheme } from "./ra-theme";
import type { RetroAchievementsAchievementMode, RetroAchievementsRankDisplay } from "@core/settings";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import externalLinkIconUrl from "./assets/external-link.svg";

const RANK_DISPLAY_OPTIONS: DropdownOption[] = [
  { data: "site", label: "Site Rank" },
  { data: "casual", label: "Casual Rank" },
];

const ACHIEVEMENT_MODE_OPTIONS: DropdownOption[] = [
  { data: "hardcore", label: "Hardcore" },
  { data: "softcore", label: "Softcore" },
  { data: "both", label: "Both" },
];

export interface DeckyRetroAchievementsCompactSettingsProps {
  readonly onBack: () => void;
  readonly onOpenApiSettings: () => void;
}

export function DeckyRetroAchievementsCompactSettings({
  onBack,
  onOpenApiSettings,
}: DeckyRetroAchievementsCompactSettingsProps): JSX.Element {
  const settings = useDeckySettings();
  const openGuardedMenu = useDeckyCompactDropdownPopupGuard();
  const [apiFocused, setApiFocused] = useState(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => registerCompactProviderCancelCallback(surfaceRef.current, onBack),
    [onBack],
  );

  const saveRankDisplay = (rankDisplay: RetroAchievementsRankDisplay): void => {
    void saveDeckySettings({ ...readDeckySettings(), retroAchievementsRankDisplay: rankDisplay });
  };
  const saveAchievementMode = (achievementMode: RetroAchievementsAchievementMode): void => {
    void saveDeckySettings({ ...readDeckySettings(), retroAchievementsAchievementMode: achievementMode });
  };

  return (
    <div ref={surfaceRef} data-ac-ra-theme="compact" data-achievement-companion-ra-compact-settings="true" style={raRecipes.compactSettings.root}>
      <section style={raRecipes.compactSettings.section}>
        <div style={raRecipes.compactSettings.sectionTitle}>RetroAchievements Settings</div>
        <Focusable
          autoFocus
          noFocusRing
          preferredFocus
          navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
          role="button"
          tabIndex={0}
          aria-label="Open RetroAchievements API settings full-screen"
          data-ra-compact-settings-api="true"
          onActivate={onOpenApiSettings}
          onClick={onOpenApiSettings}
          onCancel={onBack}
          onFocus={() => setApiFocused(true)}
          onGamepadFocus={() => setApiFocused(true)}
          onBlur={() => setApiFocused(false)}
          style={raRecipes.compactSettings.action(apiFocused)}
        >
          <img alt="" src={externalLinkIconUrl} style={{ width: 16, height: 16, flexShrink: 0, filter: raTheme.iconFilter.primary }} />
          <span style={raRecipes.compactSettings.actionText}>
            <span style={raRecipes.compactSettings.actionTitle}>API Settings</span>
            <span style={raRecipes.compactSettings.actionDescription}>RetroAchievements account and API key</span>
          </span>
          <img alt="" src={chevronRightIconUrl} style={raRecipes.compactSettings.chevron} />
        </Focusable>
      </section>

      <PanelSection title="Profile presentation">
        <PanelSectionRow>
          <DropdownItem
            label={<span style={raRecipes.compactSettings.dropdownLabel}>Rank Display</span>}
            description={<span style={raRecipes.compactSettings.dropdownDescription}>Choose which available RetroAchievements rank appears in Compact and Full-Screen profiles.</span>}
            menuLabel="Rank Display"
            onMenuWillOpen={openGuardedMenu}
            rgOptions={RANK_DISPLAY_OPTIONS}
            selectedOption={settings.retroAchievementsRankDisplay}
            onChange={({ data }) => {
              if (data === "site" || data === "casual") saveRankDisplay(data);
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label={<span style={raRecipes.compactSettings.dropdownLabel}>Achievement Mode</span>}
            description={<span style={raRecipes.compactSettings.dropdownDescription}>Show Hardcore, Softcore, or both in Compact and Full-Screen profiles.</span>}
            menuLabel="Achievement Mode"
            onMenuWillOpen={openGuardedMenu}
            rgOptions={ACHIEVEMENT_MODE_OPTIONS}
            selectedOption={settings.retroAchievementsAchievementMode}
            onChange={({ data }) => {
              if (data === "hardcore" || data === "softcore" || data === "both") saveAchievementMode(data);
            }}
          />
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
}
