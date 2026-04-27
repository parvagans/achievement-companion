import type { CSSProperties } from "react";
import type { ProviderConfigStore } from "@core/platform";
import type { RetroAchievementsProviderConfig } from "../../providers/retroachievements/config";
import {
  DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
  RETROACHIEVEMENTS_PROVIDER_ID,
} from "../../providers/retroachievements/config";
import type { SteamProviderConfig } from "../../providers/steam/config";
import {
  DEFAULT_STEAM_PROVIDER_CONFIG,
  STEAM_PROVIDER_ID,
} from "../../providers/steam/config";
import type {
  SteamOSProviderConfigStatus,
  SteamOSProviderStatus,
} from "./bootstrap";
import type {
  SteamOSProviderConfigValue,
  SteamOSRetroAchievementsConfigSave,
  SteamOSSteamConfigSave,
} from "./steamos-adapters";

export interface SteamOSProviderConfigs {
  readonly retroAchievements: RetroAchievementsProviderConfig;
  readonly steam: SteamProviderConfig;
}

export interface SteamOSRetroAchievementsFormValues {
  readonly username: string;
  readonly apiKeyDraft: string;
}

export interface SteamOSSteamFormValues {
  readonly steamId64: string;
  readonly apiKeyDraft: string;
}

export interface SteamOSSetupFormValues {
  readonly retroAchievements: SteamOSRetroAchievementsFormValues;
  readonly steam: SteamOSSteamFormValues;
}

export interface SteamOSSetupSurfaceMessages {
  readonly retroAchievements?: string;
  readonly steam?: string;
  readonly providerConfig?: string;
}

export interface SteamOSSetupSurfaceProps {
  readonly providerConfigStatus?: "loaded" | "unavailable";
  readonly providerStatuses?: {
    readonly retroAchievements: SteamOSProviderStatus;
    readonly steam: SteamOSProviderStatus;
  };
  readonly values: SteamOSSetupFormValues;
  readonly messages?: SteamOSSetupSurfaceMessages;
  readonly busyProviderId?: typeof RETROACHIEVEMENTS_PROVIDER_ID | typeof STEAM_PROVIDER_ID;
  readonly onRetroAchievementsUsernameChange?: (value: string) => void;
  readonly onRetroAchievementsApiKeyDraftChange?: (value: string) => void;
  readonly onSteamId64Change?: (value: string) => void;
  readonly onSteamApiKeyDraftChange?: (value: string) => void;
  readonly onSaveRetroAchievements?: () => void;
  readonly onSaveSteam?: () => void;
  readonly onClearRetroAchievements?: () => void;
  readonly onClearSteam?: () => void;
}

interface SaveSuccess {
  readonly ok: true;
  readonly configs: SteamOSProviderConfigs;
  readonly values: SteamOSSetupFormValues;
}

interface SaveFailure {
  readonly ok: false;
  readonly message: string;
  readonly values: SteamOSSetupFormValues;
}

type SaveResult = SaveSuccess | SaveFailure;

const RETROACHIEVEMENTS_SAVE_ERROR = "Could not save RetroAchievements settings";
const STEAM_SAVE_ERROR = "Could not save Steam settings";
const RETROACHIEVEMENTS_CLEAR_ERROR = "Could not clear RetroAchievements settings";
const STEAM_CLEAR_ERROR = "Could not clear Steam settings";
const RETROACHIEVEMENTS_USERNAME_ID = "steamos-retroachievements-username";
const RETROACHIEVEMENTS_API_KEY_ID = "steamos-retroachievements-api-key";
const STEAM_ID64_ID = "steamos-steam-id64";
const STEAM_API_KEY_ID = "steamos-steam-api-key";

const SURFACE_STYLE: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const HELP_TEXT_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  lineHeight: 1.55,
  color: "#cbd5e1",
};

const PROVIDER_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "1rem",
};

const PROVIDER_CARD_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "18px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.74) 100%)",
  padding: "1.1rem",
  boxShadow: "0 16px 36px rgba(2, 6, 23, 0.24)",
  display: "grid",
  gap: "1rem",
};

const PROVIDER_HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const PROVIDER_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  color: "#f8fafc",
};

