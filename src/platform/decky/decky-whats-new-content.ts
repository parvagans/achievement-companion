/** Bundled notes for the current update. Keep these in sync with the release notes. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Themes",
    items: [
      "Choose from 15 themes, including Aurora, Rosewood, Solarized, and more.",
      "Theme colors now carry through Quick Access, full-screen views, controls, charts, icons, footers, and loading screens.",
      "Steam and RetroAchievements progression states retain their distinct meanings across every theme.",
    ],
  },
  {
    title: "Interface & navigation",
    items: [
      "Plugin Settings now uses expandable, joined sections with a wider theme selector and aligned badge controls.",
      "Quick Access activity cards have consistent heights, game names are centered, and rank arrows persist across refreshes.",
      "The View Achievements action for RetroAchievements recently played and currently playing games now opens that game's Quick Access achievement list.",
      "What's New now fits within the Steam Deck viewport and supports controller scrolling.",
    ],
  },
  {
    title: "Steam game data",
    items: [
      "Steam game pages retain cached SteamHunters details when an optional request fails or returns incomplete data.",
      "A mismatch notice appears when cached SteamHunters data covers a different achievement count from Steam's current set.",
    ],
  },
] as const;
