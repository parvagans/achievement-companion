import type { NormalizedMetric, ProviderId } from "@core/domain";
import type { CompactAchievementTarget } from "./decky-achievement-detail-view";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageText } from "./storage";

export const DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY =
  "achievement-companion:decky-fullscreen-return-context:v1";

export interface DeckyFullscreenReturnContext {
  readonly providerId: ProviderId;
  readonly deckyReturnView: "provider-dashboard" | "game" | "achievement";
  readonly gameId?: string;
  readonly gameTitle?: string;
  readonly achievementTarget?: DeckyFullscreenAchievementReturnTarget;
  readonly parentGameOrigin?: DeckyFullscreenGameReturnOrigin;
  readonly focusTarget?: "open-full-screen";
}

export interface DeckyFullscreenReturnContextPayload extends DeckyFullscreenReturnContext {
  readonly createdAt: string;
  readonly returnRequested: boolean;
}

export interface DeckyFullscreenGameReturnOrigin {
  readonly providerId: ProviderId;
  readonly gameId: string;
  readonly gameTitle: string;
}

export type DeckyFullscreenAchievementReturnTarget = CompactAchievementTarget;

function isProviderId(value: unknown): value is ProviderId {
  return value === "retroachievements" || value === "steam";
}

function isDeckyFullscreenReturnView(value: unknown): value is DeckyFullscreenReturnContext["deckyReturnView"] {
  return value === "provider-dashboard" || value === "game" || value === "achievement";
}

function parseNormalizedMetric(value: unknown): NormalizedMetric | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate["key"] !== "string" ||
    typeof candidate["label"] !== "string" ||
    typeof candidate["value"] !== "string"
  ) {
    return undefined;
  }

  if (candidate["detail"] !== undefined && typeof candidate["detail"] !== "string") {
    return undefined;
  }

  return {
    key: candidate["key"],
    label: candidate["label"],
    value: candidate["value"],
    ...(candidate["detail"] !== undefined ? { detail: candidate["detail"] } : {}),
  };
}

function parseNormalizedMetricList(value: unknown): readonly NormalizedMetric[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const metrics: NormalizedMetric[] = [];
  for (const entry of value) {
    const parsedMetric = parseNormalizedMetric(entry);
    if (parsedMetric === undefined) {
      return undefined;
    }

    metrics.push(parsedMetric);
  }

  return metrics;
}

function parseDeckyFullscreenGameReturnOrigin(
  value: unknown,
): DeckyFullscreenGameReturnOrigin | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isProviderId(candidate["providerId"]) ||
    typeof candidate["gameId"] !== "string" ||
    typeof candidate["gameTitle"] !== "string"
  ) {
    return undefined;
  }

  return {
    providerId: candidate["providerId"],
    gameId: candidate["gameId"],
    gameTitle: candidate["gameTitle"],
  };
}

