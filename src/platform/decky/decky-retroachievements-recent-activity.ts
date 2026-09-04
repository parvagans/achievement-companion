const RETROACHIEVEMENTS_NOW_PLAYING_WINDOW_MS = 5 * 60 * 1000;

export type RetroAchievementsRecentActivityLabel = "Now Playing" | "Last Played";

/**
 * RetroAchievements supplies a last-activity timestamp, not a live-session flag.
 * Treat only a fresh server-reported activity update as currently playing.
 */
export function getRetroAchievementsRecentActivityLabel(
  lastPlayedAt: number | undefined,
  now = Date.now(),
): RetroAchievementsRecentActivityLabel {
  if (
    lastPlayedAt !== undefined &&
    Number.isFinite(lastPlayedAt) &&
    lastPlayedAt <= now &&
    now - lastPlayedAt <= RETROACHIEVEMENTS_NOW_PLAYING_WINDOW_MS
  ) {
    return "Now Playing";
  }

  return "Last Played";
}
