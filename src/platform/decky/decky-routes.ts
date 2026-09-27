export const DECKY_FULL_SCREEN_ROUTE_PATTERNS = {
  profile: "/achievement-companion/full-screen/profile/:providerId",
  game: "/achievement-companion/full-screen/game/:providerId/:gameId",
  achievement:
    "/achievement-companion/full-screen/achievement/:providerId/:gameId/:achievementId",
  achievementHistory:
    "/achievement-companion/full-screen/achievement-history/:providerId",
  completionProgress:
    "/achievement-companion/full-screen/completion-progress/:providerId",
  settings: "/achievement-companion/full-screen/settings",
  providerSettings:
    "/achievement-companion/full-screen/provider-settings/:providerId",
} as const;

const FULL_SCREEN_ROUTE_BASE = "/achievement-companion/full-screen";

function encodeRouteParameter(value: string): string {
  return encodeURIComponent(value);
}

export function buildDeckyFullScreenProfileRoute(providerId: string): string {
  return `${FULL_SCREEN_ROUTE_BASE}/profile/${encodeRouteParameter(providerId)}`;
}

export function buildDeckyFullScreenGameRoute(providerId: string, gameId: string): string {
  return `${FULL_SCREEN_ROUTE_BASE}/game/${encodeRouteParameter(providerId)}/${encodeRouteParameter(gameId)}`;
}

export function buildDeckyFullScreenAchievementRoute(
  providerId: string,
  gameId: string,
  achievementId: string,
): string {
  return `${FULL_SCREEN_ROUTE_BASE}/achievement/${encodeRouteParameter(providerId)}/${encodeRouteParameter(gameId)}/${encodeRouteParameter(achievementId)}`;
}

export function buildDeckyFullScreenAchievementHistoryRoute(providerId: string): string {
  return `${FULL_SCREEN_ROUTE_BASE}/achievement-history/${encodeRouteParameter(providerId)}`;
}

export function buildDeckyFullScreenCompletionProgressRoute(providerId: string): string {
  return `${FULL_SCREEN_ROUTE_BASE}/completion-progress/${encodeRouteParameter(providerId)}`;
}

export function buildDeckyFullScreenSettingsRoute(): string {
  return DECKY_FULL_SCREEN_ROUTE_PATTERNS.settings;
}

export function buildDeckyFullScreenProviderSettingsRoute(providerId: string): string {
  return `${FULL_SCREEN_ROUTE_BASE}/provider-settings/${encodeRouteParameter(providerId)}`;
}
