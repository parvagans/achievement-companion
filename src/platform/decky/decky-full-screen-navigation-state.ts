export type FullScreenSettingsBackTarget = "compact-panel" | "previous-fullscreen";
export type FullScreenGameRouteBackBehavior =
  | "decky-panel"
  | "completion-progress"
  | "achievement";

export interface FullScreenAchievementRouteReturnTarget {
  readonly providerId: string;
  readonly gameId: string;
  readonly achievementId: string;
}

interface FullScreenGameRouteBackState {
  readonly behavior: FullScreenGameRouteBackBehavior;
  readonly achievementReturnTarget?: FullScreenAchievementRouteReturnTarget;
}

const fullScreenGameRouteBackBehaviors = new Map<string, FullScreenGameRouteBackState[]>();
let nextFullScreenSettingsBackTarget: FullScreenSettingsBackTarget = "compact-panel";

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

export function peekNextFullScreenSettingsBackTarget(): FullScreenSettingsBackTarget {
  return nextFullScreenSettingsBackTarget;
}

export function clearNextFullScreenSettingsBackTarget(): boolean {
  const hadNonDefaultTarget = nextFullScreenSettingsBackTarget !== "compact-panel";
  nextFullScreenSettingsBackTarget = "compact-panel";
  return hadNonDefaultTarget;
}

export function markFullScreenGameRouteBackBehavior(
  providerId: string,
  gameId: string,
  behavior: FullScreenGameRouteBackBehavior,
): void {
  fullScreenGameRouteBackBehaviors.set(getFullScreenGameRouteKey(providerId, gameId), [{ behavior }]);
}

export function pushFullScreenGameRouteAchievementReturnTarget(
  providerId: string,
  gameId: string,
  target: FullScreenAchievementRouteReturnTarget,
): void {
  const routeKey = getFullScreenGameRouteKey(providerId, gameId);
  const existingStack = fullScreenGameRouteBackBehaviors.get(routeKey) ?? [];
  fullScreenGameRouteBackBehaviors.set(routeKey, [
    ...existingStack,
    {
      behavior: "achievement",
      achievementReturnTarget: target,
    },
  ]);
}

export function popFullScreenGameRouteBackBehavior(
  providerId: string | undefined,
  gameId: string | undefined,
): void {
  if (providerId === undefined || gameId === undefined) {
    return;
  }

  const routeKey = getFullScreenGameRouteKey(providerId, gameId);
  const existingStack = fullScreenGameRouteBackBehaviors.get(routeKey);
  if (existingStack === undefined || existingStack.length === 0) {
    return;
  }

  if (existingStack.length === 1) {
    fullScreenGameRouteBackBehaviors.delete(routeKey);
    return;
  }

  fullScreenGameRouteBackBehaviors.set(routeKey, existingStack.slice(0, -1));
}

export function resolveFullScreenGameRouteBackBehavior(
  providerId: string | undefined,
  gameId: string | undefined,
): FullScreenGameRouteBackBehavior {
  if (providerId === undefined || gameId === undefined) {
    return "decky-panel";
  }

  const routeStateStack = fullScreenGameRouteBackBehaviors.get(
    getFullScreenGameRouteKey(providerId, gameId),
  );
  return routeStateStack?.[routeStateStack.length - 1]?.behavior ?? "decky-panel";
}

export function resolveFullScreenGameRouteAchievementReturnTarget(
  providerId: string | undefined,
  gameId: string | undefined,
): FullScreenAchievementRouteReturnTarget | undefined {
  if (providerId === undefined || gameId === undefined) {
    return undefined;
  }

  const routeStateStack = fullScreenGameRouteBackBehaviors.get(
    getFullScreenGameRouteKey(providerId, gameId),
  );
  const currentState = routeStateStack?.[routeStateStack.length - 1];
  if (currentState?.behavior !== "achievement") {
    return undefined;
  }

  return currentState.achievementReturnTarget;
}

export function shouldSuppressGameRouteUnmountWhenOpeningAchievement(
  backBehavior: FullScreenGameRouteBackBehavior,
): boolean {
  void backBehavior;
  return true;
}
