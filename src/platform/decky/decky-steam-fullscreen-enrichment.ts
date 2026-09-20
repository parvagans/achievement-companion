import type { GameDetailSnapshot } from "@core/domain";
import { getSteamHuntersGameEnrichment } from "../../providers/steamhunters";
import { STEAM_PROVIDER_ID } from "../../providers/steam";

/**
 * The fullscreen Steam overview is a single dashboard. Hold it until its
 * optional SteamHunters follow-up lookup has settled so it never appears
 * partially populated and then redraws moments later.
 */
export function isDeckySteamFullscreenEnrichmentPending(
  snapshot: GameDetailSnapshot | undefined,
  settledSourceSnapshot: GameDetailSnapshot | undefined,
): boolean {
  return snapshot !== undefined &&
    snapshot.game.providerId === STEAM_PROVIDER_ID &&
    getSteamHuntersGameEnrichment(snapshot) === undefined &&
    settledSourceSnapshot !== snapshot;
}
