import type { RetroAchievementsSubsetDiscoveryStatus } from "../../providers/retroachievements/retroachievements.provider";

export function buildSubsetDiscoveryPanel(status: RetroAchievementsSubsetDiscoveryStatus | undefined, now = Date.now()) {
  if (status === undefined || (status.complete && status.checkpointSaved)) return undefined;
  const deferred = status.retryAt !== undefined && now < status.retryAt;
  const label = !status.checkpointSaved ? "Progress could not be saved" : status.running ? "Checking catalogue" :
    deferred ? status.failureCategory === "rate_limit" ? "Waiting for RetroAchievements cooldown" : "Verification deferred; try again later" :
      status.failureCategory === "invalid_metadata" ? "Some metadata could not be verified" : "Catalogue discovery";
  return { label, disabled: status.running || deferred, action: status.running ? "Checking…" : status.failureCategory !== undefined ? "Retry discovery" : "Continue discovery",
    progress: `${status.verified} / ${status.total} verified${status.unsupported ? ` · ${status.unsupported} unavailable` : ""}`,
    percent: status.total > 0 ? 100 * (status.verified + status.unsupported) / status.total : 0 };
}