const FIELD_GRID_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.9rem",
};

const FIELD_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const LABEL_STYLE: CSSProperties = {
  fontWeight: 700,
  color: "#e2e8f0",
};

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.26)",
  padding: "0.9rem 1rem",
  minHeight: "52px",
  fontSize: "1rem",
  lineHeight: 1.4,
  color: "#e2e8f0",
  backgroundColor: "rgba(15, 23, 42, 0.86)",
};

const PROVIDER_HELP_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  lineHeight: 1.5,
  color: "#94a3b8",
};

const BUTTON_ROW_STYLE: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const PRIMARY_BUTTON_STYLE: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(59, 130, 246, 0.35)",
  borderRadius: "999px",
  background: "linear-gradient(180deg, rgba(37, 99, 235, 0.96) 0%, rgba(29, 78, 216, 0.96) 100%)",
  color: "#ffffff",
  padding: "0.9rem 1rem",
  minHeight: "50px",
  minWidth: "148px",
  fontWeight: 700,
  cursor: "pointer",
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  borderRadius: "999px",
  backgroundColor: "rgba(15, 23, 42, 0.72)",
  color: "#e2e8f0",
  padding: "0.9rem 1rem",
  minHeight: "50px",
  minWidth: "148px",
  fontWeight: 700,
  cursor: "pointer",
};

const ERROR_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#fda4af",
  fontWeight: 700,
};

const STATUS_BADGE_BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.4rem 0.75rem",
  minHeight: "2rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  border: "1px solid transparent",
};

function formatProviderStatus(status: SteamOSProviderConfigStatus | undefined): string {
  if (status === "configured") {
    return "configured";
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  return "not configured";
}

function getStatusBadgeStyle(status: SteamOSProviderConfigStatus | undefined): CSSProperties {
  if (status === "configured") {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#dcfce7",
      color: "#166534",
    };
  }

  if (status === "unavailable") {
    return {
      ...STATUS_BADGE_BASE_STYLE,
      backgroundColor: "#fef3c7",
      color: "#92400e",
    };
  }

  return {
    ...STATUS_BADGE_BASE_STYLE,
    backgroundColor: "#e5e7eb",
    color: "#374151",
  };
}

function isNumericLookingSteamId64(value: string): boolean {
  return /^\d{15,20}$/u.test(value);
}

export function createSteamOSSetupFormValues(
  configs?: Partial<SteamOSProviderConfigs>,
): SteamOSSetupFormValues {
  return {
    retroAchievements: {
      username: configs?.retroAchievements?.username ?? DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG.username,
      apiKeyDraft: "",
    },
    steam: {
      steamId64: configs?.steam?.steamId64 ?? DEFAULT_STEAM_PROVIDER_CONFIG.steamId64,
      apiKeyDraft: "",
    },
  };
}

export function validateRetroAchievementsSetup(
  values: SteamOSRetroAchievementsFormValues,
  currentConfig: RetroAchievementsProviderConfig,
): string | undefined {
  if (values.username.trim() === "") {
    return RETROACHIEVEMENTS_SAVE_ERROR;
  }

  if (currentConfig.hasApiKey !== true && values.apiKeyDraft.trim() === "") {
    return RETROACHIEVEMENTS_SAVE_ERROR;
  }

  return undefined;
}

export function validateSteamSetup(
  values: SteamOSSteamFormValues,
  currentConfig: SteamProviderConfig,
): string | undefined {
  const steamId64 = values.steamId64.trim();
  if (steamId64 === "" || !isNumericLookingSteamId64(steamId64)) {
    return STEAM_SAVE_ERROR;
  }

  if (currentConfig.hasApiKey !== true && values.apiKeyDraft.trim() === "") {
    return STEAM_SAVE_ERROR;
  }

  return undefined;
}

function buildRetroAchievementsSaveConfig(
  values: SteamOSRetroAchievementsFormValues,
  currentConfig: RetroAchievementsProviderConfig,
): SteamOSRetroAchievementsConfigSave {
  const apiKeyDraft = values.apiKeyDraft.trim();

  return {
    username: values.username.trim(),
    hasApiKey: currentConfig.hasApiKey,
    ...(currentConfig.recentAchievementsCount !== undefined
      ? { recentAchievementsCount: currentConfig.recentAchievementsCount }
      : {}),
    ...(currentConfig.recentlyPlayedCount !== undefined
      ? { recentlyPlayedCount: currentConfig.recentlyPlayedCount }
      : {}),
    ...(apiKeyDraft !== "" ? { apiKeyDraft } : {}),
  };
}

