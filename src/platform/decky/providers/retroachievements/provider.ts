import {
  RETROACHIEVEMENTS_PROVIDER_ID,
  type RetroAchievementsProviderConfig,
} from "../../../../providers/retroachievements";
import { RETROACHIEVEMENTS_PROVIDER_ICON_SRC } from "./icon";
import type { DeckyProviderOption } from "../provider-option";

export function createRetroAchievementsDeckyProviderOption(
  config: RetroAchievementsProviderConfig | undefined,
): DeckyProviderOption {
  return {
    id: RETROACHIEVEMENTS_PROVIDER_ID,
    label: "RetroAchievements",
    iconSrc: RETROACHIEVEMENTS_PROVIDER_ICON_SRC,
    enabled: true,
    connected: config !== undefined,
  };
}
