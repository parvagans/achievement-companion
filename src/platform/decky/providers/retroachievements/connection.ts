import { useEffect, useSyncExternalStore } from "react";
import type { AppError } from "@core/errors";
import type { RetroAchievementsProviderConfig } from "../../../../providers/retroachievements";
import { RetroAchievementsRequestError } from "../../../../providers/retroachievements/client/transport";
import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageText } from "../../storage";

const CONNECTION_STORAGE_KEY = "achievement-companion:decky:retroachievements:connection:v1";

export type RetroAchievementsConnectionStatus =
  | "unknown"
  | "connected"
  | "authentication-required"
  | "temporarily-unavailable";

export type RetroAchievementsConnectionFailureKind =
  | "authentication"
  | "temporary"
  | "rate-limited"
  | "server"
  | "unknown";

export interface RetroAchievementsConnectionState {
  readonly version: 1;
  readonly status: RetroAchievementsConnectionStatus;
  readonly lastSuccessfulRefreshAt?: number;
  readonly failureKind?: RetroAchievementsConnectionFailureKind;
  readonly errorMessage?: string;
  readonly isShowingCachedData: boolean;
}

export interface RetroAchievementsCredentialSaveResult {
  readonly saved: boolean;
  readonly userMessage: string;
  readonly connectionState: RetroAchievementsConnectionState;
}

interface RetroAchievementsValidationFailure {
  readonly category?: unknown;
  readonly statusCode?: unknown;
}

interface RetroAchievementsValidationResponse {
  readonly ok?: unknown;
  readonly failure?: RetroAchievementsValidationFailure;
}

let cachedConnectionState: RetroAchievementsConnectionState | undefined;
let connectionRevision = 0;
const listeners = new Set<() => void>();

function defaultConnectionState(): RetroAchievementsConnectionState {
  return { version: 1, status: "unknown", isShowingCachedData: false };
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseConnectionState(value: unknown): RetroAchievementsConnectionState | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const status = record["status"];
  if (
    record["version"] !== 1 ||
    (status !== "unknown" && status !== "connected" && status !== "authentication-required" && status !== "temporarily-unavailable")
  ) {
    return undefined;
  }

  const failureKind = record["failureKind"];
  const validFailureKind = failureKind === "authentication" || failureKind === "temporary" || failureKind === "rate-limited" || failureKind === "server" || failureKind === "unknown";
  return {
    version: 1,
    status,
    ...(isFiniteTimestamp(record["lastSuccessfulRefreshAt"])
      ? { lastSuccessfulRefreshAt: record["lastSuccessfulRefreshAt"] }
      : {}),
    ...(validFailureKind ? { failureKind } : {}),
    ...(typeof record["errorMessage"] === "string" ? { errorMessage: record["errorMessage"] } : {}),
    isShowingCachedData: record["isShowingCachedData"] === true,
  };
}

function notify(): void {
  connectionRevision += 1;
  for (const listener of listeners) {
    listener();
  }
}

function setConnectionState(nextState: RetroAchievementsConnectionState): RetroAchievementsConnectionState {
  cachedConnectionState = nextState;
  writeDeckyStorageText(CONNECTION_STORAGE_KEY, JSON.stringify(nextState));
  notify();
  return nextState;
}

export function readRetroAchievementsConnectionState(): RetroAchievementsConnectionState {
  if (cachedConnectionState !== undefined) {
    return cachedConnectionState;
  }

  const rawState = readDeckyStorageText(CONNECTION_STORAGE_KEY);
  if (rawState !== undefined) {
    try {
      cachedConnectionState = parseConnectionState(JSON.parse(rawState)) ?? defaultConnectionState();
    } catch {
      cachedConnectionState = defaultConnectionState();
    }
  } else {
    cachedConnectionState = defaultConnectionState();
  }
  return cachedConnectionState;
}

export function useRetroAchievementsConnectionState(): RetroAchievementsConnectionState {
  const revision = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => connectionRevision,
    () => connectionRevision,
  );
  useEffect(() => { void revision; }, [revision]);
  return readRetroAchievementsConnectionState();
}

export function resetRetroAchievementsConnectionStateForTests(): void {
  cachedConnectionState = undefined;
  connectionRevision = 0;
  listeners.clear();
}

export function clearRetroAchievementsConnectionState(): boolean {
  cachedConnectionState = defaultConnectionState();
  notify();
  return removeDeckyStorageText(CONNECTION_STORAGE_KEY);
}

function getStatusCode(error: unknown): number | undefined {
  if (error instanceof RetroAchievementsRequestError) {
    return error.statusCode;
  }
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  const rawStatus = record["statusCode"] ?? record["status"];
  return typeof rawStatus === "number" && Number.isInteger(rawStatus) ? rawStatus : undefined;
}

/** Classifies only structured transport/app errors; no credential-bearing text is retained. */
export function classifyRetroAchievementsConnectionFailure(error: unknown): RetroAchievementsConnectionFailureKind {
  const statusCode = getStatusCode(error);
  if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
    return "authentication";
  }
  if (statusCode === 429) {
    return "rate-limited";
  }
  if (statusCode !== undefined && statusCode >= 500) {
    return "server";
  }
  if (error instanceof RetroAchievementsRequestError && error.category === "network") {
    return "temporary";
  }
  if (typeof error === "object" && error !== null) {
    const category = (error as Record<string, unknown>)["category"];
    if (category === "authentication") return "authentication";
    if (category === "network_error") return "temporary";
  }
  if (typeof error === "object" && error !== null && "kind" in error) {
    const appError = error as AppError;
    if (appError.kind === "auth") return "authentication";
    if (appError.kind === "network") return "temporary";
    if (appError.kind === "rate_limit") return "rate-limited";
    if (appError.cause !== undefined) return classifyRetroAchievementsConnectionFailure(appError.cause);
  }
  return "unknown";
}

