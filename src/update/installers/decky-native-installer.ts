import type {
  UpdateInstaller,
  UpdateInstallerResult,
  UpdateManifest,
  VerifiedUpdateArtifact,
} from "../update-types";

/**
 * @decky/api 1.1.3 has no public plugin-install API. Keep this adapter capability-gated
 * until Decky publishes one; never fall back to loader internals or live-directory replacement.
 */
export class DeckyNativeInstaller implements UpdateInstaller {
  readonly supported = false;

  async install(
    _manifest: UpdateManifest,
    _artifact: VerifiedUpdateArtifact,
  ): Promise<UpdateInstallerResult> {
    return {
      status: "unsupported",
      message: "Decky Loader does not currently expose a supported plugin-install API.",
    };
  }
}
