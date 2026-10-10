export const STEAM_API_LANGUAGES = [
  { code: "arabic", label: "Arabic" },
  { code: "bulgarian", label: "Bulgarian" },
  { code: "schinese", label: "Chinese (Simplified)" },
  { code: "tchinese", label: "Chinese (Traditional)" },
  { code: "czech", label: "Czech" },
  { code: "danish", label: "Danish" },
  { code: "dutch", label: "Dutch" },
  { code: "english", label: "English" },
  { code: "finnish", label: "Finnish" },
  { code: "french", label: "French" },
  { code: "german", label: "German" },
  { code: "greek", label: "Greek" },
  { code: "hungarian", label: "Hungarian" },
  { code: "indonesian", label: "Indonesian" },
  { code: "italian", label: "Italian" },
  { code: "japanese", label: "Japanese" },
  { code: "koreana", label: "Korean" },
  { code: "malay", label: "Malay" },
  { code: "norwegian", label: "Norwegian" },
  { code: "polish", label: "Polish" },
  { code: "portuguese", label: "Portuguese" },
  { code: "brazilian", label: "Portuguese (Brazil)" },
  { code: "romanian", label: "Romanian" },
  { code: "russian", label: "Russian" },
  { code: "spanish", label: "Spanish (Spain)" },
  { code: "latam", label: "Spanish (Latin America)" },
  { code: "swedish", label: "Swedish" },
  { code: "thai", label: "Thai" },
  { code: "turkish", label: "Turkish" },
  { code: "ukrainian", label: "Ukrainian" },
  { code: "vietnamese", label: "Vietnamese" },
] as const;

export type SteamApiLanguageCode = (typeof STEAM_API_LANGUAGES)[number]["code"];

const steamApiLanguageCodes = new Set<string>(STEAM_API_LANGUAGES.map(({ code }) => code));

export function isSteamApiLanguageCode(value: unknown): value is SteamApiLanguageCode {
  return typeof value === "string" && steamApiLanguageCodes.has(value);
}

export function normalizeSteamApiLanguageCode(value: unknown): SteamApiLanguageCode {
  return isSteamApiLanguageCode(value) ? value : "english";
}

export function getSteamApiLanguageLabel(value: SteamApiLanguageCode): string {
  return STEAM_API_LANGUAGES.find(({ code }) => code === value)?.label ?? "English";
}