function parseDeckyFullscreenAchievementReturnTarget(
  value: unknown,
): DeckyFullscreenAchievementReturnTarget | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const game = candidate["game"];
  const achievement = candidate["achievement"];

  if (typeof game !== "object" || game === null || typeof achievement !== "object" || achievement === null) {
    return undefined;
  }

  const gameCandidate = game as Record<string, unknown>;
  const achievementCandidate = achievement as Record<string, unknown>;
  const gameMetrics = parseNormalizedMetricList(gameCandidate["metrics"]);
  const achievementMetrics = parseNormalizedMetricList(achievementCandidate["metrics"]);

  if (
    !isProviderId(gameCandidate["providerId"]) ||
    typeof gameCandidate["gameId"] !== "string" ||
    typeof gameCandidate["title"] !== "string" ||
    (gameCandidate["platformLabel"] !== undefined && typeof gameCandidate["platformLabel"] !== "string") ||
    (gameCandidate["coverImageUrl"] !== undefined &&
      typeof gameCandidate["coverImageUrl"] !== "string") ||
    (gameCandidate["metrics"] !== undefined && gameMetrics === undefined) ||
    typeof achievementCandidate["achievementId"] !== "string" ||
    typeof achievementCandidate["title"] !== "string" ||
    typeof achievementCandidate["isUnlocked"] !== "boolean" ||
    (achievementCandidate["description"] !== undefined &&
      typeof achievementCandidate["description"] !== "string") ||
    (achievementCandidate["badgeImageUrl"] !== undefined &&
      typeof achievementCandidate["badgeImageUrl"] !== "string") ||
    (achievementCandidate["unlockedAt"] !== undefined &&
      typeof achievementCandidate["unlockedAt"] !== "number") ||
    (achievementCandidate["hardcoreUnlockedAt"] !== undefined &&
      typeof achievementCandidate["hardcoreUnlockedAt"] !== "number") ||
    (achievementCandidate["softcoreUnlockedAt"] !== undefined &&
      typeof achievementCandidate["softcoreUnlockedAt"] !== "number") ||
    (achievementCandidate["unlockMode"] !== undefined &&
      achievementCandidate["unlockMode"] !== "hardcore" &&
      achievementCandidate["unlockMode"] !== "softcore") ||
    (achievementCandidate["points"] !== undefined && typeof achievementCandidate["points"] !== "number") ||
    achievementMetrics === undefined
  ) {
    return undefined;
  }

  return {
    game: {
      providerId: gameCandidate["providerId"],
      gameId: gameCandidate["gameId"],
      title: gameCandidate["title"],
      ...(gameCandidate["platformLabel"] !== undefined
        ? { platformLabel: gameCandidate["platformLabel"] }
        : {}),
      ...(gameCandidate["coverImageUrl"] !== undefined
        ? { coverImageUrl: gameCandidate["coverImageUrl"] }
        : {}),
      ...(gameMetrics !== undefined ? { metrics: gameMetrics } : {}),
    },
    achievement: {
      achievementId: achievementCandidate["achievementId"],
      title: achievementCandidate["title"],
      isUnlocked: achievementCandidate["isUnlocked"],
      metrics: achievementMetrics,
      ...(achievementCandidate["description"] !== undefined
        ? { description: achievementCandidate["description"] }
        : {}),
      ...(achievementCandidate["badgeImageUrl"] !== undefined
        ? { badgeImageUrl: achievementCandidate["badgeImageUrl"] }
        : {}),
      ...(achievementCandidate["unlockedAt"] !== undefined
        ? { unlockedAt: achievementCandidate["unlockedAt"] }
        : {}),
      ...(achievementCandidate["hardcoreUnlockedAt"] !== undefined
        ? { hardcoreUnlockedAt: achievementCandidate["hardcoreUnlockedAt"] }
        : {}),
      ...(achievementCandidate["softcoreUnlockedAt"] !== undefined
        ? { softcoreUnlockedAt: achievementCandidate["softcoreUnlockedAt"] }
        : {}),
      ...(achievementCandidate["unlockMode"] !== undefined
        ? { unlockMode: achievementCandidate["unlockMode"] }
        : {}),
      ...(achievementCandidate["points"] !== undefined
        ? { points: achievementCandidate["points"] }
        : {}),
    },
  };
}

function parseDeckyFullscreenReturnContextPayload(
  value: unknown,
): DeckyFullscreenReturnContextPayload | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isProviderId(candidate["providerId"]) ||
    !isDeckyFullscreenReturnView(candidate["deckyReturnView"]) ||
    typeof candidate["createdAt"] !== "string" ||
    typeof candidate["returnRequested"] !== "boolean"
  ) {
    return undefined;
  }

  if (candidate["focusTarget"] !== undefined && candidate["focusTarget"] !== "open-full-screen") {
    return undefined;
  }

  if (candidate["gameId"] !== undefined && typeof candidate["gameId"] !== "string") {
    return undefined;
  }

  if (candidate["gameTitle"] !== undefined && typeof candidate["gameTitle"] !== "string") {
    return undefined;
  }

  const achievementTarget = parseDeckyFullscreenAchievementReturnTarget(candidate["achievementTarget"]);
  const parentGameOrigin = parseDeckyFullscreenGameReturnOrigin(candidate["parentGameOrigin"]);

  if (candidate["achievementTarget"] !== undefined && achievementTarget === undefined) {
    return undefined;
  }

  if (candidate["parentGameOrigin"] !== undefined && parentGameOrigin === undefined) {
    return undefined;
  }

  if (
    candidate["deckyReturnView"] === "game" &&
    (candidate["gameId"] === undefined || candidate["gameTitle"] === undefined)
  ) {
    return undefined;
  }

  if (candidate["deckyReturnView"] === "achievement" && achievementTarget === undefined) {
    return undefined;
  }

  return {
    providerId: candidate["providerId"],
    deckyReturnView: candidate["deckyReturnView"],
    ...(candidate["gameId"] !== undefined ? { gameId: candidate["gameId"] } : {}),
    ...(candidate["gameTitle"] !== undefined ? { gameTitle: candidate["gameTitle"] } : {}),
    ...(achievementTarget !== undefined ? { achievementTarget } : {}),
    ...(parentGameOrigin !== undefined ? { parentGameOrigin } : {}),
    ...(candidate["focusTarget"] !== undefined ? { focusTarget: candidate["focusTarget"] } : {}),
    createdAt: candidate["createdAt"],
    returnRequested: candidate["returnRequested"],
  };
}

