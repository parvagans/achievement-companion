import { useState, type CSSProperties, type ComponentProps, type FocusEventHandler } from "react";
import type { NormalizedAchievement } from "@core/domain";
import { Field, Focusable, PanelSectionRow } from "@decky/ui";
import { shouldRenderAchievementModeFilter } from "./decky-achievement-detail-helpers";
import { DeckyFullScreenAchievementRow } from "./decky-full-screen-achievement-row";
import { DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS } from "./decky-focus-styles";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";

const ACHIEVEMENT_FILTERS = ["all", "unlocked", "locked"] as const;
const ACHIEVEMENT_MODE_FILTERS = ["all", "hardcore", "softcore"] as const;

export type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number];
export type AchievementModeFilter = (typeof ACHIEVEMENT_MODE_FILTERS)[number];

export function matchesAchievementFilter(
  achievement: NormalizedAchievement,
  filter: AchievementFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "unlocked") return achievement.isUnlocked;
  return !achievement.isUnlocked;
}

export function matchesAchievementModeFilter(
  achievement: NormalizedAchievement,
  modeFilter: AchievementModeFilter,
): boolean {
  if (modeFilter === "all" || !achievement.isUnlocked) return true;
  return modeFilter === "hardcore"
    ? achievement.unlockMode !== "softcore"
    : achievement.unlockMode !== "hardcore";
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatAchievementFilterLabel(filter: AchievementFilter): string {
  return filter === "all" ? "All" : filter === "unlocked" ? "Unlocked" : "Locked";
}

function formatAchievementModeLabel(modeFilter: AchievementModeFilter): string {
  return modeFilter === "all" ? "All" : modeFilter === "hardcore" ? "Hardcore" : "Softcore";
}

function formatAchievementVisibilitySummary(
  visibleCount: number,
  totalCount: number,
  filter: AchievementFilter,
): string {
  const suffix = filter === "all" ? "achievements" : formatAchievementFilterLabel(filter).toLowerCase();
  return `Showing ${formatCount(visibleCount)} of ${formatCount(totalCount)} ${suffix}`;
}

function formatAchievementFilterEmptyMessage(filter: AchievementFilter): string {
  if (filter === "all") return "No achievement entries were returned for this game.";
  return `No ${formatAchievementFilterLabel(filter).toLowerCase()} achievements match this filter.`;
}

type FullScreenGamepadFocusHandler = NonNullable<ComponentProps<typeof Field>["onGamepadFocus"]>;

const scrollFocusedGamepadElementIntoView: FullScreenGamepadFocusHandler = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

const scrollFocusedElementIntoView: FocusEventHandler<HTMLElement> = (event) => {
  scrollDeckyFocusTargetIntoView(event.currentTarget);
};

function getAchievementBrowserStackStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 12 };
}

function getAchievementBrowserCardStyle(): CSSProperties {
  return {
    display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 18,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.026))",
  };
}

function getAchievementBrowserHeaderStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.58)", fontSize: "0.72em", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 };
}

function getAchievementBrowserSectionLabelStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.58)", fontSize: "0.72em", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.2 };
}

function getAchievementBrowserMetaStackStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4 };
}

function getAchievementFilterGridStyle(): CSSProperties {
  return { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, width: "100%" };
}

function getAchievementFilterButtonStyle(selected: boolean, focused: boolean, disabled: boolean): CSSProperties {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minWidth: 0,
    minHeight: 36, padding: "8px 10px", borderRadius: 16, boxSizing: "border-box",
    border: `1px solid ${focused ? "rgba(96, 165, 250, 0.82)" : selected ? "rgba(125, 190, 255, 0.72)" : "rgba(255, 255, 255, 0.08)"}`,
    background: focused
      ? selected ? "linear-gradient(180deg, rgba(96, 165, 250, 0.24), rgba(96, 165, 250, 0.12))" : "linear-gradient(180deg, rgba(96, 165, 250, 0.2), rgba(96, 165, 250, 0.1))"
      : selected ? "linear-gradient(180deg, rgba(125, 190, 255, 0.18), rgba(255, 255, 255, 0.055))" : "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02))",
    color: selected ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.84)", fontSize: "0.84em", fontWeight: selected ? 700 : 600,
    lineHeight: 1.1, textAlign: "center", whiteSpace: "nowrap", opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "default" : "pointer", outline: focused ? "2px solid rgba(96, 165, 250, 0.95)" : "none", outlineOffset: 1,
    boxShadow: focused
      ? selected ? "0 0 0 1px rgba(96, 165, 250, 0.82), inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.26)" : "0 0 0 1px rgba(96, 165, 250, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 4px 14px rgba(0, 0, 0, 0.24)"
      : selected ? "inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 2px 10px rgba(0, 0, 0, 0.18)" : "none",
  };
}

