import type { AppError } from "@core/errors";

/** Preserve provider failure semantics even when a usable cached payload exists. */
export function classifyDeckyRetroAchievementsFailure(cause: unknown, cached = false): AppError {
  const failure = typeof cause === "object" && cause !== null ? cause as Record<string, unknown> : {};
  const status = failure["status"] ?? failure["statusCode"];
  const prefix = cached ? "Showing saved RetroAchievements data. " : "";
  const common = { providerId: "retroachievements" };
  if (status === 429) {
    const delay = typeof failure["retryAfterMs"] === "number" && Number.isFinite(failure["retryAfterMs"])
      ? Math.max(0, failure["retryAfterMs"]) : undefined;
    return { ...common, kind: "rate_limit", retryable: true, statusCode: 429,
      ...(delay !== undefined ? { retryAfterMs: delay } : {}),
      userMessage: `${prefix}RetroAchievements is rate limited. ${delay === undefined ? "Try again later." : `Retry after ${new Date(Date.now() + delay).toLocaleTimeString()}.`}` };
  }
  if (status === 401 || status === 403) return { ...common, kind: "auth", retryable: false,
    userMessage: `${prefix}Check your RetroAchievements credentials in Account settings.` };
  if (failure["category"] === "corrupt_history_checkpoint") return { ...common, kind: "parse", retryable: false,
    userMessage: `${prefix}Rebuild history coverage in Data & Sync Diagnostics, then reopen Activity.` };
  if (status === 404) return { ...common, kind: "unsupported", retryable: true,
    userMessage: `${prefix}This RetroAchievements resource is currently unavailable. Check the game mapping or try again later.` };
  return { ...common, kind: "network", retryable: true,
    userMessage: `${prefix}RetroAchievements is temporarily unavailable. Try again later.` };
}
