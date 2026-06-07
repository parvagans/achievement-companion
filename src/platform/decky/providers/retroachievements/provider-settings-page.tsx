import { type CSSProperties } from "react";
import {
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  ScrollPanel,
  ToggleField,
  type SingleDropdownOption,
} from "@decky/ui";
import {
  ACHIEVEMENT_COMPANION_COUNT_OPTIONS,
  formatCompletionProgressFilterLabel,
  type AchievementCompanionCount,
  type AchievementCompanionSettings,
  type CompletionProgressFilter,
} from "@core/settings";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../../../providers/retroachievements";
import {
  DeckyFullscreenActionButton,
  DeckyFullscreenActionRow,
} from "../../decky-full-screen-action-controls";
import { DeckyRetroAchievementsCredentialsForm } from "./credentials-form";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "../../decky-settings";
import { TopAlignedScrollViewport } from "../../decky-scroll-viewport";
import {
  clearDeckyRetroAchievementsAccountState,
  useDeckyProviderConfig,
  writeDeckyProviderConfig,
} from "./config";

const COMPLETION_PROGRESS_FILTER_OPTIONS: readonly CompletionProgressFilter[] = [
  "all",
  "unfinished",
  "beaten",
  "mastered",
];

const COUNT_DROPDOWN_OPTIONS: SingleDropdownOption[] =
  ACHIEVEMENT_COMPANION_COUNT_OPTIONS.map((value) => ({
    data: value,
    label: String(value),
  }));

const COMPLETION_PROGRESS_FILTER_DROPDOWN_OPTIONS: SingleDropdownOption[] =
  COMPLETION_PROGRESS_FILTER_OPTIONS.map((value) => ({
    data: value,
    label: formatCompletionProgressFilterLabel(value),
  }));

export interface DeckyFullScreenProviderSettingsPageProps {
  readonly providerId: string;
  readonly onBack: () => void;
}

function getPageFrameStyle(): CSSProperties {
  return {
    padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)",
    boxSizing: "border-box",
  };
}

function getHeroCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))",
  };
}

function getHeroKickerStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getHeroTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.45em",
    fontWeight: 800,
    lineHeight: 1.08,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getHeroSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.92em",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };
}

function getSettingsSummaryStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
}

function getSettingsSectionSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.88em",
    lineHeight: 1.35,
  };
}

function getProviderCountValue(
  providerCount: AchievementCompanionCount | undefined,
  fallbackCount: AchievementCompanionCount,
): AchievementCompanionCount {
  return providerCount ?? fallbackCount;
}

function isAchievementCompanionCount(value: unknown): value is AchievementCompanionCount {
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS.includes(value as AchievementCompanionCount);
}

function isCompletionProgressFilter(value: unknown): value is CompletionProgressFilter {
  return COMPLETION_PROGRESS_FILTER_OPTIONS.includes(value as CompletionProgressFilter);
}

