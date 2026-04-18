import type { CacheEntry } from "@core/cache";
import { CACHE_VERSION, createProviderDashboardCacheKey } from "@core/cache-keys";
import type { DashboardSnapshot } from "@core/domain";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";

export type DeckySmokeTestCacheMode = "empty" | "fresh" | "stale";

const SMOKE_TEST_CACHE_KEY = createProviderDashboardCacheKey(RETROACHIEVEMENTS_PROVIDER_ID);
// Smoke-test-only assumption: these fixed timestamps make fresh/stale cache behavior deterministic across runs.
const SMOKE_TEST_STORED_AT = 1_700_000_000_000;
const SMOKE_TEST_FRESH_EXPIRES_AT = 4_102_444_800_000;
const SMOKE_TEST_STALE_EXPIRES_AT = 1_700_000_000_001;

// Smoke-test-only assumption: this is a normalized dashboard snapshot, not provider payload data.
function createSmokeTestDashboardSnapshot(): DashboardSnapshot {
  return {
    profile: {
      providerId: RETROACHIEVEMENTS_PROVIDER_ID,
      identity: {
        providerId: RETROACHIEVEMENTS_PROVIDER_ID,
        accountId: "smoke-test",
        displayName: "Smoke Test User",
      },
      summary: {
        unlockedCount: 0,
      },
      metrics: [],
      refreshedAt: SMOKE_TEST_STORED_AT,
    },
    recentAchievements: [],
    recentlyPlayedGames: [],
    recentUnlocks: [],
    featuredGames: [],
    refreshedAt: SMOKE_TEST_STORED_AT,
  };
}

function createSmokeTestDashboardCacheEntry(expiresAt: number): CacheEntry<DashboardSnapshot> {
  return {
    key: SMOKE_TEST_CACHE_KEY,
    value: createSmokeTestDashboardSnapshot(),
    storedAt: SMOKE_TEST_STORED_AT,
    expiresAt,
    version: CACHE_VERSION,
  };
}

export function createDeckySmokeTestDashboardCacheEntries(
  mode: DeckySmokeTestCacheMode,
): readonly CacheEntry<DashboardSnapshot>[] {
  switch (mode) {
    case "fresh":
      return [createSmokeTestDashboardCacheEntry(SMOKE_TEST_FRESH_EXPIRES_AT)];
    case "stale":
      return [createSmokeTestDashboardCacheEntry(SMOKE_TEST_STALE_EXPIRES_AT)];
    case "empty":
    default:
      return [];
  }
}
