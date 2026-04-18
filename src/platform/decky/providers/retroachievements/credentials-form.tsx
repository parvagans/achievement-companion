import { type CSSProperties, useEffect, useState } from "react";
import { Field, PanelSectionRow, TextField } from "@decky/ui";
import type { RetroAchievementsProviderConfig } from "../../../../providers/retroachievements";
import { DeckyActionButtonItem } from "../../decky-action-button-item";
import { DECKY_FOCUS_ACTION_ROW_CLASS } from "../../decky-focus-styles";

export interface DeckyRetroAchievementsCredentialsFormProps {
  readonly config: RetroAchievementsProviderConfig | undefined;
  readonly statusLabel: string;
  readonly helperCopy: string;
  readonly saveLabel: string;
  readonly clearLabel?: string;
  readonly onSave: (config: RetroAchievementsProviderConfig) => boolean | Promise<boolean>;
  readonly onClear?: () => boolean | Promise<boolean>;
}

function getFormStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function getHelperStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: "0.88em",
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
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
  const [username, setUsername] = useState(config?.username ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [statusCopy, setStatusCopy] = useState(getStatusCopy(config));

  useEffect(() => {
    setUsername(config?.username ?? "");
    setApiKey(config?.apiKey ?? "");
    setStatusCopy(getStatusCopy(config));
  }, [config?.apiKey, config?.username]);

  async function handleSave(): Promise<void> {
    const nextConfig = {
      username: username.trim(),
      apiKey: apiKey.trim(),
    };

    if (nextConfig.username.length === 0 || nextConfig.apiKey.length === 0) {
      setStatusCopy("Enter both fields to continue.");
      return;
    }

    const saved = await onSave(nextConfig);
    setStatusCopy(saved ? `Signed in as ${nextConfig.username}.` : "Could not save credentials.");
  }

  async function handleClear(): Promise<void> {
    if (onClear === undefined) {
      return;
    }

    const cleared = await onClear();
    if (cleared) {
      setStatusCopy("Signed out.");
    } else {
      setStatusCopy("Could not clear credentials.");
    }
  }

  return (
    <div style={getFormStyle()}>
      <PanelSectionRow>
        <Field bottomSeparator="none" label={statusLabel} description={statusCopy} />
      </PanelSectionRow>

      <PanelSectionRow>
        <TextField
          focusOnMount={config === undefined}
          label="Username"
          description={helperCopy}
          value={username}
          onChange={(event) => {
            setUsername(event.currentTarget.value);
          }}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <TextField
          bIsPassword
          label="API key"
          description="Paste your RetroAchievements API key."
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.currentTarget.value);
          }}
        />
      </PanelSectionRow>

      <PanelSectionRow>
        <DeckyActionButtonItem
          className={DECKY_FOCUS_ACTION_ROW_CLASS}
          focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
          focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
          highlightOnFocus
          label={saveLabel}
          description={config === undefined ? "Save credentials to start browsing." : "Save your updated credentials."}
          onClick={() => {
            void handleSave();
          }}
        />
      </PanelSectionRow>

      {onClear !== undefined && config !== undefined ? (
        <PanelSectionRow>
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
        </PanelSectionRow>
      ) : null}
    </div>
  );
}
