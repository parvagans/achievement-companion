import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";

/** Returns controller focus and the scrollable list to the top of a Steam profile tab. */
export function jumpDeckySteamProfileTabToTop(document: Document, tab: "games" | "activity"): boolean {
  const root = document.querySelector<HTMLElement>(tab === "games"
    ? "[data-steam-full-screen-games-dashboard]"
    : "[data-steam-full-screen-activity-dashboard]");
  const target = root?.querySelector<HTMLElement>(tab === "games"
    ? "[data-steam-games-toolbar-control='search']"
    : root.dataset["activitySubviewActive"] === "analytics"
      ? "[data-activity-subview='analytics']"
      : "[data-steam-activity-filter='true']");
  if (root === null || root === undefined || target === null || target === undefined) return false;

  const list = root.querySelector<HTMLElement>(tab === "games"
    ? "[data-steam-games-list]"
    : "[data-steam-activity-list]");
  list?.scrollTo({ top: 0, behavior: "auto" });
  target.scrollIntoView({ block: "start", inline: "nearest" });
  return takeDeckySteamGamepadFocus(target);
}
