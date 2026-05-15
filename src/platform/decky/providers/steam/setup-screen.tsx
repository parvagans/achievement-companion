import { type CSSProperties } from "react";
import { PanelSection, PanelSectionRow } from "@decky/ui";
import type { ProviderId } from "@core/domain";
import { STEAM_PROVIDER_ICON_SRC } from "./icon";
import { DeckyCompactPillActionItem } from "../../decky-compact-pill-action-item";
import { DeckySteamProviderCredentialsForm } from "./credentials-form";
import { useDeckySteamProviderConfig, writeDeckySteamProviderConfig } from "./config";
import { STEAM_PROVIDER_ID } from "../../../../providers/steam";

export interface DeckySteamSetupScreenProps {
  readonly providerId: ProviderId;
  readonly onBackToProviders: () => void;
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
    gap: 12,
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))",
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
    borderRadius: 10,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background: "rgba(255, 255, 255, 0.06)",
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
    overflow: "visible",
    overflowWrap: "anywhere",
    textOverflow: "clip",
    whiteSpace: "normal",
  };
}

const STEAM_SETUP_HELP_COPY =
  "In Steam, use your SteamID64 and Web API Key. Keep your API key private and save it only on your own device.";

function getHeroSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.92em",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };
}

function getProviderLabel(providerId: ProviderId): string {
  return providerId === STEAM_PROVIDER_ID ? "Steam" : providerId;
}

export function DeckySteamSetupScreen({
  providerId,
  onBackToProviders,
}: DeckySteamSetupScreenProps): JSX.Element {
  const config = useDeckySteamProviderConfig(providerId);
  const providerLabel = getProviderLabel(providerId);

  return (
    <div style={getPageFrameStyle()}>
      <PanelSection title="Provider">
        <PanelSectionRow>
          <div style={getHeroCardStyle()}>
            <div style={getHeroHeaderStyle()}>
              <span aria-hidden="true" style={getHeroIconFrameStyle()}>
                <img alt="" loading="lazy" src={STEAM_PROVIDER_ICON_SRC} style={getHeroIconStyle()} />
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
        <DeckySteamProviderCredentialsForm
          config={config}
          helperCopy={STEAM_SETUP_HELP_COPY}
          statusLabel="Account status"
          saveLabel="Save provider settings"
          compactSurface
          onSave={(nextConfig, apiKeyDraft) => writeDeckySteamProviderConfig(nextConfig, apiKeyDraft)}
        />
      </PanelSection>
    </div>
  );
}
