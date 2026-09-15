import type { CSSProperties, ReactNode } from "react";
import { DeckyFullScreenGameSpotlightActions } from "./decky-full-screen-game-spotlight-actions";
import {
  DeckyFullScreenGameSpotlightCard,
  DeckyFullScreenGameSpotlightFocusTarget,
} from "./decky-full-screen-game-spotlight-card";
import { DeckySystemPill } from "./decky-system-pill";

type DeckyFullScreenGameSpotlightOverviewLayout = "vertical" | "horizontal";

function getOverviewLayoutStyle(layout: DeckyFullScreenGameSpotlightOverviewLayout): CSSProperties {
  const isHorizontal = layout === "horizontal";

  return {
    display: "flex",
    flexDirection: isHorizontal ? "row" : "column",
    flexWrap: isHorizontal ? "wrap" : "nowrap",
    gap: 14,
    alignItems: isHorizontal ? "stretch" : "center",
    minWidth: 0,
  };
}

function getOverviewTextStyle(layout: DeckyFullScreenGameSpotlightOverviewLayout): CSSProperties {
  const isHorizontal = layout === "horizontal";

  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    flex: isHorizontal ? "1 1 280px" : undefined,
    width: isHorizontal ? "auto" : "100%",
    alignItems: isHorizontal ? "flex-start" : "center",
  };
}

function getOverviewTitleStyle(layout: DeckyFullScreenGameSpotlightOverviewLayout): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "1.18em",
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: layout === "horizontal" ? "left" : "center",
    whiteSpace: "normal",
  };
}

function getInfoPillStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: "0.82em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

function getHeroStyle(layout: DeckyFullScreenGameSpotlightOverviewLayout): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: layout === "horizontal" ? "0 0 auto" : undefined,
    paddingTop: layout === "horizontal" ? 0 : 4,
    width: layout === "horizontal" ? "auto" : "100%",
  };
}

function getFocusableContentStyle(): CSSProperties {
  return { minWidth: 0, width: "100%" };
}

export interface DeckyFullScreenGameSpotlightOverviewProps {
  readonly title: string;
  readonly artwork: ReactNode | undefined;
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly platform: { readonly label: string; readonly iconUrl: string | undefined } | undefined;
  readonly layout?: DeckyFullScreenGameSpotlightOverviewLayout;
  readonly focusable?: boolean;
}

export function DeckyFullScreenGameSpotlightOverview({
  title,
  artwork,
  backLabel,
  onBack,
  onRefresh,
  platform,
  layout = "vertical",
  focusable = false,
}: DeckyFullScreenGameSpotlightOverviewProps): JSX.Element {
  const identity = (
    <div style={getOverviewTextStyle(layout)}>
      {platform !== undefined ? (
        <DeckySystemPill
          label={platform.label}
          iconSize={16}
          iconUrl={platform.iconUrl}
          style={getInfoPillStyle()}
        />
      ) : null}
      <div style={getOverviewTitleStyle(layout)}>{title}</div>
    </div>
  );

  const overviewContent = (
    <div style={getOverviewLayoutStyle(layout)}>
      {layout === "horizontal" && artwork !== undefined ? <div style={getHeroStyle(layout)}>{artwork}</div> : null}
      {identity}
      {layout === "vertical" && artwork !== undefined ? <div style={getHeroStyle(layout)}>{artwork}</div> : null}
    </div>
  );

  return (
    <DeckyFullScreenGameSpotlightCard
      title="Game Overview"
      focusable={false}
      headerAlignment={layout === "horizontal" ? "left" : "center"}
    >
      {focusable ? (
        <DeckyFullScreenGameSpotlightFocusTarget style={getFocusableContentStyle()}>
          {overviewContent}
        </DeckyFullScreenGameSpotlightFocusTarget>
      ) : overviewContent}
      <DeckyFullScreenGameSpotlightActions
        backLabel={backLabel}
        centered={layout === "vertical"}
        onBack={onBack}
        onRefresh={onRefresh}
      />
    </DeckyFullScreenGameSpotlightCard>
  );
}
