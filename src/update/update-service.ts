import { isDevelopmentVersion, isNewerVersion } from "./version-compare";
import type { UpdateSource } from "./update-source";
import type {
  UpdateArtifactVerifier,
  UpdateInstaller,
  UpdateManifest,
  UpdateState,
} from "./update-types";

export interface UpdateServiceDependencies {
  readonly installedVersion: string;
  readonly resolveInstalledVersion?: () => Promise<string>;
  readonly resolveSource: () => UpdateSource;
  readonly verifier: UpdateArtifactVerifier;
  readonly installer: UpdateInstaller;
  readonly onChecked?: (timestamp: number) => Promise<void> | void;
  readonly notifyAvailable?: (manifest: UpdateManifest, force: boolean) => Promise<void> | void;
  readonly now?: () => number;
}

export class UpdateService {
  private readonly listeners = new Set<() => void>();
  private state: UpdateState;

  constructor(private readonly dependencies: UpdateServiceDependencies) {
    this.state = { status: "idle", installedVersion: dependencies.installedVersion };
  }

  getState = (): UpdateState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(state: UpdateState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private stateWithoutMessage(): Omit<UpdateState, "message"> {
    const { message: _message, ...state } = this.state;
    return state;
  }

  async checkForUpdate(options: { readonly manual?: boolean } = {}): Promise<UpdateState> {
    let installedVersion = this.state.installedVersion;
    this.setState({ ...this.stateWithoutMessage(), status: "checking", installedVersion });
    try {
      installedVersion = await this.dependencies.resolveInstalledVersion?.() ?? this.dependencies.installedVersion;
      this.setState({ ...this.stateWithoutMessage(), status: "checking", installedVersion });
      const manifest = await this.dependencies.resolveSource().loadManifest();
      const checkedAt = (this.dependencies.now ?? Date.now)();
      await this.dependencies.onChecked?.(checkedAt);
      if (isNewerVersion(installedVersion, manifest.version)) {
        this.setState({
          status: "updateAvailable",
          installedVersion,
          available: manifest,
          lastCheckedAt: checkedAt,
        });
        await this.dependencies.notifyAvailable?.(manifest, options.manual === true);
      } else {
        this.setState({
          status: "upToDate",
          installedVersion,
          lastCheckedAt: checkedAt,
          message: "Achievement Companion is up to date.",
        });
      }
    } catch (error) {
      this.setState({
        ...this.state,
        status: "error",
        message: error instanceof Error ? error.message : "Update check failed.",
      });
    }
    return this.state;
  }

  async installAvailableUpdate(options: { readonly allowDevelopment?: boolean } = {}): Promise<UpdateState> {
    const manifest = this.state.available;
    if (manifest === undefined) return this.state;
    if (isDevelopmentVersion(this.state.installedVersion) && options.allowDevelopment !== true) {
      this.setState({
        ...this.state,
        status: "unsupported",
        message: "Automatic installation is disabled for development builds.",
      });
      return this.state;
    }
    try {
      const artifact = await this.dependencies.verifier.verify(manifest, (phase) => {
        this.setState({ ...this.stateWithoutMessage(), status: phase });
      });
      if (!this.dependencies.installer.supported) {
        this.setState({
          ...this.state,
          status: "unsupported",
          message: "This Decky Loader version does not expose a supported plugin-install API. The package was downloaded and verified but not installed.",
        });
        return this.state;
      }
      this.setState({ ...this.stateWithoutMessage(), status: "installing" });
      const result = await this.dependencies.installer.install(manifest, artifact);
      if (result.status === "complete") {
        this.setState({ ...this.state, status: "upToDate", message: "Update installed. Decky will reload the plugin." });
      } else if (result.status === "unsupported") {
        this.setState({ ...this.state, status: "unsupported", message: result.message });
      } else if (result.status === "failed") {
        this.setState({ ...this.state, status: "error", message: result.message });
      }
    } catch (error) {
      this.setState({
        ...this.state,
        status: "error",
        message: error instanceof Error ? error.message : "Update verification failed. The package was not installed.",
      });
    }
    return this.state;
  }
}