export function createDeckyFullscreenReturnContextForProviderDashboard(
  providerId: ProviderId,
): DeckyFullscreenReturnContext {
  return {
    providerId,
    deckyReturnView: "provider-dashboard",
    focusTarget: "open-full-screen",
  };
}

export function createDeckyFullscreenReturnContextForGame(
  game: DeckyFullscreenGameReturnOrigin,
): DeckyFullscreenReturnContext {
  return {
    providerId: game.providerId,
    deckyReturnView: "game",
    gameId: game.gameId,
    gameTitle: game.gameTitle,
    focusTarget: "open-full-screen",
  };
}

export function createDeckyFullscreenReturnContextForAchievement(
  achievementTarget: DeckyFullscreenAchievementReturnTarget,
  parentGameOrigin?: DeckyFullscreenGameReturnOrigin,
): DeckyFullscreenReturnContext {
  return {
    providerId: achievementTarget.game.providerId,
    deckyReturnView: "achievement",
    achievementTarget,
    ...(parentGameOrigin !== undefined ? { parentGameOrigin } : {}),
    focusTarget: "open-full-screen",
  };
}

export function writeDeckyFullscreenReturnContext(
  context: DeckyFullscreenReturnContext,
): DeckyFullscreenReturnContextPayload | undefined {
  const payload: DeckyFullscreenReturnContextPayload = {
    ...context,
    createdAt: new Date().toISOString(),
    returnRequested: false,
  };

  if (!writeDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY, JSON.stringify(payload))) {
    return undefined;
  }

  return payload;
}

export function readDeckyFullscreenReturnContext(): DeckyFullscreenReturnContextPayload | undefined {
  const serializedPayload = readDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY);
  if (serializedPayload === undefined) {
    return undefined;
  }

  try {
    return parseDeckyFullscreenReturnContextPayload(JSON.parse(serializedPayload));
  } catch {
    return undefined;
  }
}

export function markDeckyFullscreenReturnRequested(): DeckyFullscreenReturnContextPayload | undefined {
  const currentPayload = readDeckyFullscreenReturnContext();
  if (currentPayload === undefined) {
    return undefined;
  }

  const nextPayload: DeckyFullscreenReturnContextPayload = {
    ...currentPayload,
    returnRequested: true,
  };

  if (
    !writeDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY, JSON.stringify(nextPayload))
  ) {
    return undefined;
  }

  return nextPayload;
}

export function clearDeckyFullscreenReturnContext(): boolean {
  return removeDeckyStorageText(DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY);
}

export function consumeDeckyFullscreenReturnContext():
  | {
      readonly selection: {
        readonly selectedProviderId: ProviderId;
        readonly selectedGame?: DeckyFullscreenGameReturnOrigin;
      };
      readonly context: DeckyFullscreenReturnContextPayload;
    }
  | undefined {
  const context = readDeckyFullscreenReturnContext();
  if (context === undefined || context.returnRequested !== true) {
    return undefined;
  }

  const selection = restoreDeckyFullscreenSelectionFromContext(context);
  clearDeckyFullscreenReturnContext();
  return {
    context,
    selection,
  };
}

export function restoreDeckyFullscreenSelectionFromContext(
  context: DeckyFullscreenReturnContext | DeckyFullscreenReturnContextPayload,
): {
  readonly selectedProviderId: ProviderId;
  readonly selectedGame?: DeckyFullscreenGameReturnOrigin;
  readonly selectedAchievement?: DeckyFullscreenAchievementReturnTarget;
} {
  if (context.deckyReturnView === "achievement" && context.achievementTarget !== undefined) {
    return {
      selectedProviderId: context.providerId,
      ...(context.parentGameOrigin !== undefined ? { selectedGame: context.parentGameOrigin } : {}),
      selectedAchievement: context.achievementTarget,
    };
  }

  if (context.deckyReturnView === "game" && context.gameId !== undefined && context.gameTitle !== undefined) {
    return {
      selectedProviderId: context.providerId,
      selectedGame: {
        providerId: context.providerId,
        gameId: context.gameId,
        gameTitle: context.gameTitle,
      },
    };
  }

  return {
    selectedProviderId: context.providerId,
  };
}
