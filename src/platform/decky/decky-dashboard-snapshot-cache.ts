import type { ResourceState } from "@core/cache";
import type { DashboardSnapshot, ProviderId } from "@core/domain";
import type { DashboardSnapshotStore } from "@core/platform";
import {
  readDeckyStorageText,
  removeDeckyStorageText,
  writeDeckyStorageText,
} from "./storage";

const DASHBOARD_SNAPSHOT_STORAGE_KEY_PREFIX =
  "achievement-companion:decky:dashboard-snapshot:v1:";

interface DeckyDashboardSnapshotCacheEntry {
  readonly version: 1;
  readonly providerId: ProviderId;
  readonly storedAt: number;
  readonly snapshot: DashboardSnapshot;
}

function getDashboardSnapshotStorageKey(providerId: ProviderId): string {
  return `${DASHBOARD_SNAPSHOT_STORAGE_KEY_PREFIX}${providerId}`;
}

export const deckyDashboardSnapshotStore: DashboardSnapshotStore<DashboardSnapshot> = {
  async read(providerId) {
    return readDeckyDashboardSnapshotCacheEntry(providerId)?.snapshot;
  },
  async write(_providerId, snapshot) {
    writeDeckyDashboardSnapshot(snapshot);
  },
  async clear(providerId) {
    return clearDeckyDashboardSnapshot(providerId);
  },
};

function isDashboardSnapshotCacheEntry(value: unknown): value is DeckyDashboardSnapshotCacheEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record["version"] === 1 &&
    typeof record["providerId"] === "string" &&
    typeof record["storedAt"] === "number" &&
    typeof record["snapshot"] === "object" &&
    record["snapshot"] !== null
  );
}

export function readDeckyDashboardSnapshotCacheEntry(
  providerId: ProviderId,
): DeckyDashboardSnapshotCacheEntry | undefined {
  const rawValue = readDeckyStorageText(getDashboardSnapshotStorageKey(providerId));
  if (rawValue === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isDashboardSnapshotCacheEntry(parsed) || parsed.providerId !== providerId) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

export function readDeckyDashboardSnapshotState(
  providerId: ProviderId,
): ResourceState<DashboardSnapshot> | undefined {
  const entry = readDeckyDashboardSnapshotCacheEntry(providerId);
  if (entry === undefined) {
    return undefined;
  }

  return {
    status: "stale",
    data: entry.snapshot,
    lastUpdatedAt: entry.storedAt,
    isStale: true,
    isRefreshing: false,
  };
}

export function writeDeckyDashboardSnapshot(snapshot: DashboardSnapshot): boolean {
  const entry: DeckyDashboardSnapshotCacheEntry = {
    version: 1,
    providerId: snapshot.profile.providerId,
    storedAt: Date.now(),
    snapshot,
  };

  const didWrite = writeDeckyStorageText(
    getDashboardSnapshotStorageKey(snapshot.profile.providerId),
    JSON.stringify(entry),
  );

  if (!didWrite) {
    removeDeckyStorageText(getDashboardSnapshotStorageKey(snapshot.profile.providerId));
  }

  return didWrite;
}

export function clearDeckyDashboardSnapshot(providerId: ProviderId): boolean {
  return removeDeckyStorageText(getDashboardSnapshotStorageKey(providerId));
}
