export type FullScreenSettingsBackTarget = "compact-panel" | "previous-fullscreen";
export type FullScreenGameRouteBackBehavior = "decky-panel" | "completion-progress";

let nextFullScreenSettingsBackTarget: FullScreenSettingsBackTarget = "compact-panel";
const fullScreenGameRouteBackBehaviors = new Map<string, FullScreenGameRouteBackBehavior>();

function getFullScreenGameRouteKey(providerId: string, gameId: string): string {
  return `${providerId}:${gameId}`;
}

export function resolveFullScreenSettingsBackTarget(
  openedFrom: "compact-panel" | "fullscreen-profile",
): FullScreenSettingsBackTarget {
  return openedFrom === "fullscreen-profile" ? "previous-fullscreen" : "compact-panel";
}

export function markNextFullScreenSettingsBackTarget(
  target: FullScreenSettingsBackTarget,
): void {
  nextFullScreenSettingsBackTarget = target;
}

export function consumeNextFullScreenSettingsBackTarget(): FullScreenSettingsBackTarget {
  const target = nextFullScreenSettingsBackTarget;
  nextFullScreenSettingsBackTarget = "compact-panel";
  return target;
}

export function markFullScreenGameRouteBackBehavior(
  providerId: string,
  gameId: string,
  behavior: FullScreenGameRouteBackBehavior,
): void {
  fullScreenGameRouteBackBehaviors.set(getFullScreenGameRouteKey(providerId, gameId), behavior);
}

export function resolveFullScreenGameRouteBackBehavior(
  providerId: string | undefined,
  gameId: string | undefined,
): FullScreenGameRouteBackBehavior {
  if (providerId === undefined || gameId === undefined) {
    return "decky-panel";
  }

  return fullScreenGameRouteBackBehaviors.get(getFullScreenGameRouteKey(providerId, gameId)) ?? "decky-panel";
}

export function shouldSuppressGameRouteUnmountWhenOpeningAchievement(
  backBehavior: FullScreenGameRouteBackBehavior,
): boolean {
  void backBehavior;
  return true;
}
