import type { UnixEpochMs } from "@core/domain";

const PROFILE_AVATAR_CACHE_BUST_PARAM = "ac_avatar_refresh";

export function addProfileAvatarCacheBustParam(
  avatarUrl: string | undefined,
  refreshedAt: UnixEpochMs | undefined,
): string | undefined {
  if (avatarUrl === undefined) {
    return undefined;
  }

  const trimmed = avatarUrl.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (refreshedAt === undefined || !Number.isFinite(refreshedAt)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    url.searchParams.set(PROFILE_AVATAR_CACHE_BUST_PARAM, String(Math.trunc(refreshedAt)));
    return url.toString();
  } catch {
    return trimmed;
  }
}
