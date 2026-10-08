export type SteamFullScreenSessionTab = "profile" | "games" | "activity" | "settings";
export type ProviderFullScreenSessionTab = "profile" | "games" | "activity" | "settings";

const STEAM_FULL_SCREEN_SESSION_TAB_ORDER: readonly SteamFullScreenSessionTab[] = [
  "profile",
  "games",
  "activity",
  "settings",
];

export const RETROACHIEVEMENTS_FULL_SCREEN_SESSION_TAB_ORDER = [
  "profile",
  "games",
  "activity",
] as const satisfies readonly ProviderFullScreenSessionTab[];

export function getProviderFullScreenSessionTabs(providerId: string | undefined): readonly ProviderFullScreenSessionTab[] {
  return providerId === "retroachievements"
    ? RETROACHIEVEMENTS_FULL_SCREEN_SESSION_TAB_ORDER
    : STEAM_FULL_SCREEN_SESSION_TAB_ORDER;
}

export function getAdjacentProviderFullScreenSessionTab(
  tabs: readonly ProviderFullScreenSessionTab[],
  currentTab: ProviderFullScreenSessionTab,
  direction: "previous" | "next",
): ProviderFullScreenSessionTab {
  const currentIndex = Math.max(0, tabs.indexOf(currentTab));
  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
  return tabs[nextIndex] ?? "profile";
}

/** Keeps shoulder traversal circular and independent from route history. */
export function getAdjacentSteamFullScreenSessionTab(
  currentTab: SteamFullScreenSessionTab,
  direction: "previous" | "next",
): SteamFullScreenSessionTab {
  return getAdjacentProviderFullScreenSessionTab(
    STEAM_FULL_SCREEN_SESSION_TAB_ORDER,
    currentTab,
    direction,
  );
}
