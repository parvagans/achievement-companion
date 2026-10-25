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

export function getDeckyOverviewGridRows(height: number): { readonly identity: number; readonly dashboard: number; readonly supporting: number } {
  const identity = Math.max(82, Math.min(92, height * .2));
  const supporting = Math.max(66, Math.min(72, height * .16));
  return { identity, dashboard: Math.max(0, height - identity - supporting - 12), supporting };
}

function getOverviewGridStyle(height: number): CSSProperties {
  const rows = getDeckyOverviewGridRows(height);
  return {
    display: "grid",
    gridTemplateRows: `${rows.identity}px minmax(0, 1fr) ${rows.supporting}px`,
    gap: 6,
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    alignItems: "stretch",
  };
}

export function getDeckyOverviewDashboardColumns(completed: boolean): string {
  return completed ? "minmax(0, 9fr) minmax(0, 11fr)" : "minmax(0, 2fr) minmax(0, 3fr)";
}

function getDashboardStyle(completed: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: getDeckyOverviewDashboardColumns(completed),
    gap: 8,
    minHeight: 0,
    minWidth: 0,
  };
}

export interface DeckyFullScreenGameOverviewLayoutProps {
  readonly identity: ReactNode;
  readonly progress: ReactNode;
  readonly companion: ReactNode;
  readonly supporting: ReactNode;
  readonly completed?: boolean;
}

/**
 * Provider-neutral geometry for the stable full-screen game dashboard.
 * Provider components own their cards, tokens, and actions; this owns only
 * the measured Steam-shaped composition.
 */
export function DeckyFullScreenGameOverviewLayout({
  identity,
  progress,
  companion,
  supporting,
  completed = false,
}: DeckyFullScreenGameOverviewLayoutProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(425);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const update = (): void => { if (root.clientHeight > 0) setHeight(root.clientHeight); };
    update();
    const observer = new (root.ownerDocument.defaultView?.ResizeObserver ?? ResizeObserver)(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={rootRef} data-ac-game-overview-layout="true" style={getOverviewGridStyle(height)}>
      {identity}
      <div data-ac-overview-dashboard-state={completed ? "completed" : "in-progress"} style={getDashboardStyle(completed)}>
        {progress}
        {companion}
      </div>
      {supporting}
    </div>
  );
}
