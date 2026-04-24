import type {
  AuthenticatedProviderTransportFactory,
  DashboardSnapshotStore,
  DiagnosticLogger,
  PlatformCapabilities,
  PlatformServices,
  ProviderConfigStore,
  SteamLibraryScanStore,
} from "./platform";
import type { ProviderRegistry } from "./ports";
import { createAppServices, type AppServiceBootstrapOptions } from "./app-services";
import type { AppServices } from "./services";

export interface AppRuntimeAdapters<
  DiagnosticPayload extends object = Record<string, unknown>,
  ProviderConfig = unknown,
  Transport = unknown,
  Snapshot = unknown,
  Overview = unknown,
  Summary = unknown,
> {
  readonly diagnosticLogger?: DiagnosticLogger<DiagnosticPayload>;
  readonly providerConfigStore?: ProviderConfigStore<ProviderConfig>;
  readonly authenticatedProviderTransportFactory?: AuthenticatedProviderTransportFactory<Transport>;
  readonly dashboardSnapshotStore?: DashboardSnapshotStore<Snapshot>;
  readonly steamLibraryScanStore?: SteamLibraryScanStore<Overview, Summary>;
  readonly platformCapabilities?: PlatformCapabilities;
}

export interface AppRuntimeOptions<
  DiagnosticPayload extends object = Record<string, unknown>,
  ProviderConfig = unknown,
  Transport = unknown,
  Snapshot = unknown,
  Overview = unknown,
  Summary = unknown,
> extends AppServiceBootstrapOptions {
  readonly adapters?: AppRuntimeAdapters<
    DiagnosticPayload,
    ProviderConfig,
    Transport,
    Snapshot,
    Overview,
    Summary
  >;
}

export interface AppRuntime<
  DiagnosticPayload extends object = Record<string, unknown>,
  ProviderConfig = unknown,
  Transport = unknown,
  Snapshot = unknown,
  Overview = unknown,
  Summary = unknown,
> {
  readonly services: AppServices;
  readonly providerRegistry: ProviderRegistry;
  readonly platform: PlatformServices;
  readonly adapters: AppRuntimeAdapters<
    DiagnosticPayload,
    ProviderConfig,
    Transport,
    Snapshot,
    Overview,
    Summary
  >;
}

export function createAppRuntime<
  DiagnosticPayload extends object = Record<string, unknown>,
  ProviderConfig = unknown,
  Transport = unknown,
  Snapshot = unknown,
  Overview = unknown,
  Summary = unknown,
>(options: AppRuntimeOptions<DiagnosticPayload, ProviderConfig, Transport, Snapshot, Overview, Summary>): AppRuntime<
  DiagnosticPayload,
  ProviderConfig,
  Transport,
  Snapshot,
  Overview,
  Summary
> {
  return {
    services: createAppServices(options),
    providerRegistry: options.providerRegistry,
    platform: options.platform,
    adapters: options.adapters ?? {},
  };
}
