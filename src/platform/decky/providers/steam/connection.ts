import { useEffect, useSyncExternalStore } from "react";
import type { AppError } from "@core/errors";
import type { SteamProviderConfig } from "../../../../providers/steam";
import { SteamRequestError } from "../../../../providers/steam/client/transport";
import { callDeckyBackendMethod } from "../../decky-backend-bridge";
import { readDeckyStorageText, removeDeckyStorageText, writeDeckyStorageText } from "../../storage";

const CONNECTION_STORAGE_KEY = "achievement-companion:decky:steam:connection:v1";

export type SteamConnectionStatus = "unknown" | "connected" | "authentication-required" | "account-invalid" | "privacy-restricted" | "temporarily-unavailable";
export type SteamConnectionFailureKind = "authentication" | "account" | "privacy" | "rate-limited" | "temporary" | "server" | "unknown";

export interface SteamConnectionState {
  readonly version: 1;
  readonly status: SteamConnectionStatus;
  readonly lastSuccessfulRefreshAt?: number;
  readonly failureKind?: SteamConnectionFailureKind;
  readonly errorMessage?: string;
  readonly isShowingCachedData: boolean;
}

export interface SteamCredentialSaveResult {
  readonly saved: boolean;
  readonly userMessage: string;
  readonly connectionState: SteamConnectionState;
}

interface SteamValidationResponse {
  readonly ok?: unknown;
  readonly failure?: { readonly category?: unknown; readonly statusCode?: unknown };
}

let cachedState: SteamConnectionState | undefined;
let revision = 0;
const listeners = new Set<() => void>();

function defaultState(): SteamConnectionState { return { version: 1, status: "unknown", isShowingCachedData: false }; }
function notify(): void { revision += 1; for (const listener of listeners) listener(); }
function setState(state: SteamConnectionState): SteamConnectionState { cachedState = state; writeDeckyStorageText(CONNECTION_STORAGE_KEY, JSON.stringify(state)); notify(); return state; }
function timestamp(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }

function parseState(value: unknown): SteamConnectionState | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const status = record["status"];
  if (record["version"] !== 1 || !["unknown", "connected", "authentication-required", "account-invalid", "privacy-restricted", "temporarily-unavailable"].includes(String(status))) return undefined;
  const failureKind = record["failureKind"];
  const validFailure = ["authentication", "account", "privacy", "rate-limited", "temporary", "server", "unknown"].includes(String(failureKind));
  return { version: 1, status: status as SteamConnectionStatus, ...(timestamp(record["lastSuccessfulRefreshAt"]) ? { lastSuccessfulRefreshAt: record["lastSuccessfulRefreshAt"] } : {}), ...(validFailure ? { failureKind: failureKind as SteamConnectionFailureKind } : {}), ...(typeof record["errorMessage"] === "string" ? { errorMessage: record["errorMessage"] } : {}), isShowingCachedData: record["isShowingCachedData"] === true };
}

export function readSteamConnectionState(): SteamConnectionState {
  if (cachedState !== undefined) return cachedState;
  const raw = readDeckyStorageText(CONNECTION_STORAGE_KEY);
  try { cachedState = raw === undefined ? defaultState() : parseState(JSON.parse(raw)) ?? defaultState(); } catch { cachedState = defaultState(); }
  return cachedState;
}

export function useSteamConnectionState(): SteamConnectionState {
  const currentRevision = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision, () => revision);
  useEffect(() => { void currentRevision; }, [currentRevision]);
  return readSteamConnectionState();
}

export function resetSteamConnectionStateForTests(): void { cachedState = undefined; revision = 0; listeners.clear(); }
export function clearSteamConnectionState(): boolean { cachedState = defaultState(); notify(); return removeDeckyStorageText(CONNECTION_STORAGE_KEY); }

function getStatusCode(error: unknown): number | undefined {
  if (error instanceof SteamRequestError) return error.statusCode;
  if (typeof error !== "object" || error === null) return undefined;
  const status = (error as Record<string, unknown>)["statusCode"] ?? (error as Record<string, unknown>)["status"];
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}

export function classifySteamConnectionFailure(error: unknown): SteamConnectionFailureKind {
  const statusCode = getStatusCode(error);
  if (statusCode === 401) return "authentication";
  if (statusCode === 429) return "rate-limited";
  if (statusCode !== undefined && statusCode >= 500) return "server";
  if (error instanceof SteamRequestError) {
    if (error.category === "network") return "temporary";
    if (error.statusCode === 403 && error.path.includes("GetPlayerAchievements")) return "privacy";
    if (error.statusCode === 403) return "authentication";
  }
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    if (record["category"] === "network_error") return "temporary";
    if (record["category"] === "account") return "account";
    if (record["category"] === "privacy") return "privacy";
    if (record["category"] === "authentication") return "authentication";
    if ("kind" in record) {
      const appError = error as AppError;
      if (appError.kind === "auth") return "authentication";
      if (appError.kind === "network") return "temporary";
      if (appError.kind === "rate_limit") return "rate-limited";
      if (appError.cause !== undefined) return classifySteamConnectionFailure(appError.cause);
    }
  }
  return "unknown";
}

