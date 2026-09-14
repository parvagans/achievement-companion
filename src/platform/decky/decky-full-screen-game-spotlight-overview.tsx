import type { CSSProperties, ReactNode } from "react";
import { DeckyFullScreenGameSpotlightActions } from "./decky-full-screen-game-spotlight-actions";
import { DeckyFullScreenGameSpotlightCard } from "./decky-full-screen-game-spotlight-card";
import { DeckySystemPill } from "./decky-system-pill";

function getOverviewLayoutStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  };
}

function getOverviewTextStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    width: "100%",
    alignItems: "center",
  };
}

function getOverviewTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: "1.18em",
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "center",
    whiteSpace: "normal",
  };
}

function getPillRowStyle(): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    width: "100%",
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

function getHeroStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    width: "100%",
  };
}

export interface DeckyFullScreenGameSpotlightOverviewProps {
  readonly title: string;
  readonly metadataLabels: readonly string[];
  readonly artwork: ReactNode | undefined;
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly platform: { readonly label: string; readonly iconUrl: string | undefined } | undefined;
}

export function DeckyFullScreenGameSpotlightOverview({
  title,
  metadataLabels,
  artwork,
  backLabel,
  onBack,
  onRefresh,
  platform,
}: DeckyFullScreenGameSpotlightOverviewProps): JSX.Element {
  return (
    <DeckyFullScreenGameSpotlightCard title="Game Overview" focusable={false}>
      <div style={getOverviewLayoutStyle()}>
        <div style={getOverviewTextStyle()}>
          {platform !== undefined ? (
            <DeckySystemPill
              label={platform.label}
              iconSize={16}
              iconUrl={platform.iconUrl}
              style={getInfoPillStyle()}
            />
          ) : null}
          <div style={getOverviewTitleStyle()}>{title}</div>
          <div style={getPillRowStyle()}>
            {metadataLabels.map((label) => (
              <span key={label} style={getInfoPillStyle()}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {artwork !== undefined ? <div style={getHeroStyle()}>{artwork}</div> : null}

        <DeckyFullScreenGameSpotlightActions
          backLabel={backLabel}
          onBack={onBack}
          onRefresh={onRefresh}
        />
      </div>
    </DeckyFullScreenGameSpotlightCard>
  );
}
