/** Bundled notes for the current update. Keep these in sync with the release notes. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Themes",
    items: [
      "Choose from AC Blue (default), Carbon, Ember, Grove, Neon, Paper, and Velvet.",
      "Theme colors now carry through Quick Access, full-screen views, controls, activity charts, and loading screens.",
    ],
  },
  {
    title: "Interface & navigation",
    items: [
      "Plugin Settings is cleaner, with a joined card, wider theme selector, and aligned badge controls.",
      "Quick Access activity cards are even in height, game titles are centered, and rank arrows persist.",
      "RetroAchievements View Achievements now opens the game's Quick Access list directly.",
    ],
  },
  {
    title: "Steam game data",
    items: [
      "Game pages keep cached SteamHunters details when an optional request fails or returns incomplete data.",
      "A count mismatch is shown when cached SteamHunters data covers a different achievement set than Steam.",
    ],
  },
] as const;
