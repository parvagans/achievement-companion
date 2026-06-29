export const DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_PATTERN = "/library/app/:appid";
export const DECKY_GAME_PAGE_ACHIEVEMENT_URL_ROUTE_PREFIX = "/routes/library/app/";
export const DECKY_GAME_PAGE_ACHIEVEMENT_LIBRARY_ROUTE_PREFIX = "/library/app/";

export interface DeckyGamePageAchievementRouteDetectionState {
  readonly isGamePage: boolean;
  readonly appId: string | undefined;
  readonly reason: "target-url-route" | "url-unavailable" | "no-route-match";
}

const DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_REGEX = /\/(?:routes\/)?library\/app\/(\d+)(?:\/|$)/u;

function normalizeAppId(appId: unknown): string | undefined {
  if (typeof appId === "string") {
    const trimmed = appId.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof appId === "number" && Number.isFinite(appId)) {
    return String(appId);
  }

  return undefined;
}

export function detectDeckyGamePageAchievementRouteFromUrl(
  url: string | undefined,
): DeckyGamePageAchievementRouteDetectionState {
  if (typeof url !== "string" || url.trim().length === 0) {
    return {
      isGamePage: false,
      appId: undefined,
      reason: "url-unavailable",
    };
  }

  try {
    const pathname = new URL(url).pathname;
    const routeMatch = pathname.match(DECKY_GAME_PAGE_ACHIEVEMENT_ROUTE_REGEX);
    if (routeMatch?.[1] !== undefined) {
      return {
        isGamePage: true,
        appId: routeMatch[1],
        reason: "target-url-route",
      };
    }
  } catch {
    return {
      isGamePage: false,
      appId: undefined,
      reason: "url-unavailable",
    };
  }

  return {
    isGamePage: false,
    appId: undefined,
    reason: "no-route-match",
  };
}

export function resolveDeckyGamePageAchievementAppIdFromRouteProps(routeProps: unknown): string | undefined {
  if (typeof routeProps !== "object" || routeProps === null) {
    return undefined;
  }

  const routePropsRecord = routeProps as Record<string, unknown>;
  const directParams =
    typeof routePropsRecord["params"] === "object" && routePropsRecord["params"] !== null
      ? (routePropsRecord["params"] as Record<string, unknown>)
      : undefined;
  const matchParams =
    typeof routePropsRecord["match"] === "object" &&
    routePropsRecord["match"] !== null &&
    typeof (routePropsRecord["match"] as Record<string, unknown>)["params"] === "object" &&
    (routePropsRecord["match"] as Record<string, unknown>)["params"] !== null
      ? ((routePropsRecord["match"] as Record<string, unknown>)["params"] as Record<string, unknown>)
      : undefined;

  return (
    normalizeAppId(directParams?.["appid"]) ??
    normalizeAppId(directParams?.["appId"]) ??
    normalizeAppId(matchParams?.["appid"]) ??
    normalizeAppId(matchParams?.["appId"]) ??
    normalizeAppId(routePropsRecord["appid"]) ??
    normalizeAppId(routePropsRecord["appId"])
  );
}

export function resolveDeckyGamePageAchievementAppId(
  routeProps: unknown,
  urlCandidates: readonly (string | undefined)[],
): string | undefined {
  const routeAppId = resolveDeckyGamePageAchievementAppIdFromRouteProps(routeProps);
  if (routeAppId !== undefined) {
    return routeAppId;
  }

  for (const urlCandidate of urlCandidates) {
    const detection = detectDeckyGamePageAchievementRouteFromUrl(urlCandidate);
    if (detection.appId !== undefined) {
      return detection.appId;
    }
  }

  return undefined;
}
