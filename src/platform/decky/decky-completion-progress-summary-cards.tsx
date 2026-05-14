import { useState, type CSSProperties, type ComponentProps, type JSX, type FocusEventHandler } from "react";
import type { CompletionProgressSnapshot } from "@core/domain";
import { Focusable } from "@decky/ui";
import { formatCompletionProgressFilterLabel, type CompletionProgressFilter } from "@core/settings";
import { STEAM_PROVIDER_ID } from "../../providers/steam";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";

export type CompletionProgressSelectionFilter = CompletionProgressFilter | "subsets";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatCompletionProgressSelectionLabelForProvider(
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

function getSummaryGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
    alignItems: "stretch",
    width: "100%",
  };
}

function getCompletionProgressSummaryCardStyle({
  selected,
  disabled,
  focused,
}: {
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly focused: boolean;
}): CSSProperties {
  const base: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "12px 12px 11px",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.075)",
    background: "rgba(255, 255, 255, 0.032)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 10px rgba(0, 0, 0, 0.16)",
    color: "rgba(255, 255, 255, 0.96)",
    textAlign: "center",
    userSelect: "none",
    transition:
      "background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease, transform 120ms ease",
  };

  const selectedStyle: CSSProperties = selected
    ? {
        borderColor: "rgba(125, 190, 255, 0.72)",
        background: "linear-gradient(180deg, rgba(96, 165, 250, 0.16), rgba(96, 165, 250, 0.08))",
        boxShadow:
          "inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(96, 165, 250, 0.28)",
      }
    : {};

  const focusedStyle: CSSProperties = focused
    ? selected
      ? {
          borderColor: "rgba(125, 190, 255, 0.88)",
          background: "linear-gradient(180deg, rgba(96, 165, 250, 0.24), rgba(96, 165, 250, 0.12))",
          boxShadow:
            "0 0 0 1px rgba(96, 165, 250, 0.82), inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.26)",
        }
      : {
          borderColor: "rgba(96, 165, 250, 0.82)",
          background: "linear-gradient(180deg, rgba(96, 165, 250, 0.2), rgba(96, 165, 250, 0.1))",
          boxShadow:
            "0 0 0 1px rgba(96, 165, 250, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 4px 14px rgba(0, 0, 0, 0.24)",
        }
    : {};

  const disabledStyle: CSSProperties = disabled
    ? {
        cursor: "default",
        opacity: 0.58,
      }
    : {
        cursor: "pointer",
      };

  return {
    ...base,
    ...selectedStyle,
    ...focusedStyle,
    ...disabledStyle,
  };
}

function getCompletionProgressSummaryValueStyle(selected: boolean): CSSProperties {
  return {
    color: selected ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.92)",
    fontSize: "0.98em",
    fontWeight: 700,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
}

function getCompletionProgressSummaryCardLabelStyle(selected: boolean): CSSProperties {
  return {
    color: selected ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.8)",
    fontSize: "0.78em",
    fontWeight: 800,
    letterSpacing: "0.045em",
    lineHeight: 1.2,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function getCompletionProgressSummaryCardHelperStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.8em",
    lineHeight: 1.2,
  };
}

function CompletionProgressSummaryCard({
  label,
  value,
  helper,
  selected,
  disabled,
  onClick,
  filter,
  providerId,
}: {
  readonly label: string;
  readonly value: string;
  readonly helper?: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly filter: CompletionProgressSelectionFilter;
  readonly providerId: string;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  const onFocus: FocusEventHandler<HTMLElement> = (event) => {
    setIsFocused(true);
    event.currentTarget.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  };

  const onGamepadFocus: NonNullable<ComponentProps<typeof Focusable>["onGamepadFocus"]> = (event) => {
    setIsFocused(true);
    const target = event.currentTarget;

    if (target instanceof HTMLElement) {
      target.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={`${formatCompletionProgressSelectionLabelForProvider(filter, providerId)} filter`}
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onActivate={disabled ? () => undefined : onClick}
      onClick={disabled ? () => undefined : onClick}
      onFocus={onFocus}
      onGamepadFocus={onGamepadFocus}
      onBlur={() => {
        setIsFocused(false);
      }}
      data-completion-progress-filter={filter}
      data-completion-progress-filter-selected={selected ? "true" : "false"}
      data-completion-progress-filter-disabled={disabled ? "true" : "false"}
      style={getCompletionProgressSummaryCardStyle({ selected, disabled, focused: isFocused })}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, width: "100%" }}>
        <div style={getCompletionProgressSummaryCardLabelStyle(selected)}>{label}</div>
        <div style={getCompletionProgressSummaryValueStyle(selected)}>{value}</div>
        {helper !== undefined ? <div style={getCompletionProgressSummaryCardHelperStyle()}>{helper}</div> : null}
      </div>
    </Focusable>
  );
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

export function CompletionProgressSummaryCardGrid({
  cards,
  providerId,
  onSelectFilter,
}: {
  readonly cards: readonly CompletionProgressSummaryCardDescriptor[];
  readonly providerId: string;
  readonly onSelectFilter: (filter: CompletionProgressSelectionFilter) => void;
}): JSX.Element {
  return (
    <div style={getSummaryGridStyle()}>
      {cards.map((card) => (
        <CompletionProgressSummaryCard
          key={card.label}
          filter={card.filter}
          label={card.label}
          value={card.value}
          {...(card.helper !== undefined ? { helper: card.helper } : {})}
          selected={card.selected}
          disabled={card.disabled ?? false}
          providerId={providerId}
          onClick={() => {
            if (card.disabled ?? false) {
              return;
            }

            onSelectFilter(card.filter);
          }}
        />
      ))}
    </div>
  );
}
