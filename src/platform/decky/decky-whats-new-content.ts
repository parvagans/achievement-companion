/** Bundled player-facing changes since v0.40.0. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Overview",
    items: [
      "Since v0.40.0, matched RetroAchievements games have gained native Steam pinning, separate achievement sets, and in-game Achievements and Guides.",
    ],
  },
  {
    title: "Steam Library",
    items: [
      "Open Steam's native achievement list for a matched RetroAchievements game from the Achievements icon beside Play or through Your Stuff.",
      "Use All Sets to browse verified RetroAchievements subsets. The base game and each subset show their own progress and keep their own pins.",
    ],
  },
  {
    title: "Pins",
    items: [
      "Turn on Pin Achievements in Steam's full list and press X to pin or unpin a locked RetroAchievements achievement. In the Your Stuff preview, use Y when the footer offers it.",
      "Open Pinned Achievements from Up Next. For Steam games, pinning or unpinning in either place updates the same list.",
      "If a Steam game has several unfinished pins, choose which one to show first in Up Next.",
    ],
  },
  {
    title: "In-Game",
    items: [
      "Press STEAM while a matched RetroAchievements game is running, then open Achievements for base-set progress and your pin. Use X to pin or unpin.",
      "Open Guides between Achievements and Notes. Use the native dialog to open a pinned achievement, community mastery guide, or RA discussion when available.",
    ],
  },
  {
    title: "Hotfix",
    items: [
      "The v0.41.1 hotfix restored RetroAchievements in Steam's Your Stuff and My Achievements. Locked achievement artwork is grayscale again.",
      "Activity and Up Next open the exact achievement in Steam's list. Press B to return to the original tile or recommendation.",
      "Removed the duplicate Y Unpin prompt from Steam's pinned section. The native X action handles pinning there.",
      "The game-page badge and Up Next stay aligned as the library page opens. Both hide together when Steam shows its launch screen.",
      "RA points and Ratio still show their values without the coin and pie icons. GitHub and Ko-fi icons load again in Quick Access and What's New.",
    ],
  },
] as const;
