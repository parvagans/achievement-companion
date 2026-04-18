import type { RetroAchievementsProviderConfig } from "./retroachievements";
import { createRetroAchievementsDeckyProviderOption } from "./retroachievements";
import type { DeckyProviderOption } from "./provider-option";

export type { DeckyProviderOption } from "./provider-option";

export function getDeckyProviderOptions(
  retroAchievementsConfig: RetroAchievementsProviderConfig | undefined,
): readonly DeckyProviderOption[] {
  return [createRetroAchievementsDeckyProviderOption(retroAchievementsConfig)];
}