function buildSteamSaveConfig(
  values: SteamOSSteamFormValues,
  currentConfig: SteamProviderConfig,
): SteamOSSteamConfigSave {
  const apiKeyDraft = values.apiKeyDraft.trim();

  return {
    steamId64: values.steamId64.trim(),
    hasApiKey: currentConfig.hasApiKey,
    language: currentConfig.language || DEFAULT_STEAM_PROVIDER_CONFIG.language,
    recentAchievementsCount: currentConfig.recentAchievementsCount,
    recentlyPlayedCount: currentConfig.recentlyPlayedCount,
    includePlayedFreeGames: currentConfig.includePlayedFreeGames,
    ...(apiKeyDraft !== "" ? { apiKeyDraft } : {}),
  };
}

export async function saveRetroAchievementsSetup(
  providerConfigStore: Pick<ProviderConfigStore<SteamOSProviderConfigValue>, "save">,
  values: SteamOSSetupFormValues,
  currentConfig: RetroAchievementsProviderConfig,
  currentConfigs: SteamOSProviderConfigs,
): Promise<SaveResult> {
  const validationError = validateRetroAchievementsSetup(values.retroAchievements, currentConfig);
  if (validationError !== undefined) {
    return {
      ok: false,
      message: validationError,
      values: {
        ...values,
        retroAchievements: {
          ...values.retroAchievements,
          apiKeyDraft: "",
        },
      },
    };
  }

  try {
    const savedConfig = await providerConfigStore.save(
      RETROACHIEVEMENTS_PROVIDER_ID,
      buildRetroAchievementsSaveConfig(values.retroAchievements, currentConfig),
    );
    if (savedConfig === undefined || !("username" in savedConfig)) {
      return {
        ok: false,
        message: RETROACHIEVEMENTS_SAVE_ERROR,
        values: {
          ...values,
          retroAchievements: {
            ...values.retroAchievements,
            apiKeyDraft: "",
          },
        },
      };
    }

    const nextRetroConfig = savedConfig as RetroAchievementsProviderConfig;
    return {
      ok: true,
      configs: {
        ...currentConfigs,
        retroAchievements: nextRetroConfig,
      },
      values: {
        ...values,
        retroAchievements: {
          username: nextRetroConfig.username,
          apiKeyDraft: "",
        },
      },
    };
  } catch {
    return {
      ok: false,
      message: RETROACHIEVEMENTS_SAVE_ERROR,
      values: {
        ...values,
        retroAchievements: {
          ...values.retroAchievements,
          apiKeyDraft: "",
        },
      },
    };
  }
}

export async function saveSteamSetup(
  providerConfigStore: Pick<ProviderConfigStore<SteamOSProviderConfigValue>, "save">,
  values: SteamOSSetupFormValues,
  currentConfig: SteamProviderConfig,
  currentConfigs: SteamOSProviderConfigs,
): Promise<SaveResult> {
  const validationError = validateSteamSetup(values.steam, currentConfig);
  if (validationError !== undefined) {
    return {
      ok: false,
      message: validationError,
      values: {
        ...values,
        steam: {
          ...values.steam,
          apiKeyDraft: "",
        },
      },
    };
  }

  try {
    const savedConfig = await providerConfigStore.save(
      STEAM_PROVIDER_ID,
      buildSteamSaveConfig(values.steam, currentConfig),
    );
    if (savedConfig === undefined || !("steamId64" in savedConfig)) {
      return {
        ok: false,
        message: STEAM_SAVE_ERROR,
        values: {
          ...values,
          steam: {
            ...values.steam,
            apiKeyDraft: "",
          },
        },
      };
    }

    const nextSteamConfig = savedConfig as SteamProviderConfig;
    return {
      ok: true,
      configs: {
        ...currentConfigs,
        steam: nextSteamConfig,
      },
      values: {
        ...values,
        steam: {
          steamId64: nextSteamConfig.steamId64,
          apiKeyDraft: "",
        },
      },
    };
  } catch {
    return {
      ok: false,
      message: STEAM_SAVE_ERROR,
      values: {
        ...values,
        steam: {
          ...values.steam,
          apiKeyDraft: "",
        },
      },
    };
  }
}

