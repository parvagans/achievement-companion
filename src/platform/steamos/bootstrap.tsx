import { createRoot, type Root } from "react-dom/client";
import { createSteamOSAppRuntime, type SteamOSAppRuntimeOptions } from "./create-steamos-app-runtime";
import {
  loadSteamOSBootstrapConfig,
  type SteamOSRuntimeBootstrapOptions,
} from "./runtime-bootstrap";
import type { SteamOSLocalBackendClientConfig } from "./runtime-metadata";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements/config";
import { STEAM_PROVIDER_ID } from "../../providers/steam/config";

export type SteamOSBootstrapPhase = "loading" | "connected" | "error";
export type SteamOSProviderConfigStatus = "configured" | "not_configured" | "unavailable";

export interface SteamOSProviderStatus {
  readonly label: string;
  readonly status: SteamOSProviderConfigStatus;
}

export interface SteamOSBootstrapState {
  readonly phase: SteamOSBootstrapPhase;
  readonly message: string;
  readonly providerConfigStatus?: "loaded" | "unavailable";
  readonly providers?: {
    readonly retroAchievements: SteamOSProviderStatus;
    readonly steam: SteamOSProviderStatus;
  };
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

function createBootstrapState(
  phase: SteamOSBootstrapPhase,
  providerState?: Pick<SteamOSBootstrapState, "providerConfigStatus" | "providers">,
): SteamOSBootstrapState {
  if (phase === "connected") {
    return {
      phase,
      message: "Connected to SteamOS backend",
      ...providerState,
    };
  }

  if (phase === "error") {
    return {
      phase,
      message: "SteamOS backend unavailable",
    };
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

async function loadProviderStatuses(
  runtime: ReturnType<typeof createSteamOSAppRuntime>,
): Promise<Pick<SteamOSBootstrapState, "providerConfigStatus" | "providers">> {
  const providerConfigStore = runtime.adapters.providerConfigStore;
  if (providerConfigStore === undefined) {
    return {
      providerConfigStatus: "unavailable",
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

    return {
      providerConfigStatus: "loaded",
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

  if (status === "unavailable") {
    return "unavailable";
  }

  return "not configured";
}

function renderBootstrapState(root: Root, state: SteamOSBootstrapState): void {
  root.render(<SteamOSBootstrapStatus state={state} />);
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
    <main data-steamos-bootstrap-state={state.phase}>
      <h1>Achievement Companion</h1>
      <p>SteamOS dev shell</p>
      <p>{state.message}</p>
      {state.providerConfigStatus === "unavailable" ? (
        <p>Provider config unavailable</p>
      ) : null}
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
  } catch {
    const errorState = createBootstrapState("error");
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
  return bootstrapSteamOSShell({
    ...options,
    renderState: (state) => renderBootstrapState(root, state),
  });
}
