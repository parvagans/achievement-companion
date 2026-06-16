import type { CSSProperties, JSX } from "react";
import type { NormalizedGame } from "@core/domain";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";

export type RetroAchievementsCompletionIndicatorState =
  | "beaten-hardcore"
  | "mastered-hardcore"
  | "beaten-softcore"
  | "mastered-softcore";

const RETROACHIEVEMENTS_COMPLETION_SILVER = "rgba(214, 221, 232, 0.96)";
const RETROACHIEVEMENTS_COMPLETION_GOLD = "rgba(232, 201, 102, 0.98)";

function getMetricValue(
  metrics: readonly { readonly key: string; readonly label: string; readonly value: string }[],
  key: string,
): string | undefined {
  return metrics.find((metric) => metric.key === key)?.value;
}

export function getRetroAchievementsCompletionIndicatorState(
  game: Pick<NormalizedGame, "providerId" | "metrics">,
): RetroAchievementsCompletionIndicatorState | undefined {
  if (game.providerId !== RETROACHIEVEMENTS_PROVIDER_ID) {
    return undefined;
  }

  const highestAwardKind = getMetricValue(game.metrics, "highest-award-kind")?.trim().toLowerCase();
  if (highestAwardKind === undefined || highestAwardKind.length === 0) {
    return undefined;
  }

  const isHardcore = highestAwardKind.includes("hardcore");
  const isSoftcore = highestAwardKind.includes("softcore");

  if (highestAwardKind.includes("beaten")) {
    return isHardcore && !isSoftcore ? "beaten-hardcore" : "beaten-softcore";
  }

  if (highestAwardKind.includes("mastered")) {
    return isSoftcore ? "mastered-softcore" : "mastered-hardcore";
  }

  if (highestAwardKind.includes("completed")) {
    return isHardcore && !isSoftcore ? "mastered-hardcore" : "mastered-softcore";
  }

  return undefined;
}

export function formatRetroAchievementsCompletionIndicatorLabel(
  state: RetroAchievementsCompletionIndicatorState,
): string {
  if (state === "beaten-hardcore") {
    return "Beaten in hardcore";
  }

  if (state === "mastered-hardcore") {
    return "Mastered in hardcore";
  }

  if (state === "beaten-softcore") {
    return "Beaten in softcore";
  }

  return "Mastered in softcore";
}

export function getRetroAchievementsCompletionIndicatorStyle(
  state: RetroAchievementsCompletionIndicatorState,
): CSSProperties {
  const isGold = state.startsWith("mastered");
  const isHardcore = state.endsWith("hardcore");
  const color = isGold
    ? RETROACHIEVEMENTS_COMPLETION_GOLD
    : RETROACHIEVEMENTS_COMPLETION_SILVER;

  return {
    display: "inline-block",
    width: 12,
    height: 12,
    flex: "0 0 auto",
    borderRadius: 999,
    border: `2px solid ${color}`,
    backgroundColor: isHardcore ? color : "transparent",
    boxShadow: isHardcore
      ? `0 0 10px ${color.replace(/0\.\d+\)$/, "0.32)")}`
      : `inset 0 0 0 1px rgba(0, 0, 0, 0.34), 0 0 8px ${color.replace(/0\.\d+\)$/, "0.16)")}`,
    boxSizing: "border-box",
  };
}

export function RetroAchievementsCompletionIndicator({
  game,
}: {
  readonly game: Pick<NormalizedGame, "providerId" | "metrics">;
}): JSX.Element | null {
  const state = getRetroAchievementsCompletionIndicatorState(game);
  if (state === undefined) {
    return null;
  }

  const label = formatRetroAchievementsCompletionIndicatorLabel(state);

  return (
    <span
      aria-label={label}
      data-retroachievements-completion-indicator={state}
      role="img"
      style={getRetroAchievementsCompletionIndicatorStyle(state)}
      title={label}
    />
  );
}
