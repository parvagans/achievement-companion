import { useEffect, useState, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DashboardSnapshot } from "@core/domain";
import { createSteamOSAppRuntime, type SteamOSAppRuntimeOptions } from "./create-steamos-app-runtime";
import {
  loadSteamOSBootstrapConfig,
  SteamOSRuntimeBootstrapError,
  type SteamOSRuntimeBootstrapOptions,
} from "./runtime-bootstrap";
import { SteamOSLocalBackendClientError } from "./local-backend-client";
import type { SteamOSLocalBackendClientConfig } from "./runtime-metadata";
import type { RetroAchievementsProviderConfig } from "../../providers/retroachievements/config";
import {
  DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
  RETROACHIEVEMENTS_PROVIDER_ID,
} from "../../providers/retroachievements/config";
import type { SteamProviderConfig } from "../../providers/steam/config";
import {
  DEFAULT_STEAM_PROVIDER_CONFIG,
  STEAM_PROVIDER_ID,
} from "../../providers/steam/config";
import {
  SteamOSSetupSurface,
  type SteamOSProviderConfigs,
  type SteamOSSetupFormValues,
  type SteamOSSetupSurfaceMessages,
  clearRetroAchievementsSetup,
  clearSteamSetup,
  createSteamOSSetupFormValues,
  saveRetroAchievementsSetup,
  saveSteamSetup,
} from "./setup-surface";
import { SteamOSDashboardSurface, type SteamOSDashboardProviderId, type SteamOSDashboardProviderStatuses, resolveInitialDashboardProviderId } from "./dashboard-surface";
import type {
  SteamOSDevShellDiagnosticsStatus,
  SteamOSDiagnosticsStatusStore,
  SteamOSRetroAchievementsDevShellStatus,
  SteamOSSteamDevShellStatus,
} from "./steamos-adapters";

export type SteamOSBootstrapPhase = "loading" | "connected" | "error";
export type SteamOSProviderConfigStatus = "configured" | "not_configured" | "setup_incomplete" | "unavailable";
export type SteamOSRecoveryCode =
  | "backend_unavailable"
  | "runtime_unavailable"
  | "invalid_runtime_metadata"
  | "setup_incomplete"
  | "provider_refresh_failed"
  | "cache_read_failed"
  | "cache_write_failed";

export interface SteamOSProviderStatus {
  readonly label: string;
  readonly status: SteamOSProviderConfigStatus;
}

export type SteamOSDevShellDiagnosticsPhase = "loading" | "loaded" | "error";

export interface SteamOSDevShellDiagnosticsState {
  readonly phase: SteamOSDevShellDiagnosticsPhase;
  readonly message: string;
  readonly recoveryHint?: string;
  readonly errorCode?: SteamOSRecoveryCode;
  readonly snapshot?: SteamOSDevShellDiagnosticsStatus;
}

export interface SteamOSBootstrapState {
  readonly phase: SteamOSBootstrapPhase;
  readonly message: string;
  readonly recoveryHint?: string;
  readonly errorCode?: SteamOSRecoveryCode;
  readonly providerConfigStatus?: "loaded" | "unavailable";
  readonly providers?: {
    readonly retroAchievements: SteamOSProviderStatus;
    readonly steam: SteamOSProviderStatus;
  };
  readonly providerConfigs?: SteamOSProviderConfigs;
}

export interface SteamOSBootstrapResult {
  readonly state: SteamOSBootstrapState;
  readonly runtime?: ReturnType<typeof createSteamOSAppRuntime>;
}

export interface SteamOSBootstrapDependencies {
  readonly loadBootstrapConfig?: (
    options?: SteamOSRuntimeBootstrapOptions,
  ) => Promise<SteamOSLocalBackendClientConfig>;
  readonly createRuntime?: (
    config: SteamOSLocalBackendClientConfig,
    options?: SteamOSAppRuntimeOptions,
  ) => ReturnType<typeof createSteamOSAppRuntime>;
  readonly renderState?: (state: SteamOSBootstrapState) => void;
  readonly fetchImpl?: SteamOSRuntimeBootstrapOptions["fetchImpl"];
}

export interface MountSteamOSBootstrapOptions extends SteamOSBootstrapDependencies {
  readonly document?: Document;
  readonly rootElement?: Element;
}

export interface AutoMountSteamOSBootstrapOptions extends MountSteamOSBootstrapOptions {
  readonly mount?: (options?: MountSteamOSBootstrapOptions) => Promise<SteamOSBootstrapResult>;
}

const PAGE_STYLE: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  maxWidth: "1080px",
  margin: "0 auto",
  padding: "1.5rem 1rem 2rem",
  display: "grid",
  gap: "1.1rem",
  color: "#e2e8f0",
  fontFamily: "\"Segoe UI\", system-ui, sans-serif",
  background:
    "radial-gradient(circle at top, rgba(59, 130, 246, 0.18), transparent 34%), linear-gradient(180deg, #0a0f19 0%, #0f172a 48%, #111827 100%)",
};

const STEAMOS_INPUT_READINESS_CSS = `
  .steamos-shell,
  .steamos-shell * {
    box-sizing: border-box;
  }

  .steamos-shell button,
  .steamos-shell input {
    font: inherit;
  }

  .steamos-shell .steamos-focus-target,
  .steamos-shell [data-steamos-focus-group="true"] {
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      background-color 140ms ease,
      transform 140ms ease;
  }

  .steamos-shell .steamos-focus-target:focus-visible {
    outline: 3px solid rgba(125, 211, 252, 0.95);
    outline-offset: 3px;
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.18);
  }

  .steamos-shell button.steamos-focus-target:disabled,
  .steamos-shell input.steamos-focus-target:disabled {
    cursor: not-allowed;
    opacity: 0.64;
  }

  .steamos-shell [data-steamos-focus-group="true"]:focus-within {
    border-color: rgba(125, 211, 252, 0.72) !important;
    box-shadow:
      0 0 0 1px rgba(125, 211, 252, 0.3),
      0 0 0 4px rgba(14, 165, 233, 0.12),
      0 18px 38px rgba(2, 6, 23, 0.28);
  }

  .steamos-shell .steamos-action-row > * {
    flex: 1 1 168px;
    text-align: center;
  }

  .steamos-shell .steamos-input-target {
    caret-color: #7dd3fc;
  }

  .steamos-shell .steamos-secondary-panel {
    opacity: 0.94;
  }

  @media (max-width: 900px) {
    .steamos-shell {
      padding: 1rem 0.85rem 1.5rem;
    }

    .steamos-shell .steamos-action-row > * {
      flex-basis: 100%;
    }
  }
`;

const PAGE_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
  lineHeight: 1.06,
  letterSpacing: "-0.02em",
};

const PAGE_SUBTITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  color: "#94a3b8",
};

const STATUS_PANEL_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "18px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.74) 100%)",
  padding: "1rem 1.1rem",
  boxShadow: "0 16px 40px rgba(2, 6, 23, 0.32)",
  display: "grid",
  gap: "0.6rem",
};

const STATUS_MESSAGE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 700,
  color: "#f8fafc",
};

const STATUS_HINT_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.55,
};

const DEV_SHELL_STATUS_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "18px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.78) 0%, rgba(15, 23, 42, 0.6) 100%)",
  padding: "1rem 1.1rem",
  boxShadow: "0 16px 40px rgba(2, 6, 23, 0.28)",
  display: "grid",
  gap: "0.8rem",
};

