import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { PanelSection, PanelSectionRow, ScrollPanel, ToggleField } from "@decky/ui";
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
import { DeckyProviderSettingsActionRow } from "../../decky-provider-settings-action-row";
import { DeckyRetroAchievementsCredentialsForm } from "./credentials-form";
import { readDeckySettings, saveDeckySettings, useDeckySettings } from "../../decky-settings";
import { TopAlignedScrollViewport } from "../../decky-scroll-viewport";
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
}

const RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING = 42;

function getPageFrameStyle(inProviderSwitcher: boolean): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${RETROACHIEVEMENTS_PROVIDER_SETTINGS_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${inProviderSwitcher ? 62 : 12}px)`,
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

function getCurrentValueLabel(value: string): string {
  return `Current: ${value}`;
}

function getProviderCountValue(
  providerCount: AchievementCompanionCount | undefined,
  fallbackCount: AchievementCompanionCount,
): AchievementCompanionCount {
  return providerCount ?? fallbackCount;
}

function getNextCountOption(current: AchievementCompanionCount): AchievementCompanionCount {
  const currentIndex = ACHIEVEMENT_COMPANION_COUNT_OPTIONS.indexOf(current);
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS[
    (currentIndex + 1) % ACHIEVEMENT_COMPANION_COUNT_OPTIONS.length
  ]!;
}

function getNextCompletionProgressFilter(current: CompletionProgressFilter): CompletionProgressFilter {
  const filters: readonly CompletionProgressFilter[] = ["all", "unfinished", "beaten", "mastered"];
  const currentIndex = filters.indexOf(current);
  return filters[(currentIndex + 1) % filters.length]!;
}

export function DeckyRetroAchievementsProviderSettingsPage({
  providerId,
  onBack,
  inProviderSwitcher = false,
}: DeckyFullScreenProviderSettingsPageProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!inProviderSwitcher) return;
    const ownerWindow = scrollRef.current?.ownerDocument.defaultView;
    if (ownerWindow !== undefined && ownerWindow !== null) setViewportHeight(ownerWindow.innerHeight - 50);
  }, [inProviderSwitcher]);
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

  const content = (
      <TopAlignedScrollViewport scrollKey={`full-screen-provider-settings:${providerId}`}>
        <div style={getPageFrameStyle(inProviderSwitcher)}>
          {!inProviderSwitcher ? <PanelSection title="Navigation">
            <DeckyFullscreenActionRow>
              <DeckyFullscreenActionButton
                label="Back"
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
            </DeckyFullscreenActionRow>
          </PanelSection> : null}

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
              useSharedFullscreenFooter={inProviderSwitcher}
              onSave={(nextConfig, apiKeyDraft) =>
                writeDeckyRetroAchievementsProviderConfig(
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
            <DeckyProviderSettingsActionRow
              label="Recent Achievements count"
              description={getCurrentValueLabel(String(providerRecentAchievementsCount))}
              onClick={() => {
                const currentSettings = readDeckySettings();
                const nextSettings = {
                  ...currentSettings,
                  recentAchievementsCount: getNextCountOption(currentSettings.recentAchievementsCount),
                };
                void saveDeckySettings(nextSettings);
                persistProviderCounts(nextSettings);
              }}
            />

            <DeckyProviderSettingsActionRow
              label="Recently Played count"
              description={getCurrentValueLabel(String(providerRecentlyPlayedCount))}
              onClick={() => {
                const currentSettings = readDeckySettings();
                const nextSettings = {
                  ...currentSettings,
                  recentlyPlayedCount: getNextCountOption(currentSettings.recentlyPlayedCount),
                };
                void saveDeckySettings(nextSettings);
                persistProviderCounts(nextSettings);
              }}
            />
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

            <DeckyProviderSettingsActionRow
              label="Default Completion Progress filter"
              description={getCurrentValueLabel(
                formatCompletionProgressFilterLabel(settings.defaultCompletionProgressFilter),
              )}
              onClick={() => {
                updateSettings((current) => ({
                  ...current,
                  defaultCompletionProgressFilter: getNextCompletionProgressFilter(
                    current.defaultCompletionProgressFilter,
                  ),
                }));
              }}
            />

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
  );
  return inProviderSwitcher
    ? <div ref={scrollRef} data-provider-settings-scroll="true" style={{ height: viewportHeight ?? "calc(100vh - 50px)", flexShrink: 0, overflowY: "auto", boxSizing: "border-box" }}>{content}</div>
    : <ScrollPanel>{content}</ScrollPanel>;
}

export { DeckyRetroAchievementsProviderSettingsPage as DeckyFullScreenProviderSettingsPage };
