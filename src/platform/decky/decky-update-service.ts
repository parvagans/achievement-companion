import { fetchNoCors } from "@decky/api";
import { useSyncExternalStore } from "react";
import { APP_VERSION } from "../../generated/version";
import { DeckyNativeInstaller } from "../../update/installers/decky-native-installer";
import { LocalUpdateSource, ProductionUpdateSource, type UpdateSource } from "../../update/update-source";
import { UpdateService } from "../../update/update-service";
import { shouldNotifyUpdate } from "../../update/update-notification";
import type { UpdateArtifactVerifier, UpdateManifest, UpdateState } from "../../update/update-types";
import { callDeckyBackendMethod } from "./decky-backend-bridge";
import { readDeckySettings, saveDeckySettings } from "./decky-settings";
import { isDeckyDeveloperUpdateModeEnabled } from "./decky-update-developer-mode";
import { showDeckyUpdateNotification } from "./decky-update-notification";

export const PRODUCTION_UPDATE_MANIFEST_URL =
  "https://github.com/parvagans/achievement-companion/releases/latest/download/update-manifest.json";
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const UPDATE_STARTUP_DELAY_MS = 30_000;

let openUpdatesView: (() => void) | undefined;
let startupTimer: ReturnType<typeof setTimeout> | undefined;
let periodicTimer: ReturnType<typeof setInterval> | undefined;

const verifier: UpdateArtifactVerifier = {
  async verify(manifest, onPhase) {
    onPhase("downloading");
    const result = await callDeckyBackendMethod<{
      readonly version: string;
      readonly sha256: string;
      readonly packageVersion: string;
      readonly pluginVersion: string;
    }>("prepare_update_artifact", {
      version: manifest.version,
      downloadUrl: manifest.downloadUrl,
      sha256: manifest.sha256,
    });
    onPhase("verifying");
    if (
      result.version !== manifest.version
      || result.packageVersion !== manifest.version
      || result.pluginVersion !== manifest.version
      || result.sha256 !== manifest.sha256
    ) {
      throw new Error("Update verification failed. The downloaded package was not installed.");
    }
    return result;
  },
};

function resolveSource(): UpdateSource {
  const settings = readDeckySettings();
  if (
    settings.updateSource === "local"
    && isDeckyDeveloperUpdateModeEnabled()
    && settings.localUpdateManifestUrl.length > 0
  ) {
    return new LocalUpdateSource(settings.localUpdateManifestUrl, { fetch: fetchNoCors });
  }
  return new ProductionUpdateSource(PRODUCTION_UPDATE_MANIFEST_URL, { fetch: fetchNoCors });
}

async function persistCheckedAt(timestamp: number): Promise<void> {
  await saveDeckySettings({ ...readDeckySettings(), lastUpdateCheckedAt: timestamp });
}

async function notifyAvailable(manifest: UpdateManifest, force: boolean): Promise<void> {
  const settings = readDeckySettings();
  if (!shouldNotifyUpdate(settings.lastNotifiedUpdateVersion, manifest.version, force)) return;
  showDeckyUpdateNotification(manifest, () => openUpdatesView?.());
  await saveDeckySettings({ ...settings, lastNotifiedUpdateVersion: manifest.version });
}

export const deckyUpdateService = new UpdateService({
  installedVersion: APP_VERSION,
  resolveSource,
  verifier,
  installer: new DeckyNativeInstaller(),
  onChecked: persistCheckedAt,
  notifyAvailable,
});

function shouldRunAutomaticCheck(now = Date.now()): boolean {
  const settings = readDeckySettings();
  return settings.automaticUpdateChecks
    && settings.updateSource === "production"
    && (settings.lastUpdateCheckedAt === undefined
      || now - settings.lastUpdateCheckedAt >= UPDATE_CHECK_INTERVAL_MS);
}

function runAutomaticCheckIfDue(): void {
  if (shouldRunAutomaticCheck()) void deckyUpdateService.checkForUpdate();
}

export function initializeDeckyUpdateSystem(onOpenUpdatesView: () => void): () => void {
  openUpdatesView = onOpenUpdatesView;
  startupTimer = setTimeout(runAutomaticCheckIfDue, UPDATE_STARTUP_DELAY_MS);
  periodicTimer = setInterval(runAutomaticCheckIfDue, 60 * 60 * 1_000);
  return () => {
    if (startupTimer !== undefined) clearTimeout(startupTimer);
    if (periodicTimer !== undefined) clearInterval(periodicTimer);
    startupTimer = undefined;
    periodicTimer = undefined;
    openUpdatesView = undefined;
  };
}

export function useDeckyUpdateState(): UpdateState {
  return useSyncExternalStore(
    deckyUpdateService.subscribe,
    deckyUpdateService.getState,
    deckyUpdateService.getState,
  );
}

export async function checkForDeckyUpdateManually(): Promise<UpdateState> {
  return deckyUpdateService.checkForUpdate({ manual: true });
}

export async function verifyAndInstallDeckyUpdate(): Promise<UpdateState> {
  return deckyUpdateService.installAvailableUpdate({
    allowDevelopment: isDeckyDeveloperUpdateModeEnabled(),
  });
}
