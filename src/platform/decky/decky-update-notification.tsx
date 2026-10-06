import { toaster } from "@decky/api";
import type { UpdateManifest } from "../../update/update-types";

export function showDeckyUpdateNotification(
  manifest: UpdateManifest,
  onClick: () => void,
): void {
  toaster.toast({
    title: "Achievement Companion",
    body: `Update ${manifest.version} is available.`,
    subtext: "Open Updates",
    onClick,
    duration: 8_000,
    playSound: true,
    showToast: true,
  });
}
