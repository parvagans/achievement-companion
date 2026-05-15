import { type CSSProperties, useEffect, useState } from "react";
import { Field, PanelSectionRow, TextField } from "@decky/ui";
import { ACHIEVEMENT_COMPANION_COUNT_OPTIONS, type AchievementCompanionCount } from "@core/settings";
import type { SteamProviderConfig } from "../../../../providers/steam";
import {
  DeckyCredentialTextField,
  getDeckyCredentialTextFieldMaskStyle,
} from "../../decky-credential-text-field";
import { DeckyCompactPillActionItem } from "../../decky-compact-pill-action-item";
import { DeckyActionButtonItem } from "../../decky-action-button-item";
import { DECKY_FOCUS_ACTION_ROW_CLASS } from "../../decky-focus-styles";
import {
  STEAM_CREDENTIAL_HELPER_COPY,
  getSteamApiKeyInputDescriptor,
  getSteamCredentialsFieldSpecs,
} from "./credentials-help";

export interface DeckySteamProviderCredentialsFormProps {
  readonly config: SteamProviderConfig | undefined;
  readonly statusLabel: string;
  readonly helperCopy?: string;
  readonly saveLabel: string;
  readonly clearLabel?: string;
  readonly compactSurface?: boolean;
  readonly onSave: (
    config: Omit<SteamProviderConfig, "hasApiKey">,
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

function getCompactFormStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

function getCompactCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.03))",
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
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.72em",
    fontWeight: 800,
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
    border: isConnected ? "1px solid rgba(96, 165, 250, 0.38)" : "1px solid rgba(214, 158, 46, 0.48)",
    background: isConnected ? "rgba(96, 165, 250, 0.12)" : "rgba(214, 158, 46, 0.12)",
    color: isConnected ? "rgba(226, 236, 255, 0.98)" : "rgba(255, 244, 201, 0.98)",
    fontSize: "11px",
    fontWeight: 750,
    letterSpacing: "0.04em",
    lineHeight: 1.15,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

function getCompactCardTextStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.9em",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  };
}

function getCompactFieldCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    boxSizing: "border-box",
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
    color: "rgba(255, 255, 255, 0.64)",
    fontSize: "0.82em",
    lineHeight: 1.35,
  };
}

function getStatusCopy(config: SteamProviderConfig | undefined): string {
  return config !== undefined ? `Connected to Steam ID64 ${config.steamId64}.` : "Set up your Steam account.";
}

function getNextCountOption(current: AchievementCompanionCount): AchievementCompanionCount {
  const currentIndex = ACHIEVEMENT_COMPANION_COUNT_OPTIONS.indexOf(current);
  return ACHIEVEMENT_COMPANION_COUNT_OPTIONS[
    (currentIndex + 1) % ACHIEVEMENT_COMPANION_COUNT_OPTIONS.length
  ]!;
}

function getToggleCopy(value: boolean): string {
  return value ? "Current: On" : "Current: Off";
}

function PreferenceRow({
  label,
  description,
  onClick,
}: {
  readonly label: string;
  readonly description: string;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <DeckyActionButtonItem
      className={DECKY_FOCUS_ACTION_ROW_CLASS}
      focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
      focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
      highlightOnFocus
      label={label}
      description={description}
      onClick={onClick}
    />
  );
}

