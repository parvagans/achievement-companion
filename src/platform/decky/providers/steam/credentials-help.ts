export interface DeckyPasswordInputFieldDescriptor {
  readonly ariaLabel: string;
  readonly autoCapitalize: string;
  readonly autoComplete: string;
  readonly autoCorrect: string;
  readonly inputMode: "text";
  readonly spellCheck: boolean;
  readonly bIsPassword: boolean;
}

export const STEAM_CREDENTIAL_HELPER_COPY =
  "Copy your Steam profile URL, for example https://steamcommunity.com/id/username, paste it into https://steamid.io/ to find your steamID64, then open https://steamcommunity.com/dev/apikey to create or copy your Steam Web API Key.";

export function getSteamCredentialsFieldSpecs() {
  return {
    steamId64: {
      label: "SteamID64",
      description: "Enter the SteamID64 for the account you want to browse.",
      isPassword: false,
    },
    apiKey: {
      label: "Web API key",
      description: "Paste your Steam Web API key.",
      isPassword: true,
    },
    language: {
      label: "Language",
      description: "Use the Steam achievement language code, usually english.",
    },
  } as const;
}

export function getSteamApiKeyDescription(hasSavedApiKey: boolean): string {
  return hasSavedApiKey ? "API key configured. Enter a new key to replace it." : "Enter your Steam Web API key.";
}

export function resolveSteamApiKeyForSave(draftApiKey: string): string | undefined {
  const nextApiKey = draftApiKey.trim();
  return nextApiKey.length > 0 ? nextApiKey : undefined;
}

export function getSteamApiKeyInputDescriptor(
  hasSavedApiKey: boolean,
): DeckyPasswordInputFieldDescriptor & { readonly description: string } {
  return {
    ariaLabel: "Steam Web API key",
    autoCapitalize: "none",
    autoComplete: "off",
    autoCorrect: "off",
    inputMode: "text",
    spellCheck: false,
    bIsPassword: true,
    description: getSteamApiKeyDescription(hasSavedApiKey),
  };
}

export interface SteamCredentialsFormModel {
  readonly steamId64Value: string;
  readonly steamId64Description: string;
  readonly apiKeyValue: string;
  readonly apiKeyIsPassword: true;
  readonly apiKeyDescription: string;
  readonly languageValue: string;
  readonly hasSavedApiKey: boolean;
}

export function buildSteamCredentialsFormModel(
  config:
    | {
        readonly steamId64?: string;
        readonly hasApiKey?: boolean;
        readonly language?: string;
      }
    | undefined,
  steamId64Draft: string,
  apiKeyDraft: string,
  languageDraft: string,
): SteamCredentialsFormModel {
  const hasSavedApiKey = config?.hasApiKey === true;

  return {
    steamId64Value: steamId64Draft,
    steamId64Description: "Enter the SteamID64 for the account you want to browse.",
    apiKeyValue: apiKeyDraft,
    apiKeyIsPassword: true,
    apiKeyDescription: getSteamApiKeyDescription(hasSavedApiKey),
    languageValue: languageDraft,
    hasSavedApiKey,
  };
}
