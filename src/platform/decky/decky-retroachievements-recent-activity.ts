const RETROACHIEVEMENTS_ONLINE_WINDOW_MS = 10 * 60 * 1000; // matches RA's own "Online" threshold

export type RetroAchievementsRecentActivityLabel = "In game" | "Recently played";

/**
 * RA's site-wide convention (see API_GetUserSummary.php docblock):
 * a user counts as "Online"/in-game if RichPresenceMsgDate is within
 * the last 10 minutes. There is no dedicated live-session boolean;
 * this freshness check on the rich presence timestamp *is* the signal.
 */
export function getRetroAchievementsRecentActivityLabel(
  richPresenceMsgDate: number | undefined,
  now = Date.now(),
): RetroAchievementsRecentActivityLabel {
  if (
    richPresenceMsgDate !== undefined &&
    Number.isFinite(richPresenceMsgDate) &&
    richPresenceMsgDate <= now &&
    now - richPresenceMsgDate <= RETROACHIEVEMENTS_ONLINE_WINDOW_MS
  ) {
    return "In game";
  }

  return "Recently played";
}