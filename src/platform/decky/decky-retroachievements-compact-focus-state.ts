import type { RecentUnlock } from "@core/domain";

export type DeckyRetroAchievementsCompactFocusTarget =
  | { readonly kind: "profile" }
  | { readonly kind: "up-next"; readonly control: "recommendation" | "achievements" | "options"; readonly gameId: string }
  | { readonly kind: "overview" }
  | { readonly kind: "beaten" }
  | { readonly kind: "calendar-entry" }
  | { readonly kind: "calendar-day"; readonly day: number }
  | { readonly kind: "achievement"; readonly gameId: string; readonly achievementId: string; readonly unlockMode?: "hardcore" | "softcore"; readonly unlockedAt?: number }
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
    case "achievement": return `achievement:${JSON.stringify([target.gameId, target.achievementId, target.unlockMode ?? null, target.unlockedAt ?? null])}`;
    case "game": return `game:${target.gameId}`;
    case "up-next": return `up-next:${target.control}:${target.gameId}`;
    default: return target.kind;
  }
}

export function getDeckyRetroAchievementsCompactAchievementFocusTarget(
  unlock: RecentUnlock,
): DeckyRetroAchievementsCompactFocusTarget {
  const unlockedAt = unlock.unlockedAt ?? unlock.achievement.unlockedAt;
  return {
    kind: "achievement",
    gameId: unlock.game.gameId,
    achievementId: unlock.achievement.achievementId,
    ...(unlock.achievement.unlockMode !== undefined ? { unlockMode: unlock.achievement.unlockMode } : {}),
    ...(unlockedAt !== undefined ? { unlockedAt } : {}),
  };
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
