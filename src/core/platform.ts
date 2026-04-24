import type { ProviderId } from "./domain";

export type PlatformId = "decky" | "desktop" | "mobile";

export interface PlatformInfo {
  readonly platformId: PlatformId;
  readonly appName: string;
  readonly buildVersion?: string;
}

export interface KeyValueStore {
  read(key: string): Promise<string | undefined>;
  write(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface SecretStore extends KeyValueStore {}

export interface DiagnosticLogger {
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

export interface ProviderConfigStore<Config = unknown> {
  load(providerId: ProviderId): Promise<Config | undefined>;
  save(providerId: ProviderId, config: Config): Promise<Config | undefined>;
  clear(providerId: ProviderId): Promise<boolean>;
}

export interface AuthenticatedProviderTransportFactory<Transport = unknown> {
  create(providerId: ProviderId): Transport;
}

export interface DashboardSnapshotStore<Snapshot = unknown> {
  read(providerId: ProviderId): Promise<Snapshot | undefined>;
  write(providerId: ProviderId, snapshot: Snapshot): Promise<void>;
  clear(providerId: ProviderId): Promise<boolean>;
}

export interface SteamLibraryScanStore<Overview = unknown, Summary = unknown> {
  readOverview(providerId: ProviderId): Promise<Overview | undefined>;
  writeOverview(providerId: ProviderId, overview: Overview): Promise<void>;
  readSummary(providerId: ProviderId): Promise<Summary | undefined>;
  writeSummary(providerId: ProviderId, summary: Summary): Promise<void>;
  clear(providerId: ProviderId): Promise<boolean>;
}

export interface PlatformCapabilities {
  readonly supportsCompactNavigation: boolean;
  readonly supportsFullscreenNavigation: boolean;
  readonly supportsPersistentSettings: boolean;
  readonly supportsSecretStorage: boolean;
  readonly supportsAuthenticatedProviderTransport: boolean;
  readonly supportsDiagnosticLogging: boolean;
  readonly supportsSteamLibraryScan: boolean;
}

export type NavigationView =
  | "setup"
  | "overview"
  | "profile"
  | "badges"
  | "achievement-history"
  | "completion-progress"
  | "game"
  | "achievement"
  | "settings";
export type NavigationSurface = "side-panel" | "full-screen";

export interface NavigationTarget {
  readonly view: NavigationView;
  readonly providerId?: ProviderId;
  readonly gameId?: string;
  readonly achievementId?: string;
  readonly surface?: NavigationSurface;
}

export interface NavigationPort {
  go(target: NavigationTarget): Promise<void> | void;
  back(): Promise<void> | void;
}

export interface PlatformServices {
  readonly info: PlatformInfo;
  readonly settingsStore?: KeyValueStore;
  readonly secretStore?: SecretStore;
  readonly navigation?: NavigationPort;
}