export function DeckyRetroAchievementsProviderSettingsPage({
  providerId,
  onBack,
}: DeckyFullScreenProviderSettingsPageProps): JSX.Element {
  const providerConfig = useDeckyProviderConfig(RETROACHIEVEMENTS_PROVIDER_ID);
  const settings = useDeckySettings();
  const providerLabel =
    providerId === RETROACHIEVEMENTS_PROVIDER_ID ? "RetroAchievements" : providerId;

  const updateSettings = (
    updater: (current: AchievementCompanionSettings) => AchievementCompanionSettings,
  ) => {
    void saveDeckySettings(updater(readDeckySettings()));
  };

  const persistProviderCounts = (nextSettings: AchievementCompanionSettings): void => {
    if (providerConfig?.hasApiKey !== true) {
      return;
    }

    void writeDeckyProviderConfig(
      {
        username: providerConfig.username,
        recentAchievementsCount: nextSettings.recentAchievementsCount,
        recentlyPlayedCount: nextSettings.recentlyPlayedCount,
      },
      "",
    );
  };

  const providerRecentAchievementsCount = getProviderCountValue(
    providerConfig?.recentAchievementsCount,
    settings.recentAchievementsCount,
  );
  const providerRecentlyPlayedCount = getProviderCountValue(
    providerConfig?.recentlyPlayedCount,
    settings.recentlyPlayedCount,
  );

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport scrollKey={`full-screen-provider-settings:${providerId}`}>
        <div style={getPageFrameStyle()}>
          <PanelSection title="Navigation">
            <DeckyFullscreenActionRow>
              <DeckyFullscreenActionButton
                label="Back"
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
            </DeckyFullscreenActionRow>
          </PanelSection>

          <PanelSection title="Provider">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <div style={getHeroKickerStyle()}>Achievement Companion</div>
                <div style={getHeroTitleStyle()}>{providerLabel}</div>
                <div style={getHeroSupportStyle()}>
                  Manage account settings and provider-specific preferences for this provider on this device.
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Account">
            <DeckyRetroAchievementsCredentialsForm
              config={providerConfig}
              statusLabel="Account status"
              saveLabel="Save provider settings"
              clearLabel="Sign out"
              onSave={(nextConfig, apiKeyDraft) =>
                writeDeckyProviderConfig(
                  {
                    ...nextConfig,
                    recentAchievementsCount:
                      providerConfig?.recentAchievementsCount ?? settings.recentAchievementsCount,
                    recentlyPlayedCount:
                      providerConfig?.recentlyPlayedCount ?? settings.recentlyPlayedCount,
                  },
                  apiKeyDraft,
                )
              }
              onClear={() => clearDeckyRetroAchievementsAccountState()}
            />
          </PanelSection>

          <PanelSection title="Provider dashboard preferences">
            <PanelSectionRow>
              <DropdownItem
                label="Recent Achievements count"
                description="Number of recent achievements shown on the provider dashboard."
                rgOptions={COUNT_DROPDOWN_OPTIONS}
                selectedOption={providerRecentAchievementsCount}
                onChange={(option) => {
                  if (!isAchievementCompanionCount(option.data)) {
                    return;
                  }

                  const recentAchievementsCount = option.data;
                  const currentSettings = readDeckySettings();
                  const nextSettings = {
                    ...currentSettings,
                    recentAchievementsCount,
                  };
                  void saveDeckySettings(nextSettings);
                  persistProviderCounts(nextSettings);
                }}
              />
            </PanelSectionRow>

            <PanelSectionRow>
              <DropdownItem
                label="Recently Played count"
                description="Number of recently played games shown on the provider dashboard."
                rgOptions={COUNT_DROPDOWN_OPTIONS}
                selectedOption={providerRecentlyPlayedCount}
                onChange={(option) => {
                  if (!isAchievementCompanionCount(option.data)) {
                    return;
                  }

                  const recentlyPlayedCount = option.data;
                  const currentSettings = readDeckySettings();
                  const nextSettings = {
                    ...currentSettings,
                    recentlyPlayedCount,
                  };
                  void saveDeckySettings(nextSettings);
                  persistProviderCounts(nextSettings);
                }}
              />
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Global app/completion settings">
            <PanelSectionRow>
              <ToggleField
                label="Show subsets"
                description="Include subset games in Completion Progress."
                checked={settings.showCompletionProgressSubsets}
                highlightOnFocus
                onChange={(showCompletionProgressSubsets) => {
                  updateSettings((current) => ({
                    ...current,
                    showCompletionProgressSubsets,
                  }));
                }}
              />
            </PanelSectionRow>

            <PanelSectionRow>
              <DropdownItem
                label="Default Completion Progress filter"
                description="Filter selected when Completion Progress opens."
                rgOptions={COMPLETION_PROGRESS_FILTER_DROPDOWN_OPTIONS}
                selectedOption={settings.defaultCompletionProgressFilter}
                onChange={(option) => {
                  if (!isCompletionProgressFilter(option.data)) {
                    return;
                  }

                  const defaultCompletionProgressFilter = option.data;
                  updateSettings((current) => ({
                    ...current,
                    defaultCompletionProgressFilter,
                  }));
                }}
              />
            </PanelSectionRow>

            <PanelSectionRow>
              <div style={getSettingsSummaryStyle()}>
                <div style={getSettingsSectionSupportStyle()}>
                  These choices affect the default view state for the compact provider chooser and
                  the full-screen completion browser.
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}

export { DeckyRetroAchievementsProviderSettingsPage as DeckyFullScreenProviderSettingsPage };
