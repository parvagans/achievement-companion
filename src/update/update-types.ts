export const UPDATE_MANIFEST_SCHEMA = 1 as const;

export type UpdateChannel = "stable" | "preview";

export interface UpdateManifest {
  readonly schema: typeof UPDATE_MANIFEST_SCHEMA;
  readonly version: string;
  readonly channel: UpdateChannel;
  readonly downloadUrl: string;
  readonly sha256: string;
  readonly releaseNotes?: string;
  readonly minDeckyVersion?: string;
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "updateAvailable"
  | "downloading"
  | "verifying"
  | "installing"
  | "error"
  | "unsupported";

export interface UpdateState {
  readonly status: UpdateStatus;
  readonly installedVersion: string;
  readonly available?: UpdateManifest;
  readonly lastCheckedAt?: number;
  readonly message?: string;
}

export interface VerifiedUpdateArtifact {
  readonly version: string;
  readonly sha256: string;
  readonly packageVersion: string;
  readonly pluginVersion: string;
  readonly fileUrl: string;
}

export interface UpdateArtifactVerifier {
  verify(
    manifest: UpdateManifest,
    onPhase: (phase: "downloading" | "verifying") => void,
  ): Promise<VerifiedUpdateArtifact>;
}

export type UpdateInstallerResult =
  | { readonly status: "unsupported"; readonly message: string }
  | { readonly status: "prompted" }
  | { readonly status: "complete" }
  | { readonly status: "failed"; readonly message: string };

export interface UpdateInstaller {
  readonly supported: boolean;
  install(manifest: UpdateManifest, artifact: VerifiedUpdateArtifact): Promise<UpdateInstallerResult>;
}
