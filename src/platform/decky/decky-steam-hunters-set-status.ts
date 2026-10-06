import type { DeckySteamHuntersGameViewModel } from "./decky-steam-hunters-view-model";

export function isSteamHuntersSetFullyObtainable(
  health: DeckySteamHuntersGameViewModel["completionHealth"],
): boolean {
  return health.hasPaidDlc === false
    && health.unobtainableCount === 0
    && health.conditionalCount === 0
    && health.brokenButObtainableCount === 0;
}
