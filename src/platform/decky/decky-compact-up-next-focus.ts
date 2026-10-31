type Control = "recommendation" | "achievements" | "pin" | "options";

/** Resolve a vanished control/game to the surviving list action without resetting other sections. */
export function shouldRestoreCompactUpNextToAchievements(
  saved: { readonly kind: string; readonly gameId?: string; readonly control?: Control },
  gameId: string,
  unavailableControls: readonly Control[],
): boolean {
  return saved.kind === "up-next" && (saved.gameId !== gameId
    || saved.control !== undefined && unavailableControls.includes(saved.control));
}
