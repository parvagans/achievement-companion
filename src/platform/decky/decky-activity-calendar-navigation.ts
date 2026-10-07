export type DeckyActivityCalendarDirection = "up" | "down" | "left" | "right";

export type DeckyActivityCalendarFocusDestination =
  | { readonly kind: "cell"; readonly index: number }
  | { readonly kind: "profile" }
  | { readonly kind: "activity" }
  | { readonly kind: "stay" };

/** Shared seven-day grid navigation for Steam and RetroAchievements compact calendars. */
export function getDeckyActivityCalendarFocusDestination(
  currentIndex: number,
  cellCount: number,
  direction: DeckyActivityCalendarDirection,
): DeckyActivityCalendarFocusDestination {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= cellCount || cellCount <= 0) {
    return { kind: "stay" };
  }

  const row = currentIndex % 7;
  const column = Math.floor(currentIndex / 7);
  const columns = Math.ceil(cellCount / 7);

  if (direction === "up") {
    return row > 0 ? { kind: "cell", index: currentIndex - 1 } : { kind: "profile" };
  }

  if (direction === "down") {
    if (row === 6) return { kind: "activity" };
    return currentIndex + 1 < cellCount
      ? { kind: "cell", index: currentIndex + 1 }
      : { kind: "stay" };
  }

  if (direction === "left") {
    return column > 0 && currentIndex - 7 >= 0
      ? { kind: "cell", index: currentIndex - 7 }
      : { kind: "stay" };
  }

  return column < columns - 1 && currentIndex + 7 < cellCount
    ? { kind: "cell", index: currentIndex + 7 }
    : { kind: "stay" };
}
