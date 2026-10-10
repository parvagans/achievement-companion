import type {
  UpdateInstaller,
  UpdateInstallerResult,
  UpdateManifest,
  VerifiedUpdateArtifact,
} from "../update-types";

interface DeckyLoaderBackend {
  call(route: string, ...args: unknown[]): Promise<unknown>;
}

declare global {
  interface Window {
    DeckyBackend?: DeckyLoaderBackend;
  }
}

const PLUGIN_NAME = "Achievement Companion";
const DECKY_INSTALL_TYPE_UPDATE = 2;

/**
 * Decky does not expose plugin installation through @decky/api. Its own update
 * dialog is available through the loader RPC on supported builds. Hand the
 * already verified ZIP to Decky, and let Decky own confirmation and reloading.
 */
export class DeckyNativeInstaller implements UpdateInstaller {
  constructor(private readonly loaderBackend?: DeckyLoaderBackend) {}

  private get backend(): DeckyLoaderBackend | undefined {
    return this.loaderBackend ?? (typeof window === "undefined" ? undefined : window.DeckyBackend);
  }

  get supported(): boolean {
    return typeof this.backend?.call === "function";
  }

  async install(
    manifest: UpdateManifest,
    artifact: VerifiedUpdateArtifact,
  ): Promise<UpdateInstallerResult> {
    const backend = this.backend;
    if (typeof backend?.call !== "function") {
      return {
        status: "unsupported",
        message: "This Decky Loader version cannot open its plugin update dialog.",
      };
    }
    if (
      artifact.version !== manifest.version
      || artifact.packageVersion !== manifest.version
      || artifact.pluginVersion !== manifest.version
      || artifact.sha256 !== manifest.sha256
      || !artifact.fileUrl.startsWith("file://")
    ) {
      return { status: "failed", message: "The verified update package is invalid. Nothing was installed." };
    }
    await backend.call(
      "utilities/install_plugin",
      artifact.fileUrl,
      PLUGIN_NAME,
      manifest.version,
      artifact.sha256,
      DECKY_INSTALL_TYPE_UPDATE,
    );
    return { status: "prompted" };
  }
}
