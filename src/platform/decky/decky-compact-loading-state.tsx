import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import infoIconUrl from "./assets/info.svg";
import { registerCompactProviderCancelCallback } from "./decky-full-screen-cancel-bridge";
import { findDeckyScrollContainerAncestor } from "./decky-scroll-viewport";
import { achievementCompanionQamTheme } from "./decky-qam-theme";
import {
  DECKY_LOADING_COLORS,
  DECKY_LOADING_PAGE_BACKGROUND,
  DeckyLoadingBrandMark,
  getDeckyLoadingInfoCardStyle,
} from "./decky-loading-brand";

export interface DeckyCompactLoadingStateProps {
  readonly description: string;
  readonly isError: boolean;
  /** Used only after loading fails; Back is intentionally unavailable while loading. */
  readonly onCancel?: (() => void) | undefined;
  readonly title: string;
  readonly steamTheme?: boolean;
}

const consumeCompactLoadingBack = (): void => undefined;

function getLoadingSurfaceStyle(visibleHeight: number | undefined, isError: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 auto",
    width: "100%",
    minHeight: visibleHeight === undefined ? 0 : visibleHeight,
    minWidth: 0,
    padding: "18px 16px",
    boxSizing: "border-box",
    color: isError ? achievementCompanionQamTheme.status.danger.text : achievementCompanionQamTheme.color.textPrimary,
    fontFamily: achievementCompanionQamTheme.type.fontFamily,
    overscrollBehavior: "none",
    touchAction: "none",
    background: DECKY_LOADING_PAGE_BACKGROUND,
  };
}

function getLoadingContentStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    width: "100%",
    minWidth: 0,
    textAlign: "center",
  };
}

function getLoadingTitleStyle(): CSSProperties {
  return {
    margin: 0,
    color: DECKY_LOADING_COLORS.text,
    fontSize: `${achievementCompanionQamTheme.type.compact.heading}px`,
    fontWeight: achievementCompanionQamTheme.type.weight.strong,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  };
}

function getPreparingTextStyle(): CSSProperties {
  return {
    margin: "-2px 0 0",
    color: achievementCompanionQamTheme.color.textSecondary,
    fontSize: "12px",
    lineHeight: 1.25,
  };
}

function getLoadingInfoStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    position: "relative",
    width: "100%",
    minHeight: 48,
    padding: "8px 12px 8px 38px",
    boxSizing: "border-box",
    ...getDeckyLoadingInfoCardStyle(true),
    textAlign: "left",
  };
}

function getLoadingInfoIconStyle(): CSSProperties {
  return {
    position: "absolute",
    left: 11,
    width: 18,
    height: 18,
    filter: "brightness(0) invert(1)",
  };
}

function getLoadingInfoTextStyle(): CSSProperties {
  return {
    margin: 0,
    color: achievementCompanionQamTheme.color.textSecondary,
    fontSize: "12px",
    lineHeight: 1.3,
  };
}

export function DeckyCompactLoadingState({
  description,
  isError,
  onCancel,
  title,
  steamTheme: isSteam = false,
}: DeckyCompactLoadingStateProps): JSX.Element {
  const surfaceRef = useRef<HTMLElement>(null);
  const [visibleHeight, setVisibleHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(
    // Loading is a modal wait state: consume B so it cannot abandon the
    // request, expose stale state, or close QAM. Failed loads still offer the
    // caller's normal Back path.
    () => registerCompactProviderCancelCallback(
      surfaceRef.current,
      isError ? onCancel ?? consumeCompactLoadingBack : consumeCompactLoadingBack,
    ),
    [isError, onCancel],
  );

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const ownerWindow = surface?.ownerDocument.defaultView;
    if (surface === null || ownerWindow === null || ownerWindow === undefined) {
      return;
    }

    const scrollContainer = findDeckyScrollContainerAncestor(surface);
    if (scrollContainer === null) {
      return;
    }

    const previousOverflowY = scrollContainer.style.overflowY;
    scrollContainer.style.overflowY = "hidden";

    const updateVisibleHeight = (): void => {
      const availableHeight = Math.max(
        0,
        scrollContainer.getBoundingClientRect().bottom - surface.getBoundingClientRect().top,
      );
      setVisibleHeight((currentHeight) => currentHeight === availableHeight ? currentHeight : availableHeight);
    };

    updateVisibleHeight();
    // A compact game -> dashboard return replaces the child before its parent
    // scroll viewport applies its own layout-effect reset. Measure once more
    // after that reset so the loader never retains the previous game's offset.
    const updateFrame = ownerWindow.requestAnimationFrame(updateVisibleHeight);
    ownerWindow.addEventListener("resize", updateVisibleHeight);
    return () => {
      ownerWindow.cancelAnimationFrame(updateFrame);
      ownerWindow.removeEventListener("resize", updateVisibleHeight);
      if (scrollContainer.style.overflowY === "hidden") {
        scrollContainer.style.overflowY = previousOverflowY;
      }
    };
  }, []);

  return (
    <section
      aria-busy={!isError}
      aria-label={title}
      aria-live="polite"
      data-achievement-companion-compact-loading-state="true"
      data-ac-steam-theme={isSteam ? "compact" : undefined}
      data-ac-ra-theme={!isSteam ? "compact" : undefined}
      ref={surfaceRef}
      role={isError ? "alert" : "status"}
      style={getLoadingSurfaceStyle(visibleHeight, isError)}
    >
      <div style={getLoadingContentStyle()}>
        <DeckyLoadingBrandMark compact isLoading={!isError} providerId={isSteam ? "steam" : "retroachievements"} />
        <h1 style={getLoadingTitleStyle()}>{title}</h1>
        {!isError ? <p style={getPreparingTextStyle()}>Preparing your data. This may take a few moments.</p> : null}
        <div style={getLoadingInfoStyle()}>
          <img alt="" aria-hidden="true" src={infoIconUrl} style={getLoadingInfoIconStyle()} />
          <p style={getLoadingInfoTextStyle()}>{description}</p>
        </div>
      </div>
    </section>
  );
}
