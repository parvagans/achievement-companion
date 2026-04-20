import { type CSSProperties } from "react";
import { PanelSection, PanelSectionRow } from "@decky/ui";
import type { ProviderId } from "@core/domain";
import { DeckyActionButtonItem } from "../../decky-action-button-item";
import { DECKY_FOCUS_ACTION_ROW_CLASS } from "../../decky-focus-styles";
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
      <PanelSection title="Navigation">
        <PanelSectionRow>
          <DeckyActionButtonItem
            className={DECKY_FOCUS_ACTION_ROW_CLASS}
            focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
            focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
            highlightOnFocus
            label="Back"
            description="Return to the provider chooser."
            onClick={onBackToProviders}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Provider">
        <PanelSectionRow>
          <div style={getHeroCardStyle()}>
            <div style={getHeroKickerStyle()}>Achievement Companion</div>
            <div style={getHeroTitleStyle()}>Connect {providerLabel}</div>
            <div style={getHeroSupportStyle()}>
              Enter your account details to load this provider on this device.
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Account">
        <DeckySteamProviderCredentialsForm
          config={config}
          statusLabel="Account status"
          saveLabel="Save provider settings"
          onSave={(nextConfig, apiKeyDraft) => writeDeckySteamProviderConfig(nextConfig, apiKeyDraft)}
        />
      </PanelSection>
    </div>
  );
}
