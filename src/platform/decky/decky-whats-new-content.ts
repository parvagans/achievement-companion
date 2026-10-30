/** Bundled notes for 0.38.2, covering changes since v0.38.1. */
export const WHATS_NEW_SECTIONS = [
  {
    title: "Overview",
    items: [
      "RetroAchievements reuses saved progress across Quick Access, full-screen pages, and Steam integrations, refreshing the data each view needs.",
      "Saved data stays available when a refresh fails. Provider cooldowns apply to automatic requests and manual retries.",
      "Achievement history resumes from saved checkpoints instead of starting over when you revisit Activity.",
    ],
  },
  {
    title: "Current Game",
    items: [
      "Current Game follows RetroAchievements activity independently of profile refreshes, including game launches, exits, and emulator ROM switches.",
      "Continue Playing retains your most recently observed game while Recently Played catches up. Your selected Up Next goals and hidden suggestions stay intact.",
      "Unrelated shortcuts do not claim remote account activity; newer RetroAchievements heartbeats remain valid after a local game exits.",
    ],
  },
  {
    title: "Community",
    items: [
      "Eligible RetroAchievements games expose Community from Quick Access, full-screen game lists, and matched Steam game-page badges, before statistics load.",
      "Community statistics appear when loading completes in Companion and Steam. Available values are preserved, while unavailable medians stay omitted.",
      "Use a single L1/R1 press to leave Community while it loads or after its statistics appear.",
    ],
  },
  {
    title: "Subsets",
    items: [
      "The Subsets tab appears only when verified subsets exist. Discovery resumes from its saved checkpoint and prioritizes unresolved candidates.",
      "Previously verified subsets remain available when discovery is incomplete or refreshed metadata is missing required relationship information.",
    ],
  },
  {
    title: "Controls",
    items: [
      "Re-entered game pages use current progress while open achievement lists retain their navigation and focus.",
      "Full-screen RetroAchievements profiles reserve space for your account name, and long Quick Access game titles wrap without a two-line cutoff.",
      "RetroAchievements sync diagnostics show request and storage status, with targeted recovery actions and a sanitized export for troubleshooting.",
    ],
  },
] as const;
