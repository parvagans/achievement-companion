export type DeckyRetroAchievementsCompactFocusTarget =
  | { readonly kind: "profile" }
  | { readonly kind: "current-game" }
  | { readonly kind: "overview" }
  | { readonly kind: "beaten" }
  | { readonly kind: "calendar-entry" }
  | { readonly kind: "calendar-day"; readonly day: number }
  | { readonly kind: "achievement"; readonly gameId: string; readonly achievementId: string }
  | { readonly kind: "activity" }
  | { readonly kind: "game"; readonly gameId: string }
  | { readonly kind: "games" }
  | { readonly kind: "settings" };

let focusState: { readonly target: DeckyRetroAchievementsCompactFocusTarget; readonly scrollTop: number } = {
  target: { kind: "profile" },
  scrollTop: 0,
};

export function getDeckyRetroAchievementsCompactFocusTargetKey(
  target: DeckyRetroAchievementsCompactFocusTarget,
): string {
  switch (target.kind) {
    case "calendar-day": return `calendar-day:${target.day}`;
    case "achievement": return `achievement:${target.gameId}:${target.achievementId}`;
    case "game": return `game:${target.gameId}`;
    default: return target.kind;
  }
}

export function readDeckyRetroAchievementsCompactFocusTarget(): DeckyRetroAchievementsCompactFocusTarget {
  return focusState.target;
}

export function readDeckyRetroAchievementsCompactFocusScrollTop(): number {
  return focusState.scrollTop;
}

export function setDeckyRetroAchievementsCompactFocusTarget(
  target: DeckyRetroAchievementsCompactFocusTarget,
  scrollTop = 0,
): void {
  focusState = { target, scrollTop };
}

export function resetDeckyRetroAchievementsCompactFocusState(): void {
  focusState = { target: { kind: "profile" }, scrollTop: 0 };
}
