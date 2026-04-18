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

export type NavigationView =
  | "setup"
  | "overview"
  | "profile"
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
