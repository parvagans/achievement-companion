export type SteamFullScreenSessionTab = "profile" | "games" | "activity" | "settings";

const STEAM_FULL_SCREEN_SESSION_TAB_ORDER: readonly SteamFullScreenSessionTab[] = [
  "profile",
  "games",
  "activity",
  "settings",
];

/** Keeps shoulder traversal circular and independent from route history. */
export function getAdjacentSteamFullScreenSessionTab(
  currentTab: SteamFullScreenSessionTab,
  direction: "previous" | "next",
): SteamFullScreenSessionTab {
  const currentIndex = STEAM_FULL_SCREEN_SESSION_TAB_ORDER.indexOf(currentTab);
  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = (currentIndex + offset + STEAM_FULL_SCREEN_SESSION_TAB_ORDER.length) %
    STEAM_FULL_SCREEN_SESSION_TAB_ORDER.length;
  return STEAM_FULL_SCREEN_SESSION_TAB_ORDER[nextIndex] ?? "profile";
}
