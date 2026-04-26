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

function formatProviderStatus(status: SteamOSProviderConfigStatus | undefined): string {
  if (status === "configured") {
    return "configured";
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  return "not configured";
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
    <section aria-label="SteamOS provider setup">
      {props.providerConfigStatus === "unavailable" ? (
        <p>Provider config unavailable</p>
      ) : null}

      <section aria-label="RetroAchievements setup">
        <h2>RetroAchievements</h2>
        <p>{formatProviderStatus(props.providerStatuses?.retroAchievements.status)}</p>
        <label>
          Username
          <input
            name="retroachievements-username"
            type="text"
            value={props.values.retroAchievements.username}
            onChange={(event) => props.onRetroAchievementsUsernameChange?.(event.currentTarget.value)}
          />
        </label>
        <label>
          API key
          <input
            name="retroachievements-api-key"
            type="password"
            autoComplete="off"
            value={props.values.retroAchievements.apiKeyDraft}
            onChange={(event) => props.onRetroAchievementsApiKeyDraftChange?.(event.currentTarget.value)}
          />
        </label>
        {props.messages?.retroAchievements !== undefined ? <p>{props.messages.retroAchievements}</p> : null}
        <button type="button" onClick={props.onSaveRetroAchievements} disabled={isSavingRetroAchievements}>
          Save
        </button>
        <button type="button" onClick={props.onClearRetroAchievements} disabled={isSavingRetroAchievements}>
          Clear
        </button>
      </section>

      <section aria-label="Steam setup">
        <h2>Steam</h2>
        <p>{formatProviderStatus(props.providerStatuses?.steam.status)}</p>
        <label>
          SteamID64
          <input
            name="steam-id64"
            type="text"
            inputMode="numeric"
            value={props.values.steam.steamId64}
            onChange={(event) => props.onSteamId64Change?.(event.currentTarget.value)}
          />
        </label>
        <label>
          Steam Web API key
          <input
            name="steam-api-key"
            type="password"
            autoComplete="off"
            value={props.values.steam.apiKeyDraft}
            onChange={(event) => props.onSteamApiKeyDraftChange?.(event.currentTarget.value)}
          />
        </label>
        {props.messages?.steam !== undefined ? <p>{props.messages.steam}</p> : null}
        <button type="button" onClick={props.onSaveSteam} disabled={isSavingSteam}>
          Save
        </button>
        <button type="button" onClick={props.onClearSteam} disabled={isSavingSteam}>
          Clear
        </button>
      </section>
    </section>
  );
}
