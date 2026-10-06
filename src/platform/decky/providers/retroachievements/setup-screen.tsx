import { type CSSProperties } from "react";
import { PanelSection, PanelSectionRow } from "@decky/ui";
import type { ProviderId } from "@core/domain";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../../../providers/retroachievements";
import { RETROACHIEVEMENTS_PROVIDER_ICON_SRC } from "./icon";
import { DeckyCompactPillActionItem } from "../../decky-compact-pill-action-item";
import { DeckyRetroAchievementsCredentialsForm } from "./credentials-form";
import { useDeckyProviderConfig, writeDeckyRetroAchievementsProviderConfig } from "./config";
import { useDeckySettings } from "../../decky-settings";
import { raRecipes, raTheme } from "../../ra-theme";

export interface DeckyFirstRunSetupScreenProps {
  readonly providerId: ProviderId;
  readonly onBackToProviders: () => void;
}

const RETROACHIEVEMENTS_SETUP_TOP_PADDING = 42;

function getPageFrameStyle(): CSSProperties {
  return {
    padding: `calc(env(safe-area-inset-top, 0px) + ${RETROACHIEVEMENTS_SETUP_TOP_PADDING}px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)`,
    boxSizing: "border-box",
  };
}

function getHeroCardStyle(): CSSProperties {
  return {
    ...raRecipes.card("fullscreen"),
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 18,
  };
}

function getHeroHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  };
}

function getHeroIconFrameStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: raTheme.radius.medium,
    border: `1px solid ${raTheme.color.borderSubtle}`,
    background: raTheme.surface.raised,
  };
}

function getHeroIconStyle(): CSSProperties {
  return {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
}

function getHeroTitleStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    flex: 1,
  };
}

function getHeroActionRowStyle(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "flex-start",
    width: "100%",
    minWidth: 0,
  };
}

function getHeroKickerStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "caption"),
    color: raTheme.color.textMuted,
    fontWeight: raTheme.type.weight.strong,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getHeroTitleStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "hero"),
    fontWeight: raTheme.type.weight.strong,
    lineHeight: 1.08,
    minWidth: 0,
    overflow: "visible",
    overflowWrap: "anywhere",
    textOverflow: "clip",
    whiteSpace: "normal",
  };
}

const RETROACHIEVEMENTS_SETUP_HELP_COPY =
  "In RetroAchievements, open Settings, then Authentication. Copy your Web API Key and use your RetroAchievements username here.";

function getHeroSupportStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "body"),
    color: raTheme.color.textSecondary,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };
}

function getProviderLabel(providerId: ProviderId): string {
  if (providerId === RETROACHIEVEMENTS_PROVIDER_ID) {
    return "RetroAchievements";
  }

  return providerId;
}

export function DeckyRetroAchievementsSetupScreen({
  providerId,
  onBackToProviders,
}: DeckyFirstRunSetupScreenProps): JSX.Element {
  const config = useDeckyProviderConfig(providerId);
  const settings = useDeckySettings();
  const providerLabel = getProviderLabel(providerId);

  return (
    <div data-ac-ra-theme="fullscreen" style={getPageFrameStyle()}>
      <PanelSection title="Provider">
        <PanelSectionRow>
          <div style={getHeroCardStyle()}>
            <div style={getHeroHeaderStyle()}>
              <span aria-hidden="true" style={getHeroIconFrameStyle()}>
                <img alt="" loading="lazy" src={RETROACHIEVEMENTS_PROVIDER_ICON_SRC} style={getHeroIconStyle()} />
              </span>
              <div style={getHeroTitleStackStyle()}>
                <div style={getHeroKickerStyle()}>Achievement Companion</div>
                <div style={getHeroTitleStyle()}>Set up {providerLabel}</div>
              </div>
            </div>
            <div style={getHeroSupportStyle()}>
              Enter your account details to load this provider on this device.
            </div>
            <div style={getHeroActionRowStyle()}>
              <DeckyCompactPillActionItem
                label="Back"
                onCancelButton={onBackToProviders}
                onClick={onBackToProviders}
              />
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Account">
        <DeckyRetroAchievementsCredentialsForm
          config={config}
          helperCopy={RETROACHIEVEMENTS_SETUP_HELP_COPY}
          statusLabel="Account status"
          saveLabel="Save provider settings"
          compactSurface
          onSave={(nextConfig, apiKeyDraft) =>
            writeDeckyRetroAchievementsProviderConfig(
              {
                ...nextConfig,
                recentAchievementsCount:
                  config?.recentAchievementsCount ?? settings.recentAchievementsCount,
                recentlyPlayedCount: config?.recentlyPlayedCount ?? settings.recentlyPlayedCount,
              },
              apiKeyDraft,
            )
          }
        />
      </PanelSection>
    </div>
  );
}

export { DeckyRetroAchievementsSetupScreen as DeckyFirstRunSetupScreen };