const DEV_SHELL_STATUS_HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const DEV_SHELL_STATUS_HEADING_GROUP_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const DEV_SHELL_STATUS_EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#60a5fa",
};

const DEV_SHELL_STATUS_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  color: "#f8fafc",
};

const DEV_SHELL_STATUS_DETAIL_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "0.75rem",
};

const DEV_SHELL_STATUS_ITEM_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.15)",
  borderRadius: "14px",
  backgroundColor: "rgba(15, 23, 42, 0.72)",
  padding: "0.9rem",
  display: "grid",
  gap: "0.35rem",
};

const DEV_SHELL_STATUS_ITEM_LABEL_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.88rem",
  color: "#94a3b8",
};

const DEV_SHELL_STATUS_ITEM_VALUE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.98rem",
  fontWeight: 700,
  color: "#f8fafc",
  lineHeight: 1.4,
};

const DEV_SHELL_STATUS_HELP_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const DEV_SHELL_STATUS_BUTTON_STYLE: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(96, 165, 250, 0.35)",
  borderRadius: "999px",
  background: "linear-gradient(180deg, rgba(37, 99, 235, 0.95) 0%, rgba(29, 78, 216, 0.95) 100%)",
  color: "#ffffff",
  padding: "0.9rem 1rem",
  minHeight: "50px",
  minWidth: "172px",
  fontWeight: 700,
  cursor: "pointer",
};

const STEAMOS_SETUP_SECTION_ID = "steamos-setup-surface";
const STEAMOS_DASHBOARD_SECTION_ID = "steamos-dashboard-surface";
const STEAMOS_APP_OVERVIEW_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "20px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.72) 100%)",
  padding: "1.1rem",
  boxShadow: "0 16px 42px rgba(2, 6, 23, 0.3)",
  display: "grid",
  gap: "0.95rem",
};

const STEAMOS_APP_OVERVIEW_HEADER_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const STEAMOS_APP_OVERVIEW_EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#60a5fa",
};

const STEAMOS_APP_OVERVIEW_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  color: "#f8fafc",
};

const STEAMOS_APP_OVERVIEW_HELP_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.55,
};

const STEAMOS_PROVIDER_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "0.9rem",
};

const STEAMOS_PROVIDER_CARD_STYLE: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: "16px",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(17, 24, 39, 0.84) 100%)",
  padding: "1.05rem",
  display: "grid",
  gap: "0.95rem",
  boxShadow: "0 10px 24px rgba(2, 6, 23, 0.22)",
};

const STEAMOS_PROVIDER_CARD_ACTIVE_STYLE: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.7)",
  boxShadow: "0 0 0 1px rgba(96, 165, 250, 0.14), 0 16px 34px rgba(37, 99, 235, 0.18)",
};

const STEAMOS_PROVIDER_CARD_HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const STEAMOS_PROVIDER_CARD_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.02rem",
  color: "#f8fafc",
};

const STEAMOS_PROVIDER_CARD_STATUS_BADGE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.4rem 0.75rem",
  minHeight: "2rem",
  fontSize: "0.84rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  border: "1px solid transparent",
};

const STEAMOS_PROVIDER_CARD_STATUS_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const STEAMOS_PROVIDER_CARD_META_STYLE: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  lineHeight: 1.45,
};

const STEAMOS_PROVIDER_CARD_ACTIONS_STYLE: CSSProperties = {
  display: "flex",
  gap: "0.65rem",
  flexWrap: "wrap",
};

const STEAMOS_PROVIDER_CARD_PRIMARY_ACTION_STYLE: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(59, 130, 246, 0.4)",
  borderRadius: "999px",
  background: "linear-gradient(180deg, rgba(37, 99, 235, 0.96) 0%, rgba(29, 78, 216, 0.96) 100%)",
  color: "#ffffff",
  padding: "0.9rem 1rem",
  minHeight: "50px",
  minWidth: "150px",
  fontWeight: 700,
  cursor: "pointer",
};

const STEAMOS_PROVIDER_CARD_SECONDARY_ACTION_STYLE: CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  borderRadius: "999px",
  backgroundColor: "rgba(15, 23, 42, 0.72)",
  color: "#e2e8f0",
  padding: "0.9rem 1rem",
  minHeight: "50px",
  minWidth: "150px",
  fontWeight: 700,
  cursor: "pointer",
};

const STEAMOS_PROVIDER_CARD_TERTIARY_ACTION_STYLE: CSSProperties = {
  appearance: "none",
  border: "1px solid transparent",
  backgroundColor: "transparent",
  color: "#93c5fd",
  padding: "0.9rem 0.4rem",
  minHeight: "50px",
  minWidth: "150px",
  fontWeight: 700,
  cursor: "pointer",
};

const SECTION_HEADER_STYLE: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const EYEBROW_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#60a5fa",
};

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  color: "#f8fafc",
};

const ERROR_TEXT_STYLE: CSSProperties = {
  margin: 0,
  color: "#fda4af",
  fontWeight: 700,
};

const BACKEND_RECOVERY_HINT =
  "Check that start:steamos is still running, reload this shell, or restart it if needed.";
const RUNTIME_RECOVERY_HINT =
  "Reload this shell. If runtime metadata still fails, restart start:steamos and try again.";
const SETUP_INCOMPLETE_HINT =
  "Open setup, save the provider credentials again, then retry the dashboard.";
const NO_DASHBOARD_HINT =
  "No dashboard is available yet. Check setup, then retry Refresh when the backend is running.";
const CACHE_READ_FAILURE_HINT =
  "Cached dashboard data could not be read safely. Try Refresh again to rebuild it.";

function createRecoveryState(
  phase: SteamOSBootstrapPhase,
  message: string,
  errorCode?: SteamOSRecoveryCode,
  recoveryHint?: string,
): Pick<SteamOSBootstrapState, "message" | "errorCode" | "recoveryHint" | "phase"> {
  return {
    phase,
    message,
    ...(errorCode !== undefined ? { errorCode } : {}),
    ...(recoveryHint !== undefined ? { recoveryHint } : {}),
  };
}

function describeBootstrapFailure(error: unknown): Pick<SteamOSBootstrapState, "message" | "errorCode" | "recoveryHint"> {
  if (error instanceof SteamOSRuntimeBootstrapError) {
    if (error.code === "request_failed") {
      return {
        message: "SteamOS backend unavailable",
        errorCode: "backend_unavailable",
        recoveryHint: BACKEND_RECOVERY_HINT,
      };
    }

    if (error.code === "invalid_content_type" || error.code === "invalid_json" || error.code === "invalid_metadata") {
      return {
        message: "SteamOS runtime metadata is invalid",
        errorCode: "invalid_runtime_metadata",
        recoveryHint: RUNTIME_RECOVERY_HINT,
      };
    }

    return {
      message: "SteamOS runtime unavailable",
      errorCode: "runtime_unavailable",
      recoveryHint: RUNTIME_RECOVERY_HINT,
    };
  }

  return {
    message: "SteamOS backend unavailable",
    errorCode: "backend_unavailable",
    recoveryHint: BACKEND_RECOVERY_HINT,
  };
}

function describeDiagnosticsFailure(error: unknown): Pick<SteamOSDevShellDiagnosticsState, "message" | "errorCode" | "recoveryHint"> {
  if (error instanceof SteamOSLocalBackendClientError) {
    if (error.code === "backend_unavailable" || error.category === "network_error" || error.status === 0) {
      return {
        message: "Backend unavailable",
        errorCode: "backend_unavailable",
        recoveryHint: BACKEND_RECOVERY_HINT,
      };
    }
  }

  return {
    message: "Backend unavailable",
    errorCode: "backend_unavailable",
    recoveryHint: BACKEND_RECOVERY_HINT,
  };
}

