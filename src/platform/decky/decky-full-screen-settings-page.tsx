import { type CSSProperties } from "react";
import { PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { DeckyProviderSettingsActionRow } from "./decky-provider-settings-action-row";
import { TopAlignedScrollViewport } from "./decky-scroll-viewport";
import { getDeckyProviderOptions, useDeckyProviderConfigs } from "./providers";

export interface DeckyFullScreenSettingsPageProps {
  readonly onBack: () => void;
  readonly onOpenProviderSettings: (providerId: string) => void;
}

const FULLSCREEN_SETTINGS_PAGE_BOTTOM_SCROLL_PADDING = 88;
const FULLSCREEN_SETTINGS_PAGE_TOP_PADDING = 42;

function getPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${FULLSCREEN_SETTINGS_PAGE_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + ${FULLSCREEN_SETTINGS_PAGE_BOTTOM_SCROLL_PADDING}px)`,
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

export function DeckyFullScreenSettingsPage({
  onBack,
  onOpenProviderSettings,
}: DeckyFullScreenSettingsPageProps): JSX.Element {
  const providerConfigs = useDeckyProviderConfigs();
  const providers = getDeckyProviderOptions(providerConfigs).filter((provider) => provider.enabled);

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport scrollKey="full-screen-settings">
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

          <PanelSection title="Preferences">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <div style={getHeroKickerStyle()}>Achievement Companion</div>
                <div style={getHeroTitleStyle()}>Settings</div>
                <div style={getHeroSupportStyle()}>
                  Manage provider accounts, credentials, scans, and display preferences.
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Providers">
            {providers.map((provider) => (
              <DeckyProviderSettingsActionRow
                key={provider.id}
                label={provider.label}
                description={provider.connected ? "Connected" : "Set up account"}
                actionLabel="Open"
                onClick={() => {
                  onOpenProviderSettings(provider.id);
                }}
              />
            ))}
          </PanelSection>
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
