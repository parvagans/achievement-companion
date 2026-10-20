/** Bundled notes for the current update. Keep these in sync with the release notes. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Game pages",
    items: [
      "RetroAchievements game pages now show original box art and game details in Steam’s Game Info tab, with collections kept below.",
      "RetroAchievements game-page badges and details now refresh expired game data instead of disappearing.",
    ],
  },
  {
    title: "RetroAchievements data",
    items: [
      "RetroAchievements progress now handles incomplete achievement counts and missing unlock dates without showing misleading totals or dates.",
      "Hardcore achievements now appear only as Hardcore unlocks, including those previously earned in Softcore.",
      "Mode-specific game and system progress now stays unavailable when RetroAchievements does not provide reliable counts.",
    ],
  },
  {
    title: "Quick Access",
    items: [
      "Quick Access now identifies Achievement Companion correctly when its plugin entry is focused.",
    ],
  },
] as const;