function formatDiagnosticsProviderStatus(
  configured: boolean,
  identifierPresent: boolean,
  hasApiKey: boolean,
): string {
  if (configured) {
    return "configured";
  }

  if (identifierPresent || hasApiKey) {
    return "setup incomplete";
  }

  return "not configured";
}

function deriveVisibleProviderStatus(
  baseStatus: SteamOSProviderConfigStatus,
  diagnostics:
    | SteamOSRetroAchievementsDevShellStatus
    | SteamOSSteamDevShellStatus
    | undefined,
): SteamOSProviderConfigStatus {
  if (baseStatus === "unavailable") {
    return "unavailable";
  }

  if (diagnostics === undefined) {
    return baseStatus;
  }

  const identifierPresent = "usernamePresent" in diagnostics
    ? diagnostics.usernamePresent
    : diagnostics.steamId64Present;

  if (diagnostics.configured) {
    return "configured";
  }

  if (identifierPresent || diagnostics.hasApiKey) {
    return "setup_incomplete";
  }

  return "not_configured";
}

function resolveVisibleProviderStatuses(
  providers: SteamOSBootstrapState["providers"] | undefined,
  diagnostics: SteamOSDevShellDiagnosticsStatus | undefined,
): SteamOSBootstrapState["providers"] | undefined {
  if (providers === undefined) {
    return undefined;
  }

  return {
    retroAchievements: {
      ...providers.retroAchievements,
      status: deriveVisibleProviderStatus(providers.retroAchievements.status, diagnostics?.retroAchievements),
    },
    steam: {
      ...providers.steam,
      status: deriveVisibleProviderStatus(providers.steam.status, diagnostics?.steam),
    },
  };
}

function getDashboardActionFailureMessage(args: {
  readonly providerStatus: SteamOSProviderConfigStatus | undefined;
  readonly cacheStatus: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"] | undefined;
  readonly diagnosticsState: SteamOSDevShellDiagnosticsState;
  readonly reason: "refresh_failed" | "cache_write_failed";
}): string {
  if (args.providerStatus === "setup_incomplete") {
    return "Setup incomplete. Save provider setup again, then retry.";
  }

  if (args.providerStatus === "unavailable" || args.diagnosticsState.phase === "error") {
    return "Backend unavailable. Check that start:steamos is still running, then retry.";
  }

  if (args.reason === "cache_write_failed") {
    return "Dashboard refreshed, but the cache could not be updated. Retry Refresh when the backend is available.";
  }

  if (args.cacheStatus?.present === true && args.cacheStatus.valid === true) {
    return "Showing cached dashboard data. Refresh failed. Try again when the backend is available.";
  }

  return "No dashboard available yet. Refresh failed. Check setup or retry.";
}

function createInitialDevShellDiagnosticsState(): SteamOSDevShellDiagnosticsState {
  return {
    phase: "loading",
    message: "Loading SteamOS dev shell status...",
  };
}

export async function loadSteamOSDevShellDiagnosticsStatus(
  diagnosticsStatusStore: SteamOSDiagnosticsStatusStore | undefined,
): Promise<SteamOSDevShellDiagnosticsState> {
  if (diagnosticsStatusStore === undefined) {
    return {
      phase: "error",
      message: "Diagnostics unavailable",
      errorCode: "runtime_unavailable",
      recoveryHint: RUNTIME_RECOVERY_HINT,
    };
  }

  try {
    const snapshot = await diagnosticsStatusStore.load();
    return {
      phase: "loaded",
      message: snapshot.runtimeMetadata.valid ? "SteamOS dev shell status ready" : "Runtime unavailable",
      ...(snapshot.runtimeMetadata.valid
        ? {}
        : {
          errorCode: "runtime_unavailable" as const,
          recoveryHint: RUNTIME_RECOVERY_HINT,
        }),
      snapshot,
    };
  } catch (error) {
    const failure = describeDiagnosticsFailure(error);
    return {
      phase: "error",
      ...failure,
    };
  }
}

function createBootstrapState(
  phase: SteamOSBootstrapPhase,
  providerState?: {
    readonly providerConfigStatus?: SteamOSBootstrapState["providerConfigStatus"];
    readonly providerConfigs?: SteamOSBootstrapState["providerConfigs"];
    readonly providers?: SteamOSBootstrapState["providers"];
    readonly errorCode?: SteamOSBootstrapState["errorCode"];
    readonly recoveryHint?: SteamOSBootstrapState["recoveryHint"];
    readonly message?: SteamOSBootstrapState["message"];
  },
): SteamOSBootstrapState {
  if (phase === "connected") {
    return {
      phase,
      message: providerState?.message ?? "Connected to SteamOS backend",
      ...(providerState?.providerConfigStatus !== undefined
        ? { providerConfigStatus: providerState.providerConfigStatus }
        : {}),
      ...(providerState?.providerConfigs !== undefined
        ? { providerConfigs: providerState.providerConfigs }
        : {}),
      ...(providerState?.providers !== undefined
        ? { providers: providerState.providers }
        : {}),
      ...(providerState?.errorCode !== undefined
        ? { errorCode: providerState.errorCode }
        : {}),
      ...(providerState?.recoveryHint !== undefined
        ? { recoveryHint: providerState.recoveryHint }
        : {}),
    };
  }

  if (phase === "error") {
    return createRecoveryState(
      phase,
      providerState?.message ?? "SteamOS backend unavailable",
      providerState?.errorCode,
      providerState?.recoveryHint,
    );
  }

  return {
    phase: "loading",
    message: "Loading SteamOS backend...",
  };
}

function isConfiguredProviderConfig(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { readonly hasApiKey?: unknown }).hasApiKey === true;
}

function createProviderStatus(
  label: string,
  status: SteamOSProviderConfigStatus,
): SteamOSProviderStatus {
  return {
    label,
    status,
  };
}

function formatPresenceStatus(present: boolean): string {
  return present ? "present" : "missing";
}

function formatValidityStatus(present: boolean, valid: boolean): string {
  if (!present) {
    return "missing";
  }

  return valid ? "valid" : "invalid";
}

function formatCacheStatus(status: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"]): string {
  if (!status.present) {
    return "missing";
  }

  return status.valid ? "cached" : "unreadable";
}

function formatCacheDetails(status: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"]): string {
  const details: string[] = [];
  if (status.sizeBytes !== undefined) {
    details.push(`size ${status.sizeBytes.toLocaleString()} B`);
  }
  if (status.mtimeMs !== undefined) {
    details.push(`mtimeMs ${status.mtimeMs.toLocaleString()}`);
  }
  if (status.refreshedAtMs !== undefined) {
    details.push(`refreshedAtMs ${status.refreshedAtMs.toLocaleString()}`);
  }
  return details.length > 0 ? details.join(" · ") : "No cache metadata available";
}

