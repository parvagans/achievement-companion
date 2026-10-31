/** Bundled notes for 0.40.0, retaining the earlier pinning and Up Next highlights. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Overview",
    items: [
      "Happy Halloween, achievement hunters! Choose a personal target, keep it close across Quick Access, full-screen Overview, and native Steam game pages, and enjoy the Halloween theme.",
      "Pin an unfinished Steam or RetroAchievements achievement without changing your Beat/Master goals or Hardcore/Softcore completion requirements.",
      "In What's New, press Down to scroll the notes, then Down again at the bottom to reach Close. B also closes the dialog.",
      "Quick Access keeps the game and progress first, with compact Profile and Pinned Achievements shortcuts beside the heading.",
      "Activity Calendars start collapsed and remember your choice separately for each provider. A collapsed calendar shows any selected date filter and offers Clear date filter.",
    ],
  },
  {
    title: "Up Next",
    items: [
      "Up Next recommends three achievements using progression and available provider data, with community rarity and RetroAchievements classifications where supported.",
      "Open a recommendation's details, jump to it in Achievements, or hide it. Manage Suggestions can restore individual choices or every hidden suggestion.",
      "Full-screen Overview uses three equal-height recommendation cards with centered content and thumbtack controls, without repeating selection-source labels.",
      "Compact, two-line description summaries keep recommendations inside the panel. Open achievement details for the complete description.",
      "Quick Access uses larger game titles and places each recommendation's two-line description below its artwork and title.",
    ],
  },
  {
    title: "Pinned",
    items: [
      "Use the thumbtack controls in Quick Access and full-screen Overview, or Y Pin/Unpin in the native RetroAchievements Up Next tab.",
      "Saved targets are separate for each account and game, shared across supported views, and preserved between sessions.",
      "Removing or completing a pin returns Up Next to automatic recommendations. Your existing goals and hidden suggestions stay intact.",
      "Open Pinned Achievements from the header thumbtack to browse saved Steam and RetroAchievements targets, inspect Details, or Unpin.",
      "From a pinned achievement's Details, View Game opens the compact game overview. Press B there to return to the pinned viewer at the same entry.",
    ],
  },
  {
    title: "Game Page Badges",
    items: [
      "See your Up Next achievement beside the native achievement badge for Steam and matched RetroAchievements games, with a subtle thumbtack for manually pinned targets.",
      "Choose On Focus, Always Show, or Hidden for Up Next Preview. Control Achievement Description separately with the same options; both settings default to On Focus.",
      "Neutral Minimal-style previews follow the badge's position and width, support Classic and Minimal badges, and preserve square achievement artwork.",
      "Show the complete available achievement description according to your description setting while keeping the resting preview compact when descriptions are hidden.",
    ],
  },
  {
    title: "Halloween",
    items: [
      "Choose Halloween in Plugin Settings > Theme Settings > Theme for orange accents, deep purple surfaces, and mint highlights.",
      "The theme colors Quick Access and full-screen interfaces while native game-page previews keep their neutral Steam-style appearance. Happy Halloween, and happy achievement hunting!",
    ],
  },
] as const;