function message(kind: SteamConnectionFailureKind): string {
  if (kind === "authentication") return "Steam authentication failed. Your saved API key is no longer valid.";
  if (kind === "account") return "Unable to find that Steam account. Please check the SteamID64 and try again.";
  if (kind === "privacy") return "Steam connected, but some profile or game data is not publicly accessible.";
  return "Unable to refresh Steam.";
}

export function markSteamAuthenticatedSuccess(refreshedAt = Date.now()): SteamConnectionState { return setState({ version: 1, status: "connected", lastSuccessfulRefreshAt: refreshedAt, isShowingCachedData: false }); }
export function markSteamRefreshFailure(error: unknown, options: { readonly isShowingCachedData: boolean }): SteamConnectionState {
  const previous = readSteamConnectionState();
  const failureKind = classifySteamConnectionFailure(error);
  const status: SteamConnectionStatus = failureKind === "authentication" ? "authentication-required" : failureKind === "account" ? "account-invalid" : failureKind === "privacy" ? "privacy-restricted" : "temporarily-unavailable";
  return setState({ version: 1, status, ...(previous.lastSuccessfulRefreshAt !== undefined ? { lastSuccessfulRefreshAt: previous.lastSuccessfulRefreshAt } : {}), failureKind, errorMessage: message(failureKind), isShowingCachedData: options.isShowingCachedData });
}
export function markSteamCachedDashboardRestored(cachedAt: number | undefined): SteamConnectionState {
  const previous = readSteamConnectionState();
  if (previous.status !== "unknown" && previous.status !== "connected") return setState({ ...previous, isShowingCachedData: true });
  return setState({ version: 1, status: previous.status, ...(previous.lastSuccessfulRefreshAt !== undefined ? { lastSuccessfulRefreshAt: previous.lastSuccessfulRefreshAt } : cachedAt !== undefined ? { lastSuccessfulRefreshAt: cachedAt } : {}), isShowingCachedData: true });
}
export function getSteamConnectionBanner(state: SteamConnectionState): string | undefined {
  if (state.status === "unknown" || state.status === "connected") return undefined;
  const cached = state.lastSuccessfulRefreshAt !== undefined ? ` Showing cached data from ${new Date(state.lastSuccessfulRefreshAt).toLocaleString()}.` : state.isShowingCachedData ? " Showing cached data." : "";
  return `${state.errorMessage ?? message(state.failureKind ?? "unknown")}${cached}`;
}

export async function validateAndSaveSteamConfiguration(args: {
  readonly config: Omit<SteamProviderConfig, "hasApiKey">;
  readonly apiKeyDraft: string;
  readonly save: (config: Omit<SteamProviderConfig, "hasApiKey"> & { readonly apiKeyDraft: string }) => Promise<SteamProviderConfig | undefined>;
}): Promise<SteamCredentialSaveResult> {
  const steamId64 = args.config.steamId64.trim();
  const apiKeyDraft = args.apiKeyDraft.trim();
  if (!/^\d{15,20}$/u.test(steamId64)) return { saved: false, userMessage: "Unable to find that Steam account. Please check the SteamID64 and try again.", connectionState: markSteamRefreshFailure({ category: "account" }, { isShowingCachedData: false }) };
  if (apiKeyDraft.length === 0) return { saved: false, userMessage: "Enter your SteamID64 and API key to continue.", connectionState: readSteamConnectionState() };
  let validation: SteamValidationResponse;
  try { validation = await callDeckyBackendMethod<SteamValidationResponse>("validate_steam_credentials", { steamId64, apiKey: apiKeyDraft }); }
  catch (error) { const state = markSteamRefreshFailure(error, { isShowingCachedData: false }); return { saved: false, userMessage: "Unable to contact Steam. Please try again.", connectionState: state }; }
  if (validation.ok !== true) {
    const failure = { statusCode: validation.failure?.statusCode, category: validation.failure?.category };
    const kind = classifySteamConnectionFailure(failure);
    const state = markSteamRefreshFailure(failure, { isShowingCachedData: false });
    const userMessage = kind === "authentication" ? "Invalid Steam Web API key. Please check your API key and try again." : kind === "account" ? "Unable to find that Steam account. Please check the SteamID64 and try again." : kind === "privacy" ? "Steam connected, but some profile or game data is not publicly accessible." : "Unable to contact Steam. Please try again.";
    return { saved: false, userMessage, connectionState: state };
  }
  const saved = await args.save({ ...args.config, steamId64, apiKeyDraft });
  if (saved === undefined) return { saved: false, userMessage: "Unable to save provider settings right now.", connectionState: readSteamConnectionState() };
  const state = markSteamAuthenticatedSuccess();
  return { saved: true, userMessage: "Provider settings saved.", connectionState: state };
}