async function loadProviderStatuses(
  runtime: ReturnType<typeof createSteamOSAppRuntime>,
): Promise<Pick<SteamOSBootstrapState, "providerConfigStatus" | "providerConfigs" | "providers">> {
  const providerConfigStore = runtime.adapters.providerConfigStore;
  if (providerConfigStore === undefined) {
    return {
      providerConfigStatus: "unavailable",
      providerConfigs: {
        retroAchievements: DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
        steam: DEFAULT_STEAM_PROVIDER_CONFIG,
      },
      providers: {
        retroAchievements: createProviderStatus("RetroAchievements", "unavailable"),
        steam: createProviderStatus("Steam", "unavailable"),
      },
    };
  }

  try {
    const [retroAchievementsConfig, steamConfig] = await Promise.all([
      providerConfigStore.load(RETROACHIEVEMENTS_PROVIDER_ID),
      providerConfigStore.load(STEAM_PROVIDER_ID),
    ]);
    const normalizedRetroAchievementsConfig = (retroAchievementsConfig as RetroAchievementsProviderConfig | undefined)
      ?? DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG;
    const normalizedSteamConfig = (steamConfig as SteamProviderConfig | undefined)
      ?? DEFAULT_STEAM_PROVIDER_CONFIG;

    return {
      providerConfigStatus: "loaded",
      providerConfigs: {
        retroAchievements: normalizedRetroAchievementsConfig,
        steam: normalizedSteamConfig,
      },
      providers: {
        retroAchievements: createProviderStatus(
          "RetroAchievements",
          isConfiguredProviderConfig(retroAchievementsConfig) ? "configured" : "not_configured",
        ),
        steam: createProviderStatus(
          "Steam",
          isConfiguredProviderConfig(steamConfig) ? "configured" : "not_configured",
        ),
      },
    };
  } catch {
    return {
      providerConfigStatus: "unavailable",
      providerConfigs: {
        retroAchievements: DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
        steam: DEFAULT_STEAM_PROVIDER_CONFIG,
      },
      providers: {
        retroAchievements: createProviderStatus("RetroAchievements", "unavailable"),
        steam: createProviderStatus("Steam", "unavailable"),
      },
    };
  }
}

