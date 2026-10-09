import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const MIN_GAME_TITLE_FONT_SIZE_PX = 15;

function getTitleStyle(color: string, fontSizePx: number | undefined, maxLines: number): CSSProperties {
  return {
    color,
    fontSize: fontSizePx === undefined ? "1.28em" : `${fontSizePx}px`,
    fontWeight: 800,
    lineHeight: 1.15,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    ...(maxLines > 1
      ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: maxLines, whiteSpace: "normal" }
      : { whiteSpace: "nowrap" }),
  };
}

/** Shared one-line title fitting used by Steam and RetroAchievements dashboards. */
export function DeckyFullScreenGameTitle({
  color,
  title,
  maxLines = 1,
}: {
  readonly color: string;
  readonly title: string;
  readonly maxLines?: number;
}): JSX.Element {
  const titleRef = useRef<HTMLDivElement>(null);
  const [fittedTitle, setFittedTitle] = useState<{
    readonly title: string;
    readonly fontSizePx: number;
  } | undefined>(undefined);
  const fontSizePx = fittedTitle?.title === title ? fittedTitle.fontSizePx : undefined;

  useLayoutEffect(() => {
    const element = titleRef.current;
    const ownerWindow = element?.ownerDocument.defaultView;
    if (maxLines > 1 || element === null || ownerWindow === null || ownerWindow === undefined || element.clientWidth === 0) {
      return;
    }

    const currentFontSizePx = Number.parseFloat(ownerWindow.getComputedStyle(element).fontSize);
    if (!Number.isFinite(currentFontSizePx) || element.scrollWidth <= element.clientWidth) {
      return;
    }

    const nextFontSizePx = Math.max(
      MIN_GAME_TITLE_FONT_SIZE_PX,
      Math.floor((currentFontSizePx * element.clientWidth / element.scrollWidth) * 10) / 10,
    );
    if (nextFontSizePx >= currentFontSizePx) {
      return;
    }

    setFittedTitle((current) => current?.title === title && current.fontSizePx === nextFontSizePx
      ? current
      : { title, fontSizePx: nextFontSizePx });
  }, [fontSizePx, maxLines, title]);

  return <div ref={titleRef} style={getTitleStyle(color, fontSizePx, maxLines)}>{title}</div>;
}

function getOverviewGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.8fr)",
    gap: 12,
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    alignItems: "stretch",
  };
}

function getDashboardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    height: "100%",
    minHeight: 0,
    minWidth: 0,
  };
}

function getDashboardTopRowStyle(hasCommunity: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: hasCommunity ? "minmax(0, 1.6fr) minmax(250px, 1fr)" : "minmax(0, 1fr)",
    flex: "1 1 auto",
    gap: 8,
    minHeight: 0,
    minWidth: 0,
  };
}

export interface DeckyFullScreenGameOverviewLayoutProps {
  readonly identity: ReactNode;
  readonly progress: ReactNode;
  readonly community?: ReactNode;
  readonly setDetails?: ReactNode;
  readonly setStatus?: ReactNode;
}

/**
 * Provider-neutral geometry for the stable full-screen game dashboard.
 * Provider components own their cards, tokens, and actions; this owns only
 * the measured Steam-shaped composition.
 */
export function DeckyFullScreenGameOverviewLayout({
  identity,
  progress,
  community,
  setDetails,
  setStatus,
}: DeckyFullScreenGameOverviewLayoutProps): JSX.Element {
  return (
    <div style={getOverviewGridStyle()}>
      {identity}
      <div style={getDashboardStyle()}>
        <div style={getDashboardTopRowStyle(community !== undefined)}>
          {progress}
          {community}
        </div>
        {setDetails}
        {setStatus}
      </div>
    </div>
  );
}