function getAchievementFilterButtonLabelStyle(): CSSProperties {
  return { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

interface AchievementFilterButtonProps {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
}

function AchievementFilterButton({ label, selected, disabled = false, onActivate, onCancel }: AchievementFilterButtonProps): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Focusable
      className={DECKY_FOCUS_ACHIEVEMENT_ROW_CLASS}
      noFocusRing
      role="button"
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      onActivate={disabled ? () => undefined : onActivate}
      onClick={disabled ? () => undefined : onActivate}
      onFocus={(event) => { setIsFocused(true); scrollFocusedElementIntoView(event); }}
      onGamepadFocus={(event) => { setIsFocused(true); scrollFocusedGamepadElementIntoView(event); }}
      onBlur={() => { setIsFocused(false); }}
      onCancel={onCancel}
      style={getAchievementFilterButtonStyle(selected, isFocused, disabled)}
      data-achievement-filter-selected={selected ? "true" : "false"}
      data-achievement-filter-disabled={disabled ? "true" : "false"}
    >
      <span style={getAchievementFilterButtonLabelStyle()}>{label}</span>
    </Focusable>
  );
}

function getAchievementBrowserSummaryStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.92)", fontSize: "0.94em", lineHeight: 1.35 };
}

function getAchievementBrowserMetaStyle(): CSSProperties {
  return { color: "rgba(255, 255, 255, 0.68)", fontSize: "0.86em", lineHeight: 1.25 };
}

function getAchievementRowsLayoutStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 8 };
}

export interface DeckyFullScreenAchievementBrowserProps {
  readonly achievementFilter: AchievementFilter;
  readonly achievementModeFilter: AchievementModeFilter;
  readonly achievementSummary: string;
  readonly achievements: readonly NormalizedAchievement[];
  readonly providerId: string | undefined;
  readonly filteredAchievementCount: number;
  readonly onAchievementFilterChange: (filter: AchievementFilter) => void;
  readonly onAchievementModeFilterChange: (filter: AchievementModeFilter) => void;
  readonly onOpenAchievementDetail: ((achievementId: string) => void) | undefined;
  readonly onBack: () => void;
}

export function DeckyFullScreenAchievementBrowser({
  achievementFilter, achievementModeFilter, achievementSummary, achievements, providerId,
  filteredAchievementCount, onAchievementFilterChange, onAchievementModeFilterChange,
  onOpenAchievementDetail, onBack,
}: DeckyFullScreenAchievementBrowserProps): JSX.Element {
  const showAchievementModeFilter = shouldRenderAchievementModeFilter(providerId);
  return (
    <div style={getAchievementBrowserStackStyle()}>
      <div style={getAchievementBrowserCardStyle()}>
        <div style={getAchievementBrowserHeaderStyle()}>Filtered view</div>
        <div style={getAchievementBrowserSummaryStyle()}>{achievementSummary}</div>
        <div style={getAchievementBrowserMetaStyle()}>
          {formatAchievementVisibilitySummary(achievements.length, filteredAchievementCount, achievementFilter)}
        </div>
        <div style={getAchievementBrowserMetaStackStyle()}>
          {showAchievementModeFilter ? (
            <>
              <div style={getAchievementBrowserSectionLabelStyle()}>Mode / State</div>
              <Focusable flow-children="left-right" style={getAchievementFilterGridStyle()}>
                {ACHIEVEMENT_MODE_FILTERS.map((filter) => (
                  <AchievementFilterButton key={`mode-${filter}`} label={formatAchievementModeLabel(filter)} selected={filter === achievementModeFilter} onActivate={() => onAchievementModeFilterChange(filter)} onCancel={onBack} />
                ))}
                {ACHIEVEMENT_FILTERS.map((filter) => (
                  <AchievementFilterButton key={`state-${filter}`} label={formatAchievementFilterLabel(filter)} selected={filter === achievementFilter} onActivate={() => onAchievementFilterChange(filter)} onCancel={onBack} />
                ))}
              </Focusable>
            </>
          ) : (
            <>
              <div style={getAchievementBrowserSectionLabelStyle()}>State</div>
              <Focusable flow-children="left-right" style={getAchievementFilterGridStyle()}>
                {ACHIEVEMENT_FILTERS.map((filter) => (
                  <AchievementFilterButton key={filter} label={formatAchievementFilterLabel(filter)} selected={filter === achievementFilter} onActivate={() => onAchievementFilterChange(filter)} onCancel={onBack} />
                ))}
              </Focusable>
            </>
          )}
        </div>
      </div>
      {achievements.length > 0 ? (
        <div style={getAchievementRowsLayoutStyle()}>
          {achievements.map((achievement) => (
            <PanelSectionRow key={achievement.achievementId}>
              <DeckyFullScreenAchievementRow achievement={achievement} onOpenAchievementDetail={onOpenAchievementDetail} onBack={onBack} />
            </PanelSectionRow>
          ))}
        </div>
      ) : (
        <PanelSectionRow>
          <Field bottomSeparator="none" description={formatAchievementFilterEmptyMessage(achievementFilter)} label="Achievements" />
        </PanelSectionRow>
      )}
    </div>
  );
}