function formatProviderStatus(status: SteamOSProviderConfigStatus): string {
  if (status === "configured") {
    return "configured";
  }

  if (status === "setup_incomplete") {
    return "setup incomplete";
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  return "not configured";
}

function createSurfaceMessages(
  updates: {
    readonly retroAchievements?: string | undefined;
    readonly steam?: string | undefined;
    readonly providerConfig?: string | undefined;
  },
): SteamOSSetupSurfaceMessages {
  return {
    ...(updates.retroAchievements !== undefined ? { retroAchievements: updates.retroAchievements } : {}),
    ...(updates.steam !== undefined ? { steam: updates.steam } : {}),
    ...(updates.providerConfig !== undefined ? { providerConfig: updates.providerConfig } : {}),
  };
}

function formatProviderCardStatusLabel(
  providerStatus: SteamOSProviderConfigStatus,
  cacheStatus: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"] | undefined,
): string {
  if (providerStatus !== "configured") {
    if (providerStatus === "unavailable") {
      return "Backend unavailable";
    }

    if (providerStatus === "setup_incomplete") {
      return "Setup incomplete";
    }

    return "Setup required";
  }

  if (cacheStatus?.present === true && cacheStatus.valid === true) {
    return "Cached dashboard available";
  }

  return "Configured, no cached dashboard yet";
}

function formatProviderCardDescription(
  providerStatus: SteamOSProviderConfigStatus,
  cacheStatus: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"] | undefined,
): string {
  if (providerStatus !== "configured") {
    if (providerStatus === "unavailable") {
      return BACKEND_RECOVERY_HINT;
    }

    if (providerStatus === "setup_incomplete") {
      return SETUP_INCOMPLETE_HINT;
    }

    return "Save provider credentials before opening the dashboard.";
  }

  if (cacheStatus?.present === true && cacheStatus.valid === true) {
    return formatCacheDetails(cacheStatus);
  }

  return "Refresh dashboard when you want to write the first cached snapshot.";
}

function getProviderCardPrimaryActionLabel(
  providerStatus: SteamOSProviderConfigStatus,
  cacheStatus: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"] | undefined,
): string {
  if (providerStatus === "setup_incomplete") {
    return "Edit setup";
  }

  if (providerStatus !== "configured") {
    return "Set up";
  }

  if (cacheStatus?.present === true && cacheStatus.valid === true) {
    return "Open dashboard";
  }

  return "Refresh dashboard";
}

function getProviderCardSecondaryActionLabel(
  providerStatus: SteamOSProviderConfigStatus,
  cacheStatus: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"] | undefined,
): string {
  if (providerStatus === "setup_incomplete") {
    return "Open dashboard";
  }

  if (providerStatus !== "configured") {
    return "Open dashboard";
  }

  if (cacheStatus?.present === true && cacheStatus.valid === true) {
    return "Refresh dashboard";
  }

  return "Open dashboard";
}

function getProviderCardTertiaryActionLabel(_providerStatus: SteamOSProviderConfigStatus): string {
  return "Edit setup";
}

function getProviderCardBadgeStyle(
  providerStatus: SteamOSProviderConfigStatus,
  isSelected: boolean,
): CSSProperties {
  const base = {
    ...STEAMOS_PROVIDER_CARD_STATUS_BADGE_STYLE,
    ...(isSelected ? { outline: "2px solid rgba(59, 130, 246, 0.35)", outlineOffset: "2px" } : {}),
  };

  if (providerStatus === "configured") {
    return {
      ...base,
      backgroundColor: "#dcfce7",
      color: "#166534",
    };
  }

  if (providerStatus === "setup_incomplete") {
    return {
      ...base,
      backgroundColor: "#fef3c7",
      color: "#92400e",
    };
  }

  if (providerStatus === "unavailable") {
    return {
      ...base,
      backgroundColor: "#fef3c7",
      color: "#92400e",
    };
  }

  return {
    ...base,
    backgroundColor: "#e5e7eb",
    color: "#374151",
  };
}

function scrollToSection(id: string): void {
  globalThis.document?.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SteamOSAppShellOverview(
  { state, diagnostics, selectedProviderId, dashboardMessages, onOpenSetup, onOpenDashboard, onRefreshDashboard }: {
    readonly state: SteamOSBootstrapState;
    readonly diagnostics: SteamOSDevShellDiagnosticsState;
    readonly selectedProviderId: SteamOSDashboardProviderId;
    readonly dashboardMessages?: Partial<Record<SteamOSDashboardProviderId, string>>;
    readonly onOpenSetup?: (providerId: SteamOSDashboardProviderId) => void;
    readonly onOpenDashboard?: (providerId: SteamOSDashboardProviderId) => void;
    readonly onRefreshDashboard?: (providerId: SteamOSDashboardProviderId) => void;
  },
): JSX.Element {
  const diagnosticsSnapshot = diagnostics.snapshot;
  const retroCache = diagnosticsSnapshot?.dashboardCache.retroAchievements;
  const steamCache = diagnosticsSnapshot?.dashboardCache.steam;

  const cards: Array<{
    readonly providerId: SteamOSDashboardProviderId;
    readonly title: string;
    readonly providerStatus: SteamOSProviderConfigStatus;
    readonly cacheStatus: SteamOSDevShellDiagnosticsStatus["dashboardCache"]["retroAchievements"] | undefined;
  }> = [
    {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      title: "RetroAchievements",
      providerStatus: state.providers?.retroAchievements.status ?? "unavailable",
      cacheStatus: retroCache,
    },
    {
      providerId: STEAM_PROVIDER_ID,
      title: "Steam",
      providerStatus: state.providers?.steam.status ?? "unavailable",
      cacheStatus: steamCache,
    },
  ];

  return (
    <section aria-label="SteamOS app overview" style={STEAMOS_APP_OVERVIEW_STYLE}>
      <div style={STEAMOS_APP_OVERVIEW_HEADER_STYLE}>
        <p style={STEAMOS_APP_OVERVIEW_EYEBROW_STYLE}>Home</p>
        <h2 style={STEAMOS_APP_OVERVIEW_TITLE_STYLE}>SteamOS app shell</h2>
        <p style={STEAMOS_APP_OVERVIEW_HELP_STYLE}>
          Use these provider cards to jump between setup, the cached dashboard, and refresh actions without exposing
          secrets.
        </p>
      </div>
      <div style={STEAMOS_PROVIDER_GRID_STYLE}>
        {cards.map((card) => {
          const isSelected = selectedProviderId === card.providerId;
          const primaryActionLabel = getProviderCardPrimaryActionLabel(card.providerStatus, card.cacheStatus);
          const secondaryActionLabel = getProviderCardSecondaryActionLabel(card.providerStatus, card.cacheStatus);
          const tertiaryActionLabel = getProviderCardTertiaryActionLabel(card.providerStatus);
          const showTertiaryAction = tertiaryActionLabel !== primaryActionLabel;
          const canRefresh = card.providerStatus === "configured";
          const isConfigured = card.providerStatus === "configured";
          return (
            <article
              key={card.providerId}
              aria-label={`${card.title} app card`}
              data-steamos-provider-card="true"
              data-steamos-focus-group="true"
              style={{
                ...STEAMOS_PROVIDER_CARD_STYLE,
                ...(isSelected ? STEAMOS_PROVIDER_CARD_ACTIVE_STYLE : {}),
              }}
            >
              <div style={STEAMOS_PROVIDER_CARD_HEADER_STYLE}>
                <h3 style={STEAMOS_PROVIDER_CARD_TITLE_STYLE}>{card.title}</h3>
                <span style={getProviderCardBadgeStyle(card.providerStatus, isSelected)}>
                  {formatProviderCardStatusLabel(card.providerStatus, card.cacheStatus)}
                </span>
              </div>
              <p style={STEAMOS_PROVIDER_CARD_STATUS_TEXT_STYLE}>
                {formatProviderCardDescription(card.providerStatus, card.cacheStatus)}
              </p>
              {diagnosticsSnapshot !== undefined ? (
                <p style={STEAMOS_PROVIDER_CARD_META_STYLE}>
                  {card.cacheStatus?.present === true
                    ? `Cache present${card.cacheStatus.mtimeMs !== undefined ? ` ? updated ${new Date(card.cacheStatus.mtimeMs).toLocaleString()}` : ""}`
                    : "Cache missing"}
                </p>
              ) : (
                <p style={STEAMOS_PROVIDER_CARD_META_STYLE}>
                  Dev status is still loading or unavailable.
                </p>
              )}
              {dashboardMessages?.[card.providerId] !== undefined ? (
                <p role="alert" style={ERROR_TEXT_STYLE}>{dashboardMessages[card.providerId]}</p>
              ) : null}
              <div className="steamos-action-row" style={STEAMOS_PROVIDER_CARD_ACTIONS_STYLE}>
                <button
                  className="steamos-focus-target steamos-button-target"
                  type="button"
                  style={STEAMOS_PROVIDER_CARD_PRIMARY_ACTION_STYLE}
                  onClick={() => {
                    if (primaryActionLabel === "Open dashboard") {
                      onOpenDashboard?.(card.providerId);
                      return;
                    }
                    if (primaryActionLabel === "Refresh dashboard") {
                      onRefreshDashboard?.(card.providerId);
                      return;
                    }
                    onOpenSetup?.(card.providerId);
                  }}
                >
                  {primaryActionLabel}
                </button>
                <button
                  className="steamos-focus-target steamos-button-target"
                  type="button"
                  style={STEAMOS_PROVIDER_CARD_SECONDARY_ACTION_STYLE}
                  disabled={!isConfigured && secondaryActionLabel === "Open dashboard"}
                  onClick={() => {
                    if (secondaryActionLabel === "Open dashboard") {
                      onOpenDashboard?.(card.providerId);
                      return;
                    }
                    onRefreshDashboard?.(card.providerId);
                  }}
                >
                  {secondaryActionLabel}
                </button>
                {showTertiaryAction ? (
                  <button
                    className="steamos-focus-target steamos-button-target"
                    type="button"
                    style={STEAMOS_PROVIDER_CARD_TERTIARY_ACTION_STYLE}
                    onClick={() => onOpenSetup?.(card.providerId)}
                  >
                    {tertiaryActionLabel}
                  </button>
                ) : null}
              </div>
              {canRefresh ? null : (
                <p style={STEAMOS_PROVIDER_CARD_META_STYLE}>
                  {card.providerStatus === "setup_incomplete"
                    ? "Dashboard refresh stays unavailable until setup is saved again."
                    : "Refresh becomes available after setup is saved."}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function resolveRootElement(options: MountSteamOSBootstrapOptions): Element {
  const rootElement = options.rootElement
    ?? options.document?.getElementById("root")
    ?? globalThis.document?.getElementById("root");

  if (rootElement === null || rootElement === undefined) {
    throw new Error("SteamOS bootstrap root element not found.");
  }

  return rootElement;
}

export function SteamOSBootstrapStatus(
  { state }: { readonly state: SteamOSBootstrapState },
): JSX.Element {
  return (
    <main className="steamos-shell" data-steamos-bootstrap-state={state.phase} style={PAGE_STYLE}>
      <style>{STEAMOS_INPUT_READINESS_CSS}</style>
      <header>
        <h1 style={PAGE_TITLE_STYLE}>Achievement Companion</h1>
        <p style={PAGE_SUBTITLE_STYLE}>SteamOS dev shell</p>
      </header>
      <section style={STATUS_PANEL_STYLE}>
        <p style={STATUS_MESSAGE_STYLE}>{state.message}</p>
        <p style={STATUS_HINT_STYLE}>
          {state.recoveryHint
            ?? "This shell only bootstraps local backend access and provider setup. It does not validate live provider connectivity yet."}
        </p>
      </section>
      {state.providerConfigStatus === "unavailable" ? <p>Provider config unavailable</p> : null}
      {state.providers !== undefined ? (
        <dl>
          <div>
            <dt>{state.providers.retroAchievements.label}</dt>
            <dd>{formatProviderStatus(state.providers.retroAchievements.status)}</dd>
          </div>
          <div>
            <dt>{state.providers.steam.label}</dt>
            <dd>{formatProviderStatus(state.providers.steam.status)}</dd>
          </div>
        </dl>
      ) : null}
    </main>
  );
}

export function SteamOSDevShellStatusPanel(
  { state, onRefresh }: { readonly state: SteamOSDevShellDiagnosticsState; readonly onRefresh?: () => void },
): JSX.Element {
  const refreshButtonLabel = state.phase === "loading" ? "Refreshing status..." : "Refresh status";
  const isRefreshing = state.phase === "loading";
  const diagnostics = state.snapshot;

  return (
    <section className="steamos-secondary-panel" data-steamos-secondary-panel="true" data-steamos-focus-group="true" style={DEV_SHELL_STATUS_STYLE}>
      <div style={DEV_SHELL_STATUS_HEADER_STYLE}>
        <div style={DEV_SHELL_STATUS_HEADING_GROUP_STYLE}>
          <p style={DEV_SHELL_STATUS_EYEBROW_STYLE}>Development</p>
          <h2 style={DEV_SHELL_STATUS_TITLE_STYLE}>SteamOS dev shell status</h2>
        </div>
        {onRefresh !== undefined ? (
          <button
            className="steamos-focus-target steamos-button-target"
            type="button"
            style={DEV_SHELL_STATUS_BUTTON_STYLE}
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            {refreshButtonLabel}
          </button>
        ) : null}
      </div>
      <p style={DEV_SHELL_STATUS_HELP_STYLE}>
        This checks local backend reachability, runtime metadata, provider setup, and cached dashboard snapshots.
        It does not refresh providers or start a Steam scan.
      </p>
      <p role="status" aria-live="polite" style={STATUS_MESSAGE_STYLE}>
        {state.message}
      </p>
      {state.recoveryHint !== undefined ? (
        <p style={DEV_SHELL_STATUS_HELP_STYLE}>{state.recoveryHint}</p>
      ) : null}
      {diagnostics !== undefined ? (
        <div style={DEV_SHELL_STATUS_DETAIL_GRID_STYLE}>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>Backend</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {diagnostics.backendReachable ? "reachable" : "unavailable"}
            </p>
          </div>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>Runtime metadata</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {formatValidityStatus(diagnostics.runtimeMetadata.present, diagnostics.runtimeMetadata.valid)}
            </p>
          </div>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>Provider config file</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {formatPresenceStatus(diagnostics.providerConfigFilePresent)}
            </p>
          </div>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>Provider secrets file</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {formatPresenceStatus(diagnostics.providerSecretsFilePresent)}
            </p>
          </div>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>RetroAchievements</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {formatDiagnosticsProviderStatus(
                diagnostics.retroAchievements.configured,
                diagnostics.retroAchievements.usernamePresent,
                diagnostics.retroAchievements.hasApiKey,
              )}
            </p>
            <p style={DEV_SHELL_STATUS_HELP_STYLE}>
              username {formatPresenceStatus(diagnostics.retroAchievements.usernamePresent)} · API key{" "}
              {formatPresenceStatus(diagnostics.retroAchievements.hasApiKey)}
            </p>
          </div>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>Steam</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {formatDiagnosticsProviderStatus(
                diagnostics.steam.configured,
                diagnostics.steam.steamId64Present,
                diagnostics.steam.hasApiKey,
              )}
            </p>
            <p style={DEV_SHELL_STATUS_HELP_STYLE}>
              SteamID64 {formatPresenceStatus(diagnostics.steam.steamId64Present)} · API key{" "}
              {formatPresenceStatus(diagnostics.steam.hasApiKey)}
            </p>
          </div>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>RetroAchievements cache</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {formatCacheStatus(diagnostics.dashboardCache.retroAchievements)}
            </p>
            <p style={DEV_SHELL_STATUS_HELP_STYLE}>
              {formatCacheDetails(diagnostics.dashboardCache.retroAchievements)}
            </p>
          </div>
          <div style={DEV_SHELL_STATUS_ITEM_STYLE}>
            <p style={DEV_SHELL_STATUS_ITEM_LABEL_STYLE}>Steam cache</p>
            <p style={DEV_SHELL_STATUS_ITEM_VALUE_STYLE}>
              {formatCacheStatus(diagnostics.dashboardCache.steam)}
            </p>
            <p style={DEV_SHELL_STATUS_HELP_STYLE}>
              {formatCacheDetails(diagnostics.dashboardCache.steam)}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function createInitialConnectedState(
  state: SteamOSBootstrapState,
): SteamOSBootstrapState {
  return state.phase === "connected"
    ? state
    : createBootstrapState("connected", {
      providerConfigStatus: "loaded",
      providerConfigs: {
        retroAchievements: DEFAULT_RETROACHIEVEMENTS_PROVIDER_CONFIG,
        steam: DEFAULT_STEAM_PROVIDER_CONFIG,
      },
      providers: {
        retroAchievements: createProviderStatus("RetroAchievements", "not_configured"),
        steam: createProviderStatus("Steam", "not_configured"),
      },
    });
}

export function SteamOSBootstrapShell(
  options: SteamOSBootstrapDependencies & { readonly onResolved?: (result: SteamOSBootstrapResult) => void } = {},
): JSX.Element {
  const [result, setResult] = useState<SteamOSBootstrapResult>({
    state: createBootstrapState("loading"),
  });
  const [devShellDiagnosticsState, setDevShellDiagnosticsState] = useState<SteamOSDevShellDiagnosticsState>(
    createInitialDevShellDiagnosticsState(),
  );
  const [values, setValues] = useState<SteamOSSetupFormValues>(createSteamOSSetupFormValues());
  const [messages, setMessages] = useState<SteamOSSetupSurfaceMessages>({});
  const [busyProviderId, setBusyProviderId] = useState<typeof RETROACHIEVEMENTS_PROVIDER_ID | typeof STEAM_PROVIDER_ID>();
  const [selectedDashboardProviderId, setSelectedDashboardProviderId] = useState<SteamOSDashboardProviderId>(
    resolveInitialDashboardProviderId(result.state.providers),
  );
  const [dashboardReloadNonce, setDashboardReloadNonce] = useState(0);
  const [dashboardActionMessages, setDashboardActionMessages] = useState<Partial<Record<SteamOSDashboardProviderId, string>>>({});

  async function refreshDevShellDiagnosticsStatus(runtime = result.runtime): Promise<void> {
    setDevShellDiagnosticsState(createInitialDevShellDiagnosticsState());
    setDevShellDiagnosticsState(
      await loadSteamOSDevShellDiagnosticsStatus(runtime?.adapters.diagnosticsStatusStore),
    );
  }

  function scrollToSection(sectionId: string): void {
    globalThis.document?.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setDashboardActionMessage(providerId: SteamOSDashboardProviderId, message?: string): void {
    setDashboardActionMessages((currentMessages) => {
      const nextMessages = { ...currentMessages };
      if (message === undefined) {
        delete nextMessages[providerId];
      } else {
        nextMessages[providerId] = message;
      }
      return nextMessages;
    });
  }

  useEffect(() => {
    let disposed = false;

    void bootstrapSteamOSShell(options).then((nextResult) => {
      if (disposed) {
        return;
      }

      setResult(nextResult);
      options.onResolved?.(nextResult);
      if (nextResult.state.phase === "connected") {
        setValues(createSteamOSSetupFormValues(nextResult.state.providerConfigs));
      }
    });

    return () => {
      disposed = true;
    };
  }, [options]);

  useEffect(() => {
    const visibleProviders = resolveVisibleProviderStatuses(result.state.providers, devShellDiagnosticsState.snapshot);
    if (result.state.phase !== "connected" || visibleProviders === undefined) {
      return;
    }

    setSelectedDashboardProviderId((currentProviderId) => {
      const currentProviderStatus = currentProviderId === STEAM_PROVIDER_ID
        ? visibleProviders.steam.status
        : visibleProviders.retroAchievements.status;
      if (currentProviderStatus === "configured") {
        return currentProviderId;
      }

      return resolveInitialDashboardProviderId(visibleProviders);
    });
  }, [devShellDiagnosticsState.snapshot, result.state.phase, result.state.providers]);

  useEffect(() => {
    if (result.state.phase !== "connected") {
      return;
    }

    let disposed = false;
    void (async () => {
      const nextState = await loadSteamOSDevShellDiagnosticsStatus(result.runtime?.adapters.diagnosticsStatusStore);
      if (!disposed) {
        setDevShellDiagnosticsState(nextState);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [result.runtime, result.state.phase]);

  async function reloadProviderStatuses(
    runtime: ReturnType<typeof createSteamOSAppRuntime>,
    nextValues: SteamOSSetupFormValues,
    nextMessages: SteamOSSetupSurfaceMessages,
  ): Promise<void> {
    const providerState = await loadProviderStatuses(runtime);
    setResult({
      state: createBootstrapState("connected", providerState),
      runtime,
    });
    setValues(nextValues);
    setMessages(nextMessages);
    await refreshDevShellDiagnosticsStatus(runtime);
  }

  async function handleSaveRetroAchievements(): Promise<void> {
    const runtime = result.runtime;
    const providerConfigs = result.state.providerConfigs;
    const providerConfigStore = runtime?.adapters.providerConfigStore;
    if (runtime === undefined || providerConfigStore === undefined || providerConfigs === undefined) {
      setMessages((currentMessages) => ({
        ...currentMessages,
        providerConfig: "Provider config unavailable",
        retroAchievements: "Could not save RetroAchievements settings",
      }));
      return;
    }

    setBusyProviderId(RETROACHIEVEMENTS_PROVIDER_ID);
    const saveResult = await saveRetroAchievementsSetup(
      providerConfigStore,
      values,
      providerConfigs.retroAchievements,
      providerConfigs,
    );
    setBusyProviderId(undefined);

    if (!saveResult.ok) {
      setValues(saveResult.values);
      setMessages((currentMessages) => ({
        ...currentMessages,
        retroAchievements: saveResult.message,
      }));
      return;
    }

    await reloadProviderStatuses(runtime, saveResult.values, createSurfaceMessages({
      steam: messages.steam,
    }));
  }

  async function handleSaveSteam(): Promise<void> {
    const runtime = result.runtime;
    const providerConfigs = result.state.providerConfigs;
    const providerConfigStore = runtime?.adapters.providerConfigStore;
    if (runtime === undefined || providerConfigStore === undefined || providerConfigs === undefined) {
      setMessages((currentMessages) => ({
        ...currentMessages,
        providerConfig: "Provider config unavailable",
        steam: "Could not save Steam settings",
      }));
      return;
    }

    setBusyProviderId(STEAM_PROVIDER_ID);
    const saveResult = await saveSteamSetup(
      providerConfigStore,
      values,
      providerConfigs.steam,
      providerConfigs,
    );
    setBusyProviderId(undefined);

    if (!saveResult.ok) {
      setValues(saveResult.values);
      setMessages((currentMessages) => ({
        ...currentMessages,
        steam: saveResult.message,
      }));
      return;
    }

    await reloadProviderStatuses(runtime, saveResult.values, createSurfaceMessages({
      retroAchievements: messages.retroAchievements,
    }));
  }

  async function handleClearRetroAchievements(): Promise<void> {
    const runtime = result.runtime;
    const providerConfigs = result.state.providerConfigs;
    const providerConfigStore = runtime?.adapters.providerConfigStore;
    if (runtime === undefined || providerConfigStore === undefined || providerConfigs === undefined) {
      setMessages((currentMessages) => ({
        ...currentMessages,
        providerConfig: "Provider config unavailable",
        retroAchievements: "Could not clear RetroAchievements settings",
      }));
      return;
    }

    setBusyProviderId(RETROACHIEVEMENTS_PROVIDER_ID);
    const clearResult = await clearRetroAchievementsSetup(providerConfigStore, values, providerConfigs);
    setBusyProviderId(undefined);

    if (!clearResult.ok) {
      setValues(clearResult.values);
      setMessages((currentMessages) => ({
        ...currentMessages,
        retroAchievements: clearResult.message,
      }));
      return;
    }

    await reloadProviderStatuses(runtime, clearResult.values, createSurfaceMessages({
      steam: messages.steam,
    }));
  }

  async function handleClearSteam(): Promise<void> {
    const runtime = result.runtime;
    const providerConfigs = result.state.providerConfigs;
    const providerConfigStore = runtime?.adapters.providerConfigStore;
    if (runtime === undefined || providerConfigStore === undefined || providerConfigs === undefined) {
      setMessages((currentMessages) => ({
        ...currentMessages,
        providerConfig: "Provider config unavailable",
        steam: "Could not clear Steam settings",
      }));
      return;
    }

    setBusyProviderId(STEAM_PROVIDER_ID);
    const clearResult = await clearSteamSetup(providerConfigStore, values, providerConfigs);
    setBusyProviderId(undefined);

    if (!clearResult.ok) {
      setValues(clearResult.values);
      setMessages((currentMessages) => ({
        ...currentMessages,
        steam: clearResult.message,
      }));
      return;
    }

    await reloadProviderStatuses(runtime, clearResult.values, createSurfaceMessages({
      retroAchievements: messages.retroAchievements,
    }));
  }

  async function handleRefreshDashboard(providerId: SteamOSDashboardProviderId): Promise<void> {
    const runtime = result.runtime;
    const providerStatuses = resolveVisibleProviderStatuses(result.state.providers, devShellDiagnosticsState.snapshot);
    const providerStatus = providerId === STEAM_PROVIDER_ID ? providerStatuses?.steam.status : providerStatuses?.retroAchievements.status;
    const cacheStatus = providerId === STEAM_PROVIDER_ID
      ? devShellDiagnosticsState.snapshot?.dashboardCache.steam
      : devShellDiagnosticsState.snapshot?.dashboardCache.retroAchievements;
    const dashboardSnapshotStore = runtime?.adapters.dashboardSnapshotStore;
    const refreshDashboard = runtime?.services.dashboard.loadDashboard.bind(runtime.services.dashboard);

    setSelectedDashboardProviderId(providerId);
    scrollToSection(STEAMOS_DASHBOARD_SECTION_ID);

    if (
      runtime === undefined
      || providerStatuses === undefined
      || providerStatus !== "configured"
      || dashboardSnapshotStore === undefined
      || refreshDashboard === undefined
    ) {
      setDashboardActionMessage(providerId, getDashboardActionFailureMessage({
        providerStatus,
        cacheStatus,
        diagnosticsState: devShellDiagnosticsState,
        reason: "refresh_failed",
      }));
      return;
    }

    setDashboardActionMessage(providerId, "Refreshing dashboard...");
    try {
      const refreshResult = await refreshDashboard(providerId, { forceRefresh: true });
      if (refreshResult.data !== undefined && refreshResult.error === undefined) {
        try {
          await dashboardSnapshotStore.write(providerId, refreshResult.data);
          setDashboardActionMessage(providerId, undefined);
        } catch {
          setDashboardActionMessage(providerId, getDashboardActionFailureMessage({
            providerStatus,
            cacheStatus,
            diagnosticsState: devShellDiagnosticsState,
            reason: "cache_write_failed",
          }));
        }
      } else {
        setDashboardActionMessage(providerId, getDashboardActionFailureMessage({
          providerStatus,
          cacheStatus,
          diagnosticsState: devShellDiagnosticsState,
          reason: "refresh_failed",
        }));
      }
    } catch {
      setDashboardActionMessage(providerId, getDashboardActionFailureMessage({
        providerStatus,
        cacheStatus,
        diagnosticsState: devShellDiagnosticsState,
        reason: "refresh_failed",
      }));
    }

    setDashboardReloadNonce((currentNonce) => currentNonce + 1);
    await refreshDevShellDiagnosticsStatus(runtime);
  }

  if (result.state.phase !== "connected") {
    return <SteamOSBootstrapStatus state={result.state} />;
  }

  const connectedState = createInitialConnectedState(result.state);
  const visibleProviderStatuses = resolveVisibleProviderStatuses(
    connectedState.providers,
    devShellDiagnosticsState.snapshot,
  );
  return (
    <main className="steamos-shell" data-steamos-bootstrap-state={connectedState.phase} style={PAGE_STYLE}>
      <style>{STEAMOS_INPUT_READINESS_CSS}</style>
      <header>
        <h1 style={PAGE_TITLE_STYLE}>Achievement Companion</h1>
        <p style={PAGE_SUBTITLE_STYLE}>SteamOS app shell</p>
      </header>
      <section style={STATUS_PANEL_STYLE}>
        <p style={STATUS_MESSAGE_STYLE}>{connectedState.message}</p>
        <p style={STATUS_HINT_STYLE}>
          Save provider credentials locally before dashboard work. Dashboard snapshots stay cached-first and
          only refresh when you ask for them. This shell does not start a Steam scan.
        </p>
      </section>
      <SteamOSAppShellOverview
        state={{
          ...connectedState,
          ...(visibleProviderStatuses !== undefined ? { providers: visibleProviderStatuses } : {}),
        }}
        diagnostics={devShellDiagnosticsState}
        selectedProviderId={selectedDashboardProviderId}
        dashboardMessages={dashboardActionMessages}
        onOpenSetup={(providerId) => {
          setSelectedDashboardProviderId(providerId);
          scrollToSection(STEAMOS_SETUP_SECTION_ID);
        }}
        onOpenDashboard={(providerId) => {
          setSelectedDashboardProviderId(providerId);
          scrollToSection(STEAMOS_DASHBOARD_SECTION_ID);
        }}
        onRefreshDashboard={(providerId) => void handleRefreshDashboard(providerId)}
      />
      <section id={STEAMOS_SETUP_SECTION_ID} style={{ display: "grid", gap: "1rem" }}>
        <div style={SECTION_HEADER_STYLE}>
          <p style={EYEBROW_STYLE}>Setup</p>
          <h2 style={TITLE_STYLE}>Provider setup</h2>
        </div>
        <SteamOSSetupSurface
          {...(connectedState.providerConfigStatus !== undefined
            ? { providerConfigStatus: connectedState.providerConfigStatus }
            : {})}
          {...(visibleProviderStatuses !== undefined
            ? { providerStatuses: visibleProviderStatuses }
            : {})}
          values={values}
          messages={messages}
          {...(busyProviderId !== undefined ? { busyProviderId } : {})}
          onRetroAchievementsUsernameChange={(value) =>
            setValues((currentValues) => ({
              ...currentValues,
              retroAchievements: {
                ...currentValues.retroAchievements,
                username: value,
              },
            }))}
          onRetroAchievementsApiKeyDraftChange={(value) =>
            setValues((currentValues) => ({
              ...currentValues,
              retroAchievements: {
                ...currentValues.retroAchievements,
                apiKeyDraft: value,
              },
            }))}
          onSteamId64Change={(value) =>
            setValues((currentValues) => ({
              ...currentValues,
              steam: {
                ...currentValues.steam,
                steamId64: value,
              },
            }))}
          onSteamApiKeyDraftChange={(value) =>
            setValues((currentValues) => ({
              ...currentValues,
              steam: {
                ...currentValues.steam,
                apiKeyDraft: value,
              },
            }))}
          onSaveRetroAchievements={() => void handleSaveRetroAchievements()}
          onSaveSteam={() => void handleSaveSteam()}
          onClearRetroAchievements={() => void handleClearRetroAchievements()}
          onClearSteam={() => void handleClearSteam()}
        />
      </section>
      <section id={STEAMOS_DASHBOARD_SECTION_ID} style={{ display: "grid", gap: "1rem" }}>
        <div style={SECTION_HEADER_STYLE}>
          <p style={EYEBROW_STYLE}>Dashboard</p>
          <h2 style={TITLE_STYLE}>Cached provider dashboards</h2>
        </div>
        <SteamOSDashboardSurface
          key={`${selectedDashboardProviderId}:${dashboardReloadNonce}`}
          {...(visibleProviderStatuses !== undefined
            ? { providerStatuses: visibleProviderStatuses }
            : {})}
          selectedProviderId={selectedDashboardProviderId}
          onSelectedProviderIdChange={setSelectedDashboardProviderId}
          readCachedSnapshot={async (providerId): Promise<DashboardSnapshot | undefined> =>
            await result.runtime?.adapters.dashboardSnapshotStore?.read(providerId) as DashboardSnapshot | undefined}
          writeCachedSnapshot={async (providerId, snapshot): Promise<void> => {
            await result.runtime?.adapters.dashboardSnapshotStore?.write(providerId, snapshot);
          }}
          refreshDashboard={async (providerId) =>
            await result.runtime?.services.dashboard.loadDashboard(providerId, { forceRefresh: true })
            ?? {
              status: "error",
              isRefreshing: false,
              isStale: false,
            }}
        />
      </section>
      <SteamOSDevShellStatusPanel
        state={devShellDiagnosticsState}
        onRefresh={() => void refreshDevShellDiagnosticsStatus()}
      />
    </main>
  );
}

export async function bootstrapSteamOSShell(
  options: SteamOSBootstrapDependencies = {},
): Promise<SteamOSBootstrapResult> {
  const renderState = options.renderState ?? (() => {});
  const loadBootstrapConfig = options.loadBootstrapConfig ?? loadSteamOSBootstrapConfig;
  const createRuntime = options.createRuntime ?? createSteamOSAppRuntime;

  const loadingState = createBootstrapState("loading");
  renderState(loadingState);

  try {
    const config = await loadBootstrapConfig({
      ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    });
    const runtime = createRuntime(
      config,
      options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl },
    );
    const connectedState = createBootstrapState("connected", await loadProviderStatuses(runtime));
    renderState(connectedState);
    return {
      state: connectedState,
      runtime,
    };
  } catch (error) {
    const errorState = createBootstrapState("error", describeBootstrapFailure(error));
    renderState(errorState);
    return {
      state: errorState,
    };
  }
}

export function mountSteamOSBootstrap(
  options: MountSteamOSBootstrapOptions = {},
): Promise<SteamOSBootstrapResult> {
  const root = createRoot(resolveRootElement(options));
  return new Promise((resolve) => {
    root.render(<SteamOSBootstrapShell {...options} onResolved={resolve} />);
  });
}

export function autoMountSteamOSShell(
  options: AutoMountSteamOSBootstrapOptions = {},
): Promise<SteamOSBootstrapResult> | undefined {
  const resolvedDocument = options.document ?? globalThis.document;
  if (resolvedDocument === undefined) {
    return undefined;
  }

  const resolvedRootElement = options.rootElement ?? resolvedDocument.getElementById("root");
  if (resolvedRootElement === null) {
    return undefined;
  }

  const mount = options.mount ?? mountSteamOSBootstrap;
  const mountPromise = mount({
    ...options,
    document: resolvedDocument,
    rootElement: resolvedRootElement,
  });
  void mountPromise.catch(() => {});
  return mountPromise;
}

void autoMountSteamOSShell();


