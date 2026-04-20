import { type CSSProperties, useEffect, useState } from "react";
import { Field, PanelSectionRow } from "@decky/ui";
import type { RetroAchievementsProviderConfig } from "../../../../providers/retroachievements";
import {
  DeckyCredentialTextField,
  getDeckyCredentialTextFieldMaskStyle,
} from "../../decky-credential-text-field";
import { DeckyActionButtonItem } from "../../decky-action-button-item";
import { DECKY_FOCUS_ACTION_ROW_CLASS } from "../../decky-focus-styles";
import {
  RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY,
  getRetroAchievementsApiKeyInputDescriptor,
  getRetroAchievementsCredentialsFieldSpecs,
} from "./credentials-help";

export interface DeckyRetroAchievementsCredentialsFormProps {
  readonly config: RetroAchievementsProviderConfig | undefined;
  readonly statusLabel: string;
  readonly helperCopy?: string;
  readonly saveLabel: string;
  readonly clearLabel?: string;
  readonly onSave: (
    config: Omit<RetroAchievementsProviderConfig, "hasApiKey">,
    apiKeyDraft: string,
  ) => boolean | Promise<boolean>;
  readonly onClear?: () => boolean | Promise<boolean>;
}

function getFormStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
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
      const saved = await onSave(
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
      setStatusCopy(saved ? "Provider settings saved." : "Unable to save provider settings right now.");
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

  return (
    <div style={getFormStyle()}>
      <Field bottomSeparator="none" label="Setup help" description={RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY} />

      <Field bottomSeparator="none" label={statusLabel} description={statusCopy} />

      <PanelSectionRow>
        <DeckyCredentialTextField
          focusOnMount={config === undefined}
          label={fieldSpecs.username.label}
          description={usernameDescription}
          value={username}
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
          style={getDeckyCredentialTextFieldMaskStyle()}
          onChange={(event) => {
            setApiKeyDraft(event.currentTarget.value);
          }}
        />
      </PanelSectionRow>

      <DeckyActionButtonItem
        className={DECKY_FOCUS_ACTION_ROW_CLASS}
        focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
        focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
        highlightOnFocus
        label={saveLabel}
        description="Saves your account details and the provider options on this page. If the API key field is empty, your saved key is kept."
        onClick={() => {
          void handleSave();
        }}
      />

      {onClear !== undefined && config !== undefined ? (
        <DeckyActionButtonItem
          className={DECKY_FOCUS_ACTION_ROW_CLASS}
          focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
          focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
          highlightOnFocus
          label={clearLabel ?? "Clear credentials"}
          description="Remove the saved RetroAchievements account from this device."
          onClick={() => {
            void handleClear();
          }}
        />
      ) : null}
    </div>
  );
}
