export interface DeckyPasswordInputFieldDescriptor {
  readonly ariaLabel: string;
  readonly autoCapitalize: string;
  readonly autoComplete: string;
  readonly autoCorrect: string;
  readonly inputMode: "text";
  readonly spellCheck: boolean;
  readonly bIsPassword: boolean;
}

export const RETROACHIEVEMENTS_CREDENTIAL_HELPER_COPY =
  "Log in to RetroAchievements, open https://retroachievements.org/settings, scroll to Authentication, and copy your Web API Key. Use your RetroAchievements username for the username field.";

export function getRetroAchievementsCredentialsFieldSpecs() {
  return {
    username: {
      label: "Username",
      description: "Use your RetroAchievements username.",
      isPassword: false,
    },
    apiKey: {
      label: "API key",
      description: "Paste your RetroAchievements Web API Key.",
      isPassword: true,
    },
  } as const;
}

export function getRetroAchievementsApiKeyDescription(hasSavedApiKey: boolean): string {
  return hasSavedApiKey ? "API key configured. Enter a new key to replace it." : "Enter your RetroAchievements API key.";
}

export function resolveRetroAchievementsApiKeyForSave(draftApiKey: string): string | undefined {
  const nextApiKey = draftApiKey.trim();
  return nextApiKey.length > 0 ? nextApiKey : undefined;
}

export function getRetroAchievementsApiKeyInputDescriptor(
  hasSavedApiKey: boolean,
): DeckyPasswordInputFieldDescriptor & { readonly description: string } {
  return {
    ariaLabel: "RetroAchievements Web API key",
    autoCapitalize: "none",
    autoComplete: "off",
    inputMode: "text",
    autoCorrect: "off",
    spellCheck: false,
    bIsPassword: true,
    description: getRetroAchievementsApiKeyDescription(hasSavedApiKey),
  };
}

export interface RetroAchievementsCredentialsFormModel {
  readonly usernameValue: string;
  readonly usernameDescription: string;
  readonly apiKeyValue: string;
  readonly apiKeyIsPassword: true;
  readonly apiKeyDescription: string;
  readonly hasSavedApiKey: boolean;
}

export function buildRetroAchievementsCredentialsFormModel(
  config: { readonly username?: string; readonly hasApiKey?: boolean } | undefined,
  usernameDraft: string,
  apiKeyDraft: string,
): RetroAchievementsCredentialsFormModel {
  const hasSavedApiKey = config?.hasApiKey === true;

  return {
    usernameValue: usernameDraft,
    usernameDescription: "Use your RetroAchievements username.",
    apiKeyValue: apiKeyDraft,
    apiKeyIsPassword: true,
    apiKeyDescription: getRetroAchievementsApiKeyDescription(hasSavedApiKey),
    hasSavedApiKey,
  };
}
