import { type CSSProperties, useEffect, useState } from "react";
import { PanelSectionRow } from "@decky/ui";
import type { RetroAchievementsProviderConfig } from "../../../../providers/retroachievements";
import type { RetroAchievementsCredentialSaveResult } from "./connection";
import {
  DeckyCredentialTextField,
  getDeckyCredentialTextFieldMaskStyle,
} from "../../decky-credential-text-field";
import { DeckyCompactPillActionItem } from "../../decky-compact-pill-action-item";
import { DeckyProviderSettingsActionGroup } from "../../decky-provider-settings-action-row";
import { markDeckyFullscreenOnScreenKeyboardOpen } from "../../decky-full-screen-footer-overlay";
import {
  RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY,
  getRetroAchievementsApiKeyInputDescriptor,
  getRetroAchievementsCredentialsFieldSpecs,
} from "./credentials-help";
import { raRecipes, raTheme } from "../../ra-theme";

export interface DeckyRetroAchievementsCredentialsFormProps {
  readonly config: RetroAchievementsProviderConfig | undefined;
  readonly statusLabel: string;
  readonly helperCopy?: string;
  readonly saveLabel: string;
  readonly clearLabel?: string;
  readonly compactSurface?: boolean;
  readonly useSharedFullscreenFooter?: boolean;
  readonly onSave: (
    config: Omit<RetroAchievementsProviderConfig, "hasApiKey">,
    apiKeyDraft: string,
  ) => boolean | RetroAchievementsCredentialSaveResult | Promise<boolean | RetroAchievementsCredentialSaveResult>;
  readonly onClear?: () => boolean | Promise<boolean>;
}

function getFormStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getCompactFormStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

function getCompactCardStyle(): CSSProperties {
  return {
    ...raRecipes.card("compact", true),
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getFullscreenInfoCardStyle(): CSSProperties {
  return {
    ...raRecipes.card("fullscreen", true),
    display: "flex",
    flexDirection: "column",
    gap: raTheme.space.xs,
    padding: 12,
  };
}

function getFullscreenInfoLabelStyle(): CSSProperties {
  return { ...raRecipes.text("fullscreen", "title"), fontWeight: raTheme.type.weight.strong };
}

function getFullscreenInfoDescriptionStyle(): CSSProperties {
  return raRecipes.text("fullscreen", "metadata");
}

function getCredentialInputStyle(): CSSProperties {
  return {
    ...raRecipes.inputFrame,
    color: raTheme.color.textPrimary,
    padding: "10px 12px",
    boxSizing: "border-box",
  };
}

function getCompactCardHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
  };
}

