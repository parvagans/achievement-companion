import type { CSSProperties, JSX } from "react";
import type { NormalizedMetric } from "@core/domain";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";

export type RetroAchievementsCompletionIndicatorState =
  | "beaten-hardcore"
  | "mastered-hardcore"
  | "beaten-softcore"
  | "mastered-softcore";

export interface RetroAchievementsCompletionBreakdownItem {
  readonly state: RetroAchievementsCompletionIndicatorState;
  readonly count: number | undefined;
  readonly action: "beaten" | "mastered" | "completed";
  readonly mode: "hardcore" | "softcore";
  readonly fullLabel: string;
}

const RETROACHIEVEMENTS_COMPLETION_SILVER = "rgba(214, 221, 232, 0.96)";
const RETROACHIEVEMENTS_COMPLETION_GOLD = "rgba(232, 201, 102, 0.98)";

function getMetricValue(
  metrics: readonly NormalizedMetric[] | undefined,
  key: string,
): string | undefined {
  if (metrics === undefined) {
    return undefined;
  }

  return metrics.find((metric) => metric.key === key)?.value;
}

export function getRetroAchievementsCompletionIndicatorState(
  game: { readonly providerId: string; readonly metrics?: readonly NormalizedMetric[] },
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

export function isRetroAchievementsMasteredHardcoreGame(
  game: { readonly providerId: string; readonly metrics?: readonly NormalizedMetric[] },
): boolean {
  return getRetroAchievementsCompletionIndicatorState(game) === "mastered-hardcore";
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
  readonly game: { readonly providerId: string; readonly metrics?: readonly NormalizedMetric[] };
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

function formatBreakdownLabel({
  count,
  action,
  mode,
}: {
  readonly count: number;
  readonly action: RetroAchievementsCompletionBreakdownItem["action"];
  readonly mode: "hardcore" | "softcore";
}): string {
  return `${count.toLocaleString()} ${action} in ${mode}`;
}

function getBreakdownContainerStyle(variant: "compact" | "full"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: variant === "compact" ? "3px 8px" : "4px 12px",
    minWidth: 0,
    maxWidth: "100%",
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: variant === "compact" ? "0.72em" : "0.78em",
    fontWeight: 700,
    lineHeight: 1.15,
  };
}

function getBreakdownItemStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
    whiteSpace: "nowrap",
  };
}

function getBreakdownIndicatorStyle(state: RetroAchievementsCompletionIndicatorState): CSSProperties {
  return {
    ...getRetroAchievementsCompletionIndicatorStyle(state),
    width: 10,
    height: 10,
  };
}

export function RetroAchievementsCompletionBreakdown({
  kind,
  items,
  variant,
}: {
  readonly kind: "beaten" | "mastered";
  readonly items: readonly RetroAchievementsCompletionBreakdownItem[];
  readonly variant: "compact" | "full";
}): JSX.Element | null {
  const visibleItems = items.flatMap((item) =>
    item.count !== undefined && item.count > 0 ? [{ ...item, count: item.count }] : [],
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <span
      aria-label={visibleItems
        .map((item) => formatBreakdownLabel({ count: item.count, action: item.action, mode: item.mode }))
        .join(", ")}
      data-retroachievements-completion-breakdown={kind}
      style={getBreakdownContainerStyle(variant)}
    >
      {visibleItems.map((item) => {
        const label = formatBreakdownLabel({ count: item.count, action: item.action, mode: item.mode });

        return (
          <span key={item.state} title={label} style={getBreakdownItemStyle()}>
            <span aria-hidden="true" style={getBreakdownIndicatorStyle(item.state)} />
            <span>
              {variant === "compact"
                ? item.count.toLocaleString()
                : `${item.count.toLocaleString()} ${item.fullLabel}`}
            </span>
          </span>
        );
      })}
    </span>
  );
}
