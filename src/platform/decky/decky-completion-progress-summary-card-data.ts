import type { CompletionProgressSnapshot } from "@core/domain";
import { formatCompletionProgressFilterLabel, type CompletionProgressFilter } from "@core/settings";
import { STEAM_PROVIDER_ID } from "../../providers/steam";

export type CompletionProgressSelectionFilter = CompletionProgressFilter | "subsets";

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function formatCompletionProgressSelectionLabelForProvider(
  filter: CompletionProgressSelectionFilter,
  providerId: string,
): string {
  if (filter === "subsets") {
    return "Subsets";
  }

  if (providerId === STEAM_PROVIDER_ID) {
    if (filter === "beaten") {
      return "Skipped";
    }

    if (filter === "mastered") {
      return "Perfect";
    }
  }

  return formatCompletionProgressFilterLabel(filter);
}

export interface CompletionProgressSummaryCardDescriptor {
  readonly label: string;
  readonly value: string;
  readonly filter: CompletionProgressSelectionFilter;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly helper?: string;
}

export function buildCompletionProgressSummaryCards({
  summary,
  subsetCount,
  providerId,
  currentFilter,
  showSubsets,
}: {
  readonly summary: CompletionProgressSnapshot["summary"];
  readonly subsetCount: number;
  readonly providerId: string;
  readonly currentFilter: CompletionProgressSelectionFilter;
  readonly showSubsets: boolean;
}): readonly CompletionProgressSummaryCardDescriptor[] {
  return providerId === STEAM_PROVIDER_ID
    ? [
        {
          label: "Played",
          value: formatCount(summary.playedCount),
          filter: "all" as const,
          selected: currentFilter === "all",
        },
        {
          label: "Unfinished",
          value: formatCount(summary.unfinishedCount),
          filter: "unfinished" as const,
          selected: currentFilter === "unfinished",
        },
        {
          label: "Skipped",
          value: formatCount(summary.beatenCount),
          filter: "beaten" as const,
          selected: currentFilter === "beaten",
        },
        {
          label: "Perfect",
          value: formatCount(summary.masteredCount),
          filter: "mastered" as const,
          selected: currentFilter === "mastered",
        },
      ]
    : [
        {
          label: "Played",
          value: formatCount(summary.playedCount),
          filter: "all" as const,
          selected: currentFilter === "all",
        },
        {
          label: "Unfinished",
          value: formatCount(summary.unfinishedCount),
          filter: "unfinished" as const,
          selected: currentFilter === "unfinished",
        },
        {
          label: "Subsets",
          value: formatCount(subsetCount),
          filter: "subsets" as const,
          selected: currentFilter === "subsets",
          ...(showSubsets
            ? {}
            : {
                helper: "Enable Show subsets to browse subset games.",
                disabled: true,
              }),
        },
        {
          label: "Beaten",
          value: formatCount(summary.beatenCount),
          filter: "beaten" as const,
          selected: currentFilter === "beaten",
        },
        {
          label: "Mastered",
          value: formatCount(summary.masteredCount),
          filter: "mastered" as const,
          selected: currentFilter === "mastered",
        },
      ];
}