export async function clearRetroAchievementsSetup(
  providerConfigStore: Pick<ProviderConfigStore<SteamOSProviderConfigValue>, "clear">,
  values: SteamOSSetupFormValues,
  currentConfigs: SteamOSProviderConfigs,
): Promise<SaveResult> {
  try {
    const cleared = await providerConfigStore.clear(RETROACHIEVEMENTS_PROVIDER_ID);
    if (!cleared) {
      return {
        ok: false,
        message: RETROACHIEVEMENTS_CLEAR_ERROR,
        values,
      };
    }

    return {
      ok: true,
      configs: {
        ...currentConfigs,
        retroAchievements: DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
      },
      values: {
        ...values,
        retroAchievements: {
          username: "",
          apiKeyDraft: "",
        },
      },
    };
  } catch {
    return {
      ok: false,
      message: RETROACHIEVEMENTS_CLEAR_ERROR,
      values,
    };
  }
}

export async function clearSteamSetup(
  providerConfigStore: Pick<ProviderConfigStore<SteamOSProviderConfigValue>, "clear">,
  values: SteamOSSetupFormValues,
  currentConfigs: SteamOSProviderConfigs,
): Promise<SaveResult> {
  try {
    const cleared = await providerConfigStore.clear(STEAM_PROVIDER_ID);
    if (!cleared) {
      return {
        ok: false,
        message: STEAM_CLEAR_ERROR,
        values,
      };
    }

    return {
      ok: true,
      configs: {
        ...currentConfigs,
        steam: DEFAULT_STEAM_PROVIDER_CONFIG,
      },
      values: {
        ...values,
        steam: {
          steamId64: "",
          apiKeyDraft: "",
        },
      },
    };
  } catch {
    return {
      ok: false,
      message: STEAM_CLEAR_ERROR,
      values,
    };
  }
}

