import type { AppError } from "./errors";
import type { UnixEpochMs } from "./domain";

export interface CachePolicy {
  readonly ttlMs: number;
  readonly staleWhileRevalidateMs?: number;
  readonly version: number;
}

export interface CacheEntry<T> {
  readonly key: string;
  readonly value: T;
  readonly storedAt: UnixEpochMs;
  readonly expiresAt: UnixEpochMs;
  readonly version: number;
}

export interface CacheStore {
  read<T>(key: string): Promise<CacheEntry<T> | undefined>;
  write<T>(entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(prefix?: string): Promise<void>;
}

export type ResourceStatus = "idle" | "loading" | "refreshing" | "success" | "stale" | "error";

export interface ResourceState<T> {
  readonly status: ResourceStatus;
  readonly data?: T;
  readonly error?: AppError;
  readonly lastUpdatedAt?: UnixEpochMs;
  readonly isStale: boolean;
  readonly isRefreshing: boolean;
}
