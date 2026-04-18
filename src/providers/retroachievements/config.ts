export const RETROACHIEVEMENTS_PROVIDER_ID = "retroachievements" as const;

// Assumption: the setup flow will need a username plus a secret token/API key.
// The provider adapter will own the exact validation rules.
export interface RetroAchievementsProviderConfig {
  readonly username: string;
  readonly apiKey: string;
}
