import { useEffect, useState } from "react";
import type { GameDetailSnapshot } from "@core/domain";
import { subscribeDeckyGameDetailPublication } from "./decky-game-detail-publication";
import { getDeckyAccountRevision } from "./decky-account-revision";

/** Retained views observe canonical progress without initiating requests or owning a cache. */
export function useDeckyUpNextSnapshot(source: GameDetailSnapshot | undefined): GameDetailSnapshot | undefined {
  const providerId = source?.game.providerId ?? "";
  const gameId = source?.game.gameId;
  const accountRevision = getDeckyAccountRevision(providerId);
  const [published, setPublished] = useState<{ source: GameDetailSnapshot | undefined; snapshot: GameDetailSnapshot; accountRevision: number }>();
  useEffect(() => subscribeDeckyGameDetailPublication((snapshot) => {
    if (accountRevision === getDeckyAccountRevision(providerId) && snapshot.game.providerId === providerId && snapshot.game.gameId === gameId) {
      setPublished({ source, snapshot, accountRevision });
    }
  }), [source, providerId, gameId, accountRevision]);
  return published?.source === source && published?.accountRevision === accountRevision ? published.snapshot : source;
}