function failureMessage(kind: RetroAchievementsConnectionFailureKind): string {
  return kind === "authentication"
    ? "RetroAchievements authentication failed. Your saved username or API key is no longer valid."
    : "Unable to refresh RetroAchievements.";
}

export function markRetroAchievementsAuthenticatedSuccess(refreshedAt = Date.now()): RetroAchievementsConnectionState {
  return setConnectionState({
    version: 1,
    status: "connected",
    lastSuccessfulRefreshAt: refreshedAt,
    isShowingCachedData: false,
  });
}

export function markRetroAchievementsRefreshFailure(
  error: unknown,
  options: { readonly isShowingCachedData: boolean },
): RetroAchievementsConnectionState {
  const previous = readRetroAchievementsConnectionState();
  const failureKind = classifyRetroAchievementsConnectionFailure(error);
  return setConnectionState({
    version: 1,
    status: failureKind === "authentication" ? "authentication-required" : "temporarily-unavailable",
    ...(previous.lastSuccessfulRefreshAt !== undefined
      ? { lastSuccessfulRefreshAt: previous.lastSuccessfulRefreshAt }
      : {}),
    failureKind,
    errorMessage: failureMessage(failureKind),
    isShowingCachedData: options.isShowingCachedData,
  });
}

/** Keeps a restored dashboard visibly cached without converting it into a healthy connection. */
export function markRetroAchievementsCachedDashboardRestored(
  cachedAt: number | undefined,
): RetroAchievementsConnectionState {
  const previous = readRetroAchievementsConnectionState();
  if (previous.status === "authentication-required" || previous.status === "temporarily-unavailable") {
    return setConnectionState({ ...previous, isShowingCachedData: true });
  }
  return setConnectionState({
    version: 1,
    status: previous.status,
    ...(previous.lastSuccessfulRefreshAt !== undefined
      ? { lastSuccessfulRefreshAt: previous.lastSuccessfulRefreshAt }
      : cachedAt !== undefined ? { lastSuccessfulRefreshAt: cachedAt } : {}),
    isShowingCachedData: true,
  });
}

export function getRetroAchievementsConnectionBanner(
  state: RetroAchievementsConnectionState,
): string | undefined {
  if (state.status === "connected" || state.status === "unknown") return undefined;
  const cachedAt = state.lastSuccessfulRefreshAt !== undefined
    ? ` Showing cached data from ${new Date(state.lastSuccessfulRefreshAt).toLocaleString()}.`
    : state.isShowingCachedData ? " Showing cached data." : "";
  return `${state.errorMessage ?? failureMessage(state.failureKind ?? "unknown")}${cachedAt}`;
}

export async function validateAndSaveRetroAchievementsCredentials(args: {
  readonly username: string;
  readonly apiKeyDraft: string;
  readonly recentAchievementsCount?: RetroAchievementsProviderConfig["recentAchievementsCount"];
  readonly recentlyPlayedCount?: RetroAchievementsProviderConfig["recentlyPlayedCount"];
  readonly save: (config: {
    readonly username: string;
    readonly apiKeyDraft: string;
    readonly recentAchievementsCount?: RetroAchievementsProviderConfig["recentAchievementsCount"];
    readonly recentlyPlayedCount?: RetroAchievementsProviderConfig["recentlyPlayedCount"];
  }) => Promise<RetroAchievementsProviderConfig | undefined>;
}): Promise<RetroAchievementsCredentialSaveResult> {
  const username = args.username.trim();
  const apiKeyDraft = args.apiKeyDraft.trim();
  if (username.length === 0 || apiKeyDraft.length === 0) {
    return { saved: false, userMessage: "Enter your RetroAchievements username and API key to continue.", connectionState: readRetroAchievementsConnectionState() };
  }

  let validation: RetroAchievementsValidationResponse;
  try {
    validation = await callDeckyBackendMethod<RetroAchievementsValidationResponse>(
      "validate_retroachievements_credentials",
      { username, apiKey: apiKeyDraft },
    );
  } catch (error) {
    const state = markRetroAchievementsRefreshFailure(error, { isShowingCachedData: false });
    return { saved: false, userMessage: "Unable to contact RetroAchievements. Please try again.", connectionState: state };
  }

  if (validation.ok !== true) {
    const kind = classifyRetroAchievementsConnectionFailure({
      statusCode: validation.failure?.statusCode,
      category: validation.failure?.category,
    });
    const state = markRetroAchievementsRefreshFailure(
      { statusCode: validation.failure?.statusCode, category: validation.failure?.category },
      { isShowingCachedData: false },
    );
    return {
      saved: false,
      userMessage: kind === "authentication"
        ? "Invalid RetroAchievements username or API key. Please check your credentials and try again."
        : "Unable to contact RetroAchievements. Please try again.",
      connectionState: state,
    };
  }

  const savedConfig = await args.save({ username, apiKeyDraft, ...(args.recentAchievementsCount !== undefined ? { recentAchievementsCount: args.recentAchievementsCount } : {}), ...(args.recentlyPlayedCount !== undefined ? { recentlyPlayedCount: args.recentlyPlayedCount } : {}) });
  if (savedConfig === undefined) {
    return { saved: false, userMessage: "Unable to save provider settings right now.", connectionState: readRetroAchievementsConnectionState() };
  }
  const state = markRetroAchievementsAuthenticatedSuccess();
  return { saved: true, userMessage: "Provider settings saved.", connectionState: state };
}
