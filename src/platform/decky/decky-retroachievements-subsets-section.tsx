import type { CSSProperties } from "react";
import type { RelatedGameSummary } from "@core/domain";
import { Focusable } from "@decky/ui";
import { DeckyGameArtwork } from "./decky-game-artwork";
import { raRecipes, raTheme } from "./ra-theme";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function getGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 10,
    width: "100%",
  };
}

function getRowStyle(): CSSProperties {
  return {
    ...raRecipes.row("fullscreen"),
    minHeight: 88,
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
  };
}

function getTextStyle(): CSSProperties {
  return { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
}

function getTitleStyle(): CSSProperties {
  return {
    ...raRecipes.text("fullscreen", "title"),
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getMetadataStyle(): CSSProperties {
  return { ...raRecipes.text("fullscreen", "metadata"), color: raTheme.color.textSecondary };
}

function getProgressStyle(): CSSProperties {
  return { ...raRecipes.text("fullscreen", "body"), color: raTheme.color.textPrimary };
}

export function DeckyRetroAchievementsSubsetsSection({
  subsets,
  onBack,
  onFocusSubset,
  onOpenSubset,
}: {
  readonly subsets: readonly RelatedGameSummary[];
  readonly onBack: () => void;
  readonly onFocusSubset: (gameId: string) => void;
  readonly onOpenSubset: (gameId: string) => void;
}): JSX.Element {
  return (
    <div style={getGridStyle()}>
      {subsets.map((subset) => {
        const totalCount = subset.progress?.totalCount ?? subset.totalAchievementCount;
        const progressLabel = subset.progress !== undefined && totalCount !== undefined
          ? `${formatCount(subset.progress.unlockedCount)} / ${formatCount(totalCount)} achievements${subset.progress.completionPercent !== undefined ? ` · ${subset.progress.completionPercent}%` : ""}`
          : "Progress unavailable";
        return (
          <Focusable
            key={subset.gameId}
            aria-label={`Open subset ${subset.title}`}
            data-achievement-companion-ra-subset-id={subset.gameId}
            onActivate={() => onOpenSubset(subset.gameId)}
            onCancel={onBack}
            onFocus={(event) => {
              onFocusSubset(subset.gameId);
              scrollDeckyFocusTargetIntoView(event.currentTarget);
            }}
            onGamepadFocus={(event) => {
              onFocusSubset(subset.gameId);
              scrollDeckyFocusTargetIntoView(event.currentTarget);
            }}
            role="button"
            style={getRowStyle()}
          >
            <DeckyGameArtwork
              compact
              fit="contain"
              height={72}
              {...((subset.boxArtImageUrl ?? subset.coverImageUrl) !== undefined
                ? { src: subset.boxArtImageUrl ?? subset.coverImageUrl }
                : {})}
              size={72}
              title={subset.title}
              width={72}
            />
            <div style={getTextStyle()}>
              <div style={getTitleStyle()}>{subset.title}</div>
              <div style={getMetadataStyle()}>
                {subset.platformLabel ?? "Unknown system"}
                {totalCount !== undefined ? ` · ${formatCount(totalCount)} achievements` : ""}
              </div>
              <div style={getProgressStyle()}>{progressLabel}</div>
            </div>
          </Focusable>
        );
      })}
    </div>
  );
}
