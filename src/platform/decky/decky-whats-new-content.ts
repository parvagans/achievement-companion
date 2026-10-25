/** Bundled notes for the current update. Keep these in sync with the release notes. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Overview",
    items: [
      "Steam and RetroAchievements game pages now use a non-scrolling Deck dashboard with clearer game identity, personal progress, latest unlock, and provider details.",
      "Beaten, Mastered, and Perfected games receive dedicated milestone showcases using the established flag or crown artwork and verified dates when available.",
      "Steam hero artwork fills its frame more naturally, while RetroAchievements prestige effects and your selected theme remain intact.",
    ],
  },
  {
    title: "Up Next",
    items: [
      "Up Next recommends three achievements using progression and available provider data, with community rarity and RetroAchievements classifications where supported.",
      "Open a recommendation's details, jump to it in Achievements, or hide it. Manage Suggestions can restore individual choices or every hidden suggestion.",
    ],
  },
  {
    title: "RA Goals",
    items: [
      "Choose Beat or Master as the global objective, then override individual games when needed. The current mode and goal stay visible beside Actions.",
      "Recommendations follow the selected objective without changing recorded Beaten or Mastered status, with full Hardcore and Softcore support.",
    ],
  },
  {
    title: "Insights",
    items: [
      "Structured provider panels make SteamHunters obtainability, points, completion rates, and RetroAchievements population and mastery data easier to scan.",
      "Compact Game Info dialogs focus on essential metadata, while Community keeps the complete provider statistics and rarity distribution available.",
    ],
  },
  {
    title: "Controls",
    items: [
      "Controller focus and directional navigation are improved across headers, achievement lists, menus, and dialogs.",
      "Actions and Manage Suggestions now use compact nested menus. Closing details or Game Info returns one level and restores your previous focus.",
      "The game footer reserves fixed X, Y, A, and B positions, so contextual Hide, Show, and Top actions never move the tabs or other controller hints.",
    ],
  },
] as const;