export function DeckySteamProviderCredentialsForm({
  config,
  statusLabel,
  helperCopy,
  saveLabel,
  clearLabel,
  compactSurface = false,
  onSave,
  onClear,
}: DeckySteamProviderCredentialsFormProps): JSX.Element {
  const fieldSpecs = getSteamCredentialsFieldSpecs();
  const [steamId64, setSteamId64] = useState(config?.steamId64 ?? "");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [language, setLanguage] = useState(config?.language ?? "english");
  const [recentAchievementsCount, setRecentAchievementsCount] = useState(
    config?.recentAchievementsCount ?? 5,
  );
  const [recentlyPlayedCount, setRecentlyPlayedCount] = useState(
    config?.recentlyPlayedCount ?? 5,
  );
  const [includePlayedFreeGames, setIncludePlayedFreeGames] = useState(
    config?.includePlayedFreeGames ?? false,
  );
  const [statusCopy, setStatusCopy] = useState(getStatusCopy(config));

  useEffect(() => {
    setSteamId64(config?.steamId64 ?? "");
    setApiKeyDraft("");
    setLanguage(config?.language ?? "english");
    setRecentAchievementsCount(config?.recentAchievementsCount ?? 5);
    setRecentlyPlayedCount(config?.recentlyPlayedCount ?? 5);
    setIncludePlayedFreeGames(config?.includePlayedFreeGames ?? false);
    setStatusCopy(getStatusCopy(config));
  }, [
    config?.hasApiKey,
    config?.includePlayedFreeGames,
    config?.language,
    config?.recentAchievementsCount,
    config?.recentlyPlayedCount,
    config?.steamId64,
  ]);

  async function handleSave(): Promise<void> {
    const trimmedSteamId64 = steamId64.trim();
    const trimmedApiKeyDraft = apiKeyDraft.trim();

    if (trimmedSteamId64.length === 0) {
      setStatusCopy("Enter your SteamID64 and API key to continue.");
      return;
    }

    if (trimmedApiKeyDraft.length === 0 && config?.hasApiKey !== true) {
      setStatusCopy("Enter your SteamID64 and API key to continue.");
      return;
    }

    if (!/^\d{15,20}$/u.test(trimmedSteamId64)) {
      setStatusCopy("Enter a valid SteamID64.");
      return;
    }

    try {
      const saved = await onSave(
        {
          steamId64: trimmedSteamId64,
          language: language.trim() || "english",
          recentAchievementsCount,
          recentlyPlayedCount,
          includePlayedFreeGames,
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
  const apiKeyInputDescriptor = getSteamApiKeyInputDescriptor(hasSavedApiKey);
  const steamIdDescription = helperCopy ?? fieldSpecs.steamId64.description;

  if (compactSurface) {
    return (
      <div style={getCompactFormStyle()}>
        <div style={getCompactCardStyle()}>
          <div style={getCompactCardHeaderStyle()}>
            <div style={getCompactCardLabelStyle()}>Setup help</div>
          </div>
          <div style={getCompactCardTextStyle()}>{helperCopy ?? STEAM_CREDENTIAL_HELPER_COPY}</div>
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
            label={fieldSpecs.steamId64.label}
            description={steamIdDescription}
            value={steamId64}
            onChange={(event) => {
              setSteamId64(event.currentTarget.value);
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
            style={getDeckyCredentialTextFieldMaskStyle()}
            onChange={(event) => {
              setApiKeyDraft(event.currentTarget.value);
            }}
          />
        </div>

        <div style={getCompactFieldCardStyle()}>
          <TextField
            label={fieldSpecs.language.label}
            description={fieldSpecs.language.description}
            value={language}
            onChange={(event) => {
              setLanguage(event.currentTarget.value);
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
    <div style={getFormStyle()}>
      <Field bottomSeparator="none" label="Setup help" description={STEAM_CREDENTIAL_HELPER_COPY} />

      <Field bottomSeparator="none" label={statusLabel} description={statusCopy} />

      <PanelSectionRow>
        <DeckyCredentialTextField
          focusOnMount={config === undefined}
          label={fieldSpecs.steamId64.label}
          description={steamIdDescription}
          value={steamId64}
          onChange={(event) => {
            setSteamId64(event.currentTarget.value);
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

      <PanelSectionRow>
        <TextField
          label={fieldSpecs.language.label}
          description={fieldSpecs.language.description}
          value={language}
          onChange={(event) => {
            setLanguage(event.currentTarget.value);
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
          description="Remove the saved Steam account from this device."
          onClick={() => {
            void handleClear();
          }}
        />
      ) : null}

      <Field
        bottomSeparator="none"
        label="Provider dashboard preferences"
        description="These settings affect the compact dashboard and library scan."
      />

      <PreferenceRow
        label="Recent Achievements count"
        description={`Current: ${String(recentAchievementsCount)}`}
        onClick={() => {
          setRecentAchievementsCount((current) => getNextCountOption(current));
        }}
      />

      <PreferenceRow
        label="Recently Played count"
        description={`Current: ${String(recentlyPlayedCount)}`}
        onClick={() => {
          setRecentlyPlayedCount((current) => getNextCountOption(current));
        }}
      />

      <PreferenceRow
        label="Include played free games"
        description={getToggleCopy(includePlayedFreeGames)}
        onClick={() => {
          setIncludePlayedFreeGames((current) => !current);
        }}
      />
    </div>
  );
}