function getCompactCardLabelStyle(): CSSProperties {
  return {
    ...raRecipes.text("compact", "caption"),
    color: raTheme.color.textSecondary,
    fontWeight: raTheme.type.weight.strong,
    letterSpacing: "0.1em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  };
}

function getCompactCardStatusStyle(isConnected: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px 8px",
    borderRadius: 999,
    ...raRecipes.badge(isConnected ? "default" : "warning"),
    borderColor: isConnected ? raTheme.color.accent : raTheme.color.warning,
    background: isConnected ? raTheme.surface.selected : raTheme.surface.warning,
    color: isConnected ? raTheme.color.accent : raTheme.color.warning,
    fontSize: raTheme.type.compact.caption,
    fontWeight: raTheme.type.weight.strong,
    letterSpacing: "0.04em",
    lineHeight: 1.15,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

function getCompactCardTextStyle(): CSSProperties {
  return {
    ...raRecipes.text("compact", "body"),
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  };
}

function getCompactFieldCardStyle(): CSSProperties {
  return {
    ...raRecipes.card("compact"),
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 14,
  };
}

function getCompactActionStackStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getCompactActionNoteStyle(): CSSProperties {
  return {
    ...raRecipes.text("compact", "metadata"),
    lineHeight: 1.35,
  };
}

function getStatusCopy(config: RetroAchievementsProviderConfig | undefined): string {
  return config !== undefined ? `Signed in as ${config.username}.` : "Set up your account.";
}

export function DeckyRetroAchievementsCredentialsForm({
  config,
  statusLabel,
  helperCopy,
  saveLabel,
  clearLabel,
  compactSurface = false,
  useSharedFullscreenFooter = false,
  onSave,
  onClear,
}: DeckyRetroAchievementsCredentialsFormProps): JSX.Element {
  const fieldSpecs = getRetroAchievementsCredentialsFieldSpecs();
  const [username, setUsername] = useState(config?.username ?? "");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [statusCopy, setStatusCopy] = useState(getStatusCopy(config));

  useEffect(() => {
    setUsername(config?.username ?? "");
    setApiKeyDraft("");
    setStatusCopy(getStatusCopy(config));
  }, [config?.hasApiKey, config?.username]);

  async function handleSave(): Promise<void> {
    const trimmedUsername = username.trim();
    const trimmedApiKeyDraft = apiKeyDraft.trim();

    if (trimmedUsername.length === 0) {
      setStatusCopy("Enter your username to continue.");
      return;
    }

    if (trimmedApiKeyDraft.length === 0 && config?.hasApiKey !== true) {
      setStatusCopy("Enter your API key to continue.");
      return;
    }

    try {
      const saveResult = await onSave(
        {
          username: trimmedUsername,
          ...(config?.recentAchievementsCount !== undefined
            ? { recentAchievementsCount: config.recentAchievementsCount }
            : {}),
          ...(config?.recentlyPlayedCount !== undefined
            ? { recentlyPlayedCount: config.recentlyPlayedCount }
            : {}),
        },
        apiKeyDraft,
      );
      const saved = typeof saveResult === "boolean" ? saveResult : saveResult.saved;
      setStatusCopy(
        typeof saveResult === "boolean"
          ? saved ? "Provider settings saved." : "Unable to save provider settings right now."
          : saveResult.userMessage,
      );
    } catch {
      setStatusCopy("Unable to save provider settings right now.");
    }
  }

  async function handleClear(): Promise<void> {
    if (onClear === undefined) {
      return;
    }

    try {
      const cleared = await onClear();
      if (cleared) {
        setStatusCopy("Signed out.");
      } else {
        setStatusCopy("Unable to sign out right now.");
      }
    } catch {
      setStatusCopy("Unable to sign out right now.");
    }
  }

  const hasSavedApiKey = config?.hasApiKey === true;
  const apiKeyInputDescriptor = getRetroAchievementsApiKeyInputDescriptor(hasSavedApiKey);
  const usernameDescription = helperCopy ?? fieldSpecs.username.description;

  if (compactSurface) {
    return (
      <div style={getCompactFormStyle()}>
        <div style={getCompactCardStyle()}>
          <div style={getCompactCardHeaderStyle()}>
            <div style={getCompactCardLabelStyle()}>Setup help</div>
          </div>
          <div style={getCompactCardTextStyle()}>{helperCopy ?? RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY}</div>
        </div>

        <div style={getCompactCardStyle()}>
          <div style={getCompactCardHeaderStyle()}>
            <div style={getCompactCardLabelStyle()}>{statusLabel}</div>
            <div style={getCompactCardStatusStyle(hasSavedApiKey)}>
              {hasSavedApiKey ? "CONNECTED" : "SET UP"}
            </div>
          </div>
          <div style={getCompactCardTextStyle()}>{statusCopy}</div>
        </div>

        <div style={getCompactFieldCardStyle()}>
          <DeckyCredentialTextField
            focusOnMount={config === undefined}
            label={fieldSpecs.username.label}
            description={usernameDescription}
            value={username}
            style={getCredentialInputStyle()}
            onChange={(event) => {
              setUsername(event.currentTarget.value);
            }}
          />
        </div>

        <div style={getCompactFieldCardStyle()}>
          <DeckyCredentialTextField
            label={fieldSpecs.apiKey.label}
            description={apiKeyInputDescriptor.description}
            value={apiKeyDraft}
            aria-label={apiKeyInputDescriptor.ariaLabel}
            autoCapitalize={apiKeyInputDescriptor.autoCapitalize}
            autoComplete={apiKeyInputDescriptor.autoComplete}
            autoCorrect={apiKeyInputDescriptor.autoCorrect}
            inputMode={apiKeyInputDescriptor.inputMode}
            spellCheck={apiKeyInputDescriptor.spellCheck}
            bIsPassword={apiKeyInputDescriptor.bIsPassword}
            style={{ ...getCredentialInputStyle(), ...getDeckyCredentialTextFieldMaskStyle() }}
            onChange={(event) => {
              setApiKeyDraft(event.currentTarget.value);
            }}
          />
        </div>

        <div style={getCompactActionStackStyle()}>
          <DeckyCompactPillActionItem
            stretch
            emphasis="primary"
            label={saveLabel}
            onClick={() => {
              void handleSave();
            }}
          />

          {onClear !== undefined && config !== undefined ? (
            <DeckyCompactPillActionItem
              stretch
              label={clearLabel ?? "Clear credentials"}
              onClick={() => {
                void handleClear();
              }}
            />
          ) : null}

          <div style={getCompactActionNoteStyle()}>
            Leave the API key blank to keep your saved key.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-ac-ra-theme="fullscreen" style={getFormStyle()}>
      <div style={getFullscreenInfoCardStyle()}>
        <div style={getFullscreenInfoLabelStyle()}>Setup help</div>
        <div style={getFullscreenInfoDescriptionStyle()}>{RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY}</div>
      </div>

      <div style={getFullscreenInfoCardStyle()}>
        <div style={getFullscreenInfoLabelStyle()}>{statusLabel}</div>
        <div style={getFullscreenInfoDescriptionStyle()}>{statusCopy}</div>
      </div>

      <PanelSectionRow>
        <DeckyCredentialTextField
          focusOnMount={config === undefined}
          label={fieldSpecs.username.label}
          description={usernameDescription}
          value={username}
          style={getCredentialInputStyle()}
          onClick={(event) => { if (useSharedFullscreenFooter) markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument); }}
          onChange={(event) => {
            setUsername(event.currentTarget.value);
          }}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <DeckyCredentialTextField
          label={fieldSpecs.apiKey.label}
          description={apiKeyInputDescriptor.description}
          value={apiKeyDraft}
          aria-label={apiKeyInputDescriptor.ariaLabel}
          autoCapitalize={apiKeyInputDescriptor.autoCapitalize}
          autoComplete={apiKeyInputDescriptor.autoComplete}
          autoCorrect={apiKeyInputDescriptor.autoCorrect}
          inputMode={apiKeyInputDescriptor.inputMode}
          spellCheck={apiKeyInputDescriptor.spellCheck}
          bIsPassword={apiKeyInputDescriptor.bIsPassword}
          style={{ ...getCredentialInputStyle(), ...getDeckyCredentialTextFieldMaskStyle() }}
          onClick={(event) => { if (useSharedFullscreenFooter) markDeckyFullscreenOnScreenKeyboardOpen(event.currentTarget.ownerDocument); }}
          onChange={(event) => {
            setApiKeyDraft(event.currentTarget.value);
          }}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={getCompactActionStackStyle()}>
          <DeckyProviderSettingsActionGroup>
            <DeckyCompactPillActionItem
              emphasis="primary"
              label={saveLabel}
              onClick={() => {
                void handleSave();
              }}
            />

            {onClear !== undefined && config !== undefined ? (
              <DeckyCompactPillActionItem
                label={clearLabel ?? "Clear credentials"}
                onClick={() => {
                  void handleClear();
                }}
              />
            ) : null}
          </DeckyProviderSettingsActionGroup>

          <div style={getCompactActionNoteStyle()}>
            Saves your account details and provider options. Leave the API key blank to keep your saved key.
          </div>
          {onClear !== undefined && config !== undefined ? (
            <div style={getCompactActionNoteStyle()}>
              Remove the saved RetroAchievements account from this device.
            </div>
          ) : null}
        </div>
      </PanelSectionRow>
    </div>
  );
}
