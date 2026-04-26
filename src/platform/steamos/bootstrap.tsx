import { useEffect, useState, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DashboardSnapshot } from "@core/domain";
import { createSteamOSAppRuntime, type SteamOSAppRuntimeOptions } from "./create-steamos-app-runtime";
import {
  loadSteamOSBootstrapConfig,
  type SteamOSRuntimeBootstrapOptions,
} from "./runtime-bootstrap";
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
import { SteamOSDashboardSurface } from "./dashboard-surface";

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
  maxWidth: "760px",
  margin: "0 auto",
  padding: "2rem 1rem 3rem",
  display: "grid",
  gap: "1rem",
  color: "#0f172a",
  fontFamily: "\"Segoe UI\", system-ui, sans-serif",
};

const PAGE_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1.9rem",
  lineHeight: 1.1,
};

const PAGE_SUBTITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  color: "#475569",
};

const STATUS_PANEL_STYLE: CSSProperties = {
  border: "1px solid #d7dde5",
  borderRadius: "16px",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  padding: "1rem 1.1rem",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: "0.6rem",
};

const STATUS_MESSAGE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 600,
};

const STATUS_HINT_STYLE: CSSProperties = {
  margin: 0,
  color: "#5f6b7a",
  lineHeight: 1.5,
};

function createBootstrapState(
  phase: SteamOSBootstrapPhase,
  providerState?: Pick<SteamOSBootstrapState, "providerConfigStatus" | "providerConfigs" | "providers">,
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
    <main data-steamos-bootstrap-state={state.phase} style={PAGE_STYLE}>
      <header>
        <h1 style={PAGE_TITLE_STYLE}>Achievement Companion</h1>
        <p style={PAGE_SUBTITLE_STYLE}>SteamOS dev shell</p>
      </header>
      <section style={STATUS_PANEL_STYLE}>
        <p style={STATUS_MESSAGE_STYLE}>{state.message}</p>
        <p style={STATUS_HINT_STYLE}>
          This shell only bootstraps local backend access and provider setup. It does not validate live provider
          connectivity yet.
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
  const [values, setValues] = useState<SteamOSSetupFormValues>(createSteamOSSetupFormValues());
  const [messages, setMessages] = useState<SteamOSSetupSurfaceMessages>({});
  const [busyProviderId, setBusyProviderId] = useState<typeof RETROACHIEVEMENTS_PROVIDER_ID | typeof STEAM_PROVIDER_ID>();

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

  if (result.state.phase !== "connected") {
    return <SteamOSBootstrapStatus state={result.state} />;
  }

  const connectedState = createInitialConnectedState(result.state);
  return (
    <main data-steamos-bootstrap-state={connectedState.phase} style={PAGE_STYLE}>
      <header>
        <h1 style={PAGE_TITLE_STYLE}>Achievement Companion</h1>
        <p style={PAGE_SUBTITLE_STYLE}>SteamOS dev shell</p>
      </header>
      <section style={STATUS_PANEL_STYLE}>
        <p style={STATUS_MESSAGE_STYLE}>{connectedState.message}</p>
        <p style={STATUS_HINT_STYLE}>
          Save provider credentials locally before dashboard work. Dashboard snapshots stay cached-first and
          only refresh when you ask for them. This shell does not start a Steam scan.
        </p>
      </section>
      <SteamOSSetupSurface
        {...(connectedState.providerConfigStatus !== undefined
          ? { providerConfigStatus: connectedState.providerConfigStatus }
          : {})}
        {...(connectedState.providers !== undefined
          ? { providerStatuses: connectedState.providers }
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
      <SteamOSDashboardSurface
        {...(connectedState.providers !== undefined
          ? { providerStatuses: connectedState.providers }
          : {})}
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
