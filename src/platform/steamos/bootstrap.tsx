import { createRoot, type Root } from "react-dom/client";
import { createSteamOSAppRuntime, type SteamOSAppRuntimeOptions } from "./create-steamos-app-runtime";
import {
  loadSteamOSBootstrapConfig,
  type SteamOSRuntimeBootstrapOptions,
} from "./runtime-bootstrap";
import type { SteamOSLocalBackendClientConfig } from "./runtime-metadata";

export type SteamOSBootstrapPhase = "loading" | "connected" | "error";

export interface SteamOSBootstrapState {
  readonly phase: SteamOSBootstrapPhase;
  readonly message: string;
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

function createBootstrapState(phase: SteamOSBootstrapPhase): SteamOSBootstrapState {
  if (phase === "connected") {
    return {
      phase,
      message: "Connected to SteamOS backend",
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
      <p>{state.message}</p>
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
    const connectedState = createBootstrapState("connected");
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
