import type { SteamBadgeSummary } from "@core/domain";
import type { RawSteamBadge, RawSteamGetBadgesResponse } from "./raw-types";

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  return undefined;
}

function normalizeBadgeCompletionTime(value: unknown): string | undefined {
  const completionTime = coerceNumber(value);
  if (completionTime === undefined || completionTime <= 0) {
    return undefined;
  }

  return new Date(completionTime * 1000).toISOString();
}

function normalizeSteamBadge(badge: RawSteamBadge): SteamBadgeSummary | undefined {
  const badgeId =
    coerceString(badge.badgeid) ??
    coerceString(badge.badge_id) ??
    coerceString(badge.appid) ??
    coerceString(badge.level) ??
    coerceString(badge.xp);

  if (badgeId === undefined) {
    const fallbackId = coerceNumber(badge.badgeid) ?? coerceNumber(badge.badge_id);
    if (fallbackId === undefined) {
      return undefined;
    }

    return {
      badgeId: String(fallbackId),
      ...(typeof badge.appid === "number" && Number.isFinite(badge.appid) ? { appId: Math.trunc(badge.appid) } : {}),
      ...(typeof badge.level === "number" && Number.isFinite(badge.level) ? { level: Math.trunc(badge.level) } : {}),
      ...(typeof badge.xp === "number" && Number.isFinite(badge.xp) ? { xp: Math.trunc(badge.xp) } : {}),
      ...(typeof badge.scarcity === "number" && Number.isFinite(badge.scarcity)
        ? { scarcity: Math.trunc(badge.scarcity) }
        : {}),
      ...(() => {
        const completedAt = normalizeBadgeCompletionTime(badge.completion_time);
        return completedAt !== undefined ? { completedAt } : {};
      })(),
    };
  }

  return {
    badgeId,
    ...(typeof badge.appid === "number" && Number.isFinite(badge.appid) ? { appId: Math.trunc(badge.appid) } : {}),
    ...(typeof badge.level === "number" && Number.isFinite(badge.level) ? { level: Math.trunc(badge.level) } : {}),
    ...(typeof badge.xp === "number" && Number.isFinite(badge.xp) ? { xp: Math.trunc(badge.xp) } : {}),
    ...(typeof badge.scarcity === "number" && Number.isFinite(badge.scarcity)
      ? { scarcity: Math.trunc(badge.scarcity) }
      : {}),
    ...(() => {
      const completedAt = normalizeBadgeCompletionTime(badge.completion_time);
      return completedAt !== undefined ? { completedAt } : {};
    })(),
  };
}

export function normalizeSteamBadges(
  response: RawSteamGetBadgesResponse,
): {
  readonly badgeCount?: number;
  readonly playerXp?: number;
  readonly steamBadges?: readonly SteamBadgeSummary[];
} {
  const badges = response.response?.badges;
  const badgeCount = Array.isArray(badges) ? badges.length : undefined;
  const playerXp =
    typeof response.response?.player_xp === "number" && Number.isFinite(response.response.player_xp)
      ? Math.trunc(response.response.player_xp)
      : undefined;
  const steamBadges = Array.isArray(badges)
    ? badges.map((badge) => normalizeSteamBadge(badge)).filter(
        (badge): badge is SteamBadgeSummary => badge !== undefined,
      )
    : undefined;

  return {
    ...(badgeCount !== undefined ? { badgeCount } : {}),
    ...(playerXp !== undefined ? { playerXp } : {}),
    ...(steamBadges !== undefined ? { steamBadges } : {}),
  };
}
