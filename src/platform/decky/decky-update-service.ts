import { fetchNoCors } from "@decky/api";
import { useSyncExternalStore } from "react";
import { APP_VERSION } from "../../generated/version";
import { DeckyNativeInstaller } from "../../update/installers/decky-native-installer";
import { LocalUpdateSource, type UpdateSource } from "../../update/update-source";
import { parseUpdateManifest } from "../../update/update-manifest";
import { UpdateService } from "../../update/update-service";
import { AutomaticUpdateChecks, UPDATE_CHECK_INTERVAL_MS } from "../../update/automatic-update-checks";
import { shouldNotifyUpdate } from "../../update/update-notification";
import type { UpdateArtifactVerifier, UpdateManifest, UpdateState } from "../../update/update-types";
import { callDeckyBackendMethod } from "./decky-backend-bridge";
import { readDeckySettings, saveDeckySettings } from "./decky-settings";
import { isDeckyDeveloperUpdateModeEnabled } from "./decky-update-developer-mode";
import { showDeckyUpdateNotification } from "./decky-update-notification";

export const PRODUCTION_UPDATE_MANIFEST_URL =
  "https://github.com/parvagans/achievement-companion/releases/latest/download/update-manifest.json";
export { UPDATE_CHECK_INTERVAL_MS };
export const UPDATE_STARTUP_DELAY_MS = 30_000;

let openUpdatesView: (() => void) | undefined;

interface SteamConnectivityTest {
  readonly eConnectivityTestResult: number;
  readonly bChecking: boolean;
}

interface SteamNetworkRuntime {
  readonly SteamClient?: {
    readonly System?: {
      readonly Network?: {
        RegisterForConnectivityTestChanges(callback: (test: SteamConnectivityTest) => void): { unregister(): void };
      };
    };
  };
}

const verifier: UpdateArtifactVerifier = {
  async verify(manifest, onPhase) {
    onPhase("downloading");
    const result = await callDeckyBackendMethod<{
      readonly version: string;
      readonly sha256: string;
      readonly packageVersion: string;
      readonly pluginVersion: string;
      readonly fileUrl: string;
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
      || !result.fileUrl.startsWith("file://")
    ) {
      throw new Error("Update verification failed. The downloaded package was not installed.");
    }
    return result;
  },
};

async function resolveDeckyInstalledVersion(): Promise<string> {
  const installedVersion = await callDeckyBackendMethod<string>("get_plugin_version");
  if (installedVersion !== APP_VERSION) {
    console.debug("[Achievement Companion][Updater] Development deployment version mismatch", {
      installedDeckyPackageVersion: installedVersion,
      loadedFrontendBuildVersion: APP_VERSION,
      developmentDeployment: true,
    });
  }
  return installedVersion;
}

function resolveSource(): UpdateSource {
  const settings = readDeckySettings();
  if (
    settings.updateSource === "local"
    && isDeckyDeveloperUpdateModeEnabled()
    && settings.localUpdateManifestUrl.length > 0
  ) {
    return new LocalUpdateSource(settings.localUpdateManifestUrl, { fetch: fetchNoCors });
  }
  return {
    kind: "production",
    manifestUrl: PRODUCTION_UPDATE_MANIFEST_URL,
    async loadManifest() {
      const payload = await callDeckyBackendMethod<unknown>("fetch_update_manifest");
      return parseUpdateManifest(payload, PRODUCTION_UPDATE_MANIFEST_URL);
    },
  };
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
  resolveInstalledVersion: resolveDeckyInstalledVersion,
  resolveSource,
  verifier,
  installer: new DeckyNativeInstaller(),
  onChecked: persistCheckedAt,
  notifyAvailable,
});

export function initializeDeckyUpdateSystem(onOpenUpdatesView: () => void): () => void {
  openUpdatesView = onOpenUpdatesView;
  const checks = new AutomaticUpdateChecks(
    () => {
      const settings = readDeckySettings();
      const status = deckyUpdateService.getState().status;
      return {
        enabled: settings.automaticUpdateChecks,
        productionSource: settings.updateSource === "production",
        ...(settings.lastUpdateCheckedAt !== undefined ? { lastCheckedAt: settings.lastUpdateCheckedAt } : {}),
        busy: status === "checking" || status === "downloading" || status === "verifying" || status === "installing",
      };
    },
    () => deckyUpdateService.checkForUpdate(),
  );
  if (navigator.onLine === false) checks.observeBrowserOffline();
  let connectivitySubscription: { unregister(): void } | undefined;
  const onOnline = () => {
    if (connectivitySubscription === undefined) checks.observeBrowserOnline();
  };
  const onOffline = () => checks.observeBrowserOffline();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  const network = (window as unknown as SteamNetworkRuntime).SteamClient?.System?.Network;
  try {
    connectivitySubscription = network?.RegisterForConnectivityTestChanges((test) => {
      checks.observeSteamConnectivity(test.eConnectivityTestResult, test.bChecking);
    });
  } catch (error) {
    console.debug("[Achievement Companion][Updater] Steam connectivity listener unavailable", error);
  }
  const startupTimer = setTimeout(() => checks.checkIfDue(), UPDATE_STARTUP_DELAY_MS);
  const periodicTimer = setInterval(() => checks.checkIfDue(), 60 * 60 * 1_000);
  return () => {
    clearTimeout(startupTimer);
    clearInterval(periodicTimer);
    connectivitySubscription?.unregister();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
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
