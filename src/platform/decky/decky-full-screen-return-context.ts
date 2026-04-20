import type { ProviderId } from "@core/domain";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageText } from "./storage";

export const DECKY_FULLSCREEN_RETURN_CONTEXT_STORAGE_KEY =
  "achievement-companion:decky-fullscreen-return-context:v1";

export interface DeckyFullscreenReturnContext {
  readonly providerId: ProviderId;
  readonly deckyReturnView: "provider-dashboard" | "game";
  readonly gameId?: string;
  readonly gameTitle?: string;
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

function isProviderId(value: unknown): value is ProviderId {
  return value === "retroachievements" || value === "steam";
}

function isDeckyFullscreenReturnView(value: unknown): value is DeckyFullscreenReturnContext["deckyReturnView"] {
  return value === "provider-dashboard" || value === "game";
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

  if (
    candidate["deckyReturnView"] === "game" &&
    (candidate["gameId"] === undefined || candidate["gameTitle"] === undefined)
  ) {
    return undefined;
  }

  return {
    providerId: candidate["providerId"],
    deckyReturnView: candidate["deckyReturnView"],
    ...(candidate["gameId"] !== undefined ? { gameId: candidate["gameId"] } : {}),
    ...(candidate["gameTitle"] !== undefined ? { gameTitle: candidate["gameTitle"] } : {}),
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
} {
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