export function SteamOSSetupSurface(props: SteamOSSetupSurfaceProps): JSX.Element {
  const isSavingRetroAchievements = props.busyProviderId === RETROACHIEVEMENTS_PROVIDER_ID;
  const isSavingSteam = props.busyProviderId === STEAM_PROVIDER_ID;

  return (
    <section id="steamos-setup-surface" aria-label="SteamOS provider setup" style={SURFACE_STYLE}>
      <p style={HELP_TEXT_STYLE}>
        Saving stores credentials in the local backend only. This setup surface does not validate provider
        connectivity yet.
      </p>
      {props.providerConfigStatus === "unavailable" ? (
        <p role="alert" style={ERROR_TEXT_STYLE}>Provider config unavailable</p>
      ) : null}
      <div style={PROVIDER_GRID_STYLE}>
        <section
          aria-label="RetroAchievements setup"
          aria-busy={isSavingRetroAchievements}
          data-steamos-focus-group="true"
          style={PROVIDER_CARD_STYLE}
        >
          <div style={PROVIDER_HEADER_STYLE}>
            <h2 style={PROVIDER_TITLE_STYLE}>RetroAchievements</h2>
            <span style={getStatusBadgeStyle(props.providerStatuses?.retroAchievements.status)}>
              {formatProviderStatus(props.providerStatuses?.retroAchievements.status)}
            </span>
          </div>
          <p style={PROVIDER_HELP_STYLE}>
            Save your username and API key locally so the SteamOS runtime can use them later.
          </p>
          <div style={FIELD_GRID_STYLE}>
            <div style={FIELD_STYLE}>
              <label htmlFor={RETROACHIEVEMENTS_USERNAME_ID} style={LABEL_STYLE}>Username</label>
              <input
                id={RETROACHIEVEMENTS_USERNAME_ID}
                className="steamos-focus-target steamos-input-target"
                name="retroachievements-username"
                type="text"
                autoComplete="username"
                placeholder="RetroAchievements username"
                value={props.values.retroAchievements.username}
                style={INPUT_STYLE}
                onChange={(event) => props.onRetroAchievementsUsernameChange?.(event.currentTarget.value)}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label htmlFor={RETROACHIEVEMENTS_API_KEY_ID} style={LABEL_STYLE}>API key</label>
              <input
                id={RETROACHIEVEMENTS_API_KEY_ID}
                className="steamos-focus-target steamos-input-target"
                name="retroachievements-api-key"
                type="password"
                autoComplete="off"
                placeholder="Saved in backend only"
                value={props.values.retroAchievements.apiKeyDraft}
                style={INPUT_STYLE}
                onChange={(event) => props.onRetroAchievementsApiKeyDraftChange?.(event.currentTarget.value)}
              />
            </div>
          </div>
          {props.messages?.retroAchievements !== undefined ? (
            <p role="alert" style={ERROR_TEXT_STYLE}>{props.messages.retroAchievements}</p>
          ) : null}
          <div className="steamos-action-row" style={BUTTON_ROW_STYLE}>
            <button
              className="steamos-focus-target steamos-button-target"
              type="button"
              onClick={props.onSaveRetroAchievements}
              disabled={isSavingRetroAchievements}
              style={PRIMARY_BUTTON_STYLE}
            >
              {isSavingRetroAchievements ? "Saving..." : "Save"}
            </button>
            <button
              className="steamos-focus-target steamos-button-target"
              type="button"
              onClick={props.onClearRetroAchievements}
              disabled={isSavingRetroAchievements}
              style={SECONDARY_BUTTON_STYLE}
            >
              Clear
            </button>
          </div>
        </section>

        <section
          aria-label="Steam setup"
          aria-busy={isSavingSteam}
          data-steamos-focus-group="true"
          style={PROVIDER_CARD_STYLE}
        >
          <div style={PROVIDER_HEADER_STYLE}>
            <h2 style={PROVIDER_TITLE_STYLE}>Steam</h2>
            <span style={getStatusBadgeStyle(props.providerStatuses?.steam.status)}>
              {formatProviderStatus(props.providerStatuses?.steam.status)}
            </span>
          </div>
          <p style={PROVIDER_HELP_STYLE}>
            Save your SteamID64 and Web API key locally. This does not call Steam or validate connectivity yet.
          </p>
          <div style={FIELD_GRID_STYLE}>
            <div style={FIELD_STYLE}>
              <label htmlFor={STEAM_ID64_ID} style={LABEL_STYLE}>SteamID64</label>
              <input
                id={STEAM_ID64_ID}
                className="steamos-focus-target steamos-input-target"
                name="steam-id64"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Numeric SteamID64"
                value={props.values.steam.steamId64}
                style={INPUT_STYLE}
                onChange={(event) => props.onSteamId64Change?.(event.currentTarget.value)}
              />
            </div>
            <div style={FIELD_STYLE}>
              <label htmlFor={STEAM_API_KEY_ID} style={LABEL_STYLE}>Steam Web API key</label>
              <input
                id={STEAM_API_KEY_ID}
                className="steamos-focus-target steamos-input-target"
                name="steam-api-key"
                type="password"
                autoComplete="off"
                placeholder="Saved in backend only"
                value={props.values.steam.apiKeyDraft}
                style={INPUT_STYLE}
                onChange={(event) => props.onSteamApiKeyDraftChange?.(event.currentTarget.value)}
              />
            </div>
          </div>
          {props.messages?.steam !== undefined ? (
            <p role="alert" style={ERROR_TEXT_STYLE}>{props.messages.steam}</p>
          ) : null}
          <div className="steamos-action-row" style={BUTTON_ROW_STYLE}>
            <button
              className="steamos-focus-target steamos-button-target"
              type="button"
              onClick={props.onSaveSteam}
              disabled={isSavingSteam}
              style={PRIMARY_BUTTON_STYLE}
            >
              {isSavingSteam ? "Saving..." : "Save"}
            </button>
            <button
              className="steamos-focus-target steamos-button-target"
              type="button"
              onClick={props.onClearSteam}
              disabled={isSavingSteam}
              style={SECONDARY_BUTTON_STYLE}
            >
              Clear
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
