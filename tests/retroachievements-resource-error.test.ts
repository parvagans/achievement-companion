import assert from "node:assert/strict";
import test from "node:test";
import { classifyDeckyRetroAchievementsFailure } from "../src/platform/decky/decky-retroachievements-resource-error";

test("cached rate limits retain retry eligibility and explain cooldown", () => {
  const error = classifyDeckyRetroAchievementsFailure({ status: 429, retryAfterMs: 120000 }, true);
  assert.equal(error.kind, "rate_limit");
  if (error.kind === "rate_limit") assert.equal(error.retryAfterMs, 120000);
  assert.match(error.userMessage, /Showing saved.*rate limited.*Retry after/u);
});
test("cached authentication failures direct recovery to Account settings", () => {
  const error = classifyDeckyRetroAchievementsFailure({ statusCode: 403 }, true);
  assert.equal(error.kind, "auth");
  assert.equal(error.retryable, false);
  assert.match(error.userMessage, /Showing saved.*Account settings/u);
});
test("local history corruption gives targeted recovery instead of network retry", () => {
  const error = classifyDeckyRetroAchievementsFailure({ category: "corrupt_history_checkpoint" });
  assert.equal(error.kind, "parse");
  assert.equal(error.retryable, false);
  assert.match(error.userMessage, /Rebuild history coverage/u);
});
test("unsupported and offline failures remain distinguishable without exposing provider bodies", () => {
  assert.equal(classifyDeckyRetroAchievementsFailure({ status: 404 }).kind, "unsupported");
  const error = classifyDeckyRetroAchievementsFailure({ status: 503, message: "private provider body" });
  assert.equal(error.kind, "network");
  assert.doesNotMatch(error.userMessage, /private provider body/u);
});
