/** Bundled notes for the current update. Keep these in sync with the release notes. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Profile",
    items: [
      "Steam Profile is reorganized around account details, progress, SteamHunters highlights, Latest Unlocks, and Continue Playing, with clearer routes to Activity and Games.",
      "RetroAchievements Profile groups account details, progress, systems, and completions. The avatar opens your profile, while systems and completion awards filter Games. The separate Systems tab stays hidden during rework.",
    ],
  },
  {
    title: "Games",
    items: [
      "Steam and RetroAchievements Games are easier to browse with a single search and filter toolbar, clearer game rows, and Newest/Oldest ordering. RetroAchievements system filtering sits alongside the other controls.",
    ],
  },
  {
    title: "Activity",
    items: [
      "Full-screen Activity gives unlock history and Analytics clearer, separate views. Switch with LT/RT, filter unlocks, and browse trends, streaks, and calendar days.",
      "Selecting a chart bar or calendar day narrows history to that period. Achievement details for both services use consistent Your Unlock and Community layouts.",
    ],
  },
  {
    title: "Settings",
    items: [
      "Full-screen Settings are reorganized into service-specific groups for account, profile, activity, and data. General brings shared appearance, badge, updates, and help together.",
      "Setup guidance is tucked behind help controls, while themed rows, typography, and focus behavior make settings easier to read and navigate.",
      "Fixed update checks failing with an HTTP 500 error on some Steam Decks.",
    ],
  },
  {
    title: "Game pages",
    items: [
      "RetroAchievements game-page badges and details now refresh when you reopen a game page, including newly earned achievements.",
      "RetroAchievements game-page badges now stay visible while their data refreshes, without flashing a loading state.",
      "RetroAchievements game Community now matches Steam's insights layout. Hardcore and Softcore beat times share one card, with a new achievement rarity distribution.",
      "Steam and RetroAchievements Community rarity charts now use the selected theme's colors for their bars, legend, and track.",
    ],
  },
] as const;
