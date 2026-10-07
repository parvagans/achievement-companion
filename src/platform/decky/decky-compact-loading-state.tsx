import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import infoIconUrl from "./assets/info.svg";
import { registerCompactProviderCancelCallback } from "./decky-full-screen-cancel-bridge";
import { findDeckyScrollContainerAncestor } from "./decky-scroll-viewport";
import { achievementCompanionQamTheme } from "./decky-qam-theme";

export interface DeckyCompactLoadingStateProps {
  readonly description: string;
  readonly isError: boolean;
  readonly onCancel?: (() => void) | undefined;
  readonly title: string;
  readonly steamTheme?: boolean;
}

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
    background: achievementCompanionQamTheme.surface.page,
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

function getLoadingSpinnerStyle(): CSSProperties {
  return {
    position: "relative",
    width: 56,
    height: 56,
    flexShrink: 0,
    borderRadius: "50%",
    background: achievementCompanionQamTheme.loading.spinnerSurface,
    boxShadow: `0 0 22px ${achievementCompanionQamTheme.loading.spinnerGlow}, inset 0 0 0 1px ${achievementCompanionQamTheme.loading.spinnerBorder}`,
  };
}

function getLoadingSpinnerRingStyle(): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(from -24deg, ${achievementCompanionQamTheme.color.accent} 0deg, ${achievementCompanionQamTheme.color.accentStrong} 76deg, rgba(37,85,151,.84) 77deg, rgba(27,58,107,.76) 360deg)`,
  };
}

function getLoadingIconWellStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    inset: 7,
    borderRadius: "50%",
    background: "radial-gradient(circle at 40% 30%, #112b42, #07131f 72%)",
    boxShadow: "inset 0 0 0 1px rgba(115, 192, 239, 0.18)",
  };
}

function getLoadingIconStyle(): CSSProperties {
  return {
    width: "46%",
    height: "46%",
    filter: "brightness(0) saturate(100%) invert(68%) sepia(79%) saturate(1428%) hue-rotate(161deg) brightness(101%) contrast(102%) drop-shadow(0 0 8px rgba(41, 196, 246, 0.36))",
  };
}

function getLoadingTitleStyle(): CSSProperties {
  return {
    margin: 0,
    color: achievementCompanionQamTheme.color.textPrimary,
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
    border: `1px solid ${achievementCompanionQamTheme.loading.infoBorder}`,
    borderRadius: achievementCompanionQamTheme.radius.medium,
    textAlign: "left",
    background: achievementCompanionQamTheme.loading.infoSurface,
  };
}

function getLoadingInfoIconStyle(): CSSProperties {
  return {
    position: "absolute",
    left: 11,
    width: 18,
    height: 18,
    filter: "brightness(0) saturate(100%) invert(68%) sepia(79%) saturate(1428%) hue-rotate(161deg) brightness(101%) contrast(102%)",
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
  const spinnerRef = useRef<HTMLDivElement>(null);
  const [visibleHeight, setVisibleHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(
    () => onCancel === undefined ? undefined : registerCompactProviderCancelCallback(surfaceRef.current, onCancel),
    [onCancel],
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

  useEffect(() => {
    const spinner = spinnerRef.current;
    const ownerWindow = spinner?.ownerDocument.defaultView;
    if (spinner === null || ownerWindow === null || ownerWindow === undefined || isError) {
      return;
    }

    const reducedMotion = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    const updateAnimation = (): void => {
      animation?.cancel();
      animation = reducedMotion.matches
        ? undefined
        : spinner.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 1_450, easing: "linear", iterations: Infinity },
        );
    };

    updateAnimation();
    reducedMotion.addEventListener("change", updateAnimation);
    return () => {
      reducedMotion.removeEventListener("change", updateAnimation);
      animation?.cancel();
    };
  }, [isError]);

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
        <div aria-hidden="true" style={getLoadingSpinnerStyle()}>
          <div ref={spinnerRef} style={getLoadingSpinnerRingStyle()} />
          <div style={getLoadingIconWellStyle()}>
            <svg aria-hidden="true" viewBox="0 0 24 24" style={getLoadingIconStyle()}>
              <path
                fill={achievementCompanionQamTheme.color.accent}
                d="M6.2 3.5h11.6v3.9a5.8 5.8 0 0 1-4.3 5.6v2.1h2.2a1.1 1.1 0 0 1 0 2.2H8.3a1.1 1.1 0 0 1 0-2.2h2.2V13a5.8 5.8 0 0 1-4.3-5.6V3.5Zm-2.7 2h2v2.1a3.3 3.3 0 0 0 1.1 2.5A5.9 5.9 0 0 1 4 9.3a3.7 3.7 0 0 1-.5-1.8V5.5Zm15 0h2v2a3.7 3.7 0 0 1-.5 1.8 5.9 5.9 0 0 1-2.6.8 3.3 3.3 0 0 0 1.1-2.5V5.5Z"
              />
            </svg>
          </div>
        </div>
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
