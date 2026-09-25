import { useEffect, useRef, type CSSProperties } from "react";
import infoIconUrl from "./assets/info.svg";

const FULL_SCREEN_LOADING_FONT_FAMILY = '"Motiva Sans", "Noto Sans", system-ui, sans-serif';
const FULL_SCREEN_LOADING_TITLE_FONT_SIZE = "clamp(1.25rem, 2.4vw, 2rem)";
const FULL_SCREEN_LOADING_BODY_FONT_SIZE = "clamp(0.82rem, 1.5vw, 1.05rem)";

export interface DeckyFullScreenLoadingStateProps {
  readonly description: string;
  readonly isError: boolean;
  readonly title: string;
}

export function getDeckyFullScreenLoadingPageStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    minHeight: 0,
    // Route wrappers use this surface too. Keep it padding-free so the
    // loading frame below is the sole vertical-positioning authority.
    padding: 0,
    boxSizing: "border-box",
    overflow: "hidden",
    color: "rgba(245, 250, 255, 0.98)",
    fontFamily: FULL_SCREEN_LOADING_FONT_FAMILY,
    background:
      "radial-gradient(ellipse at 79% 13%, rgba(218, 70, 241, 0.28), transparent 37%), radial-gradient(ellipse at 20% 82%, rgba(27, 161, 255, 0.25), transparent 42%), radial-gradient(ellipse at 50% 34%, rgba(0, 224, 239, 0.16), transparent 40%), linear-gradient(135deg, #06111e 0%, #0a2855 48%, #251148 100%)",
  };
}

function getLoadingFrameStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    minHeight: 0,
    padding: "clamp(12px, 2vh, 24px) clamp(16px, 5vw, 72px)",
    boxSizing: "border-box",
    textAlign: "center",
    fontFamily: FULL_SCREEN_LOADING_FONT_FAMILY,
  };
}

function getLoadingContentStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 840,
  };
}

function getLoadingSpinnerStyle(): CSSProperties {
  return {
    position: "relative",
    width: "clamp(92px, 15vw, 132px)",
    height: "clamp(92px, 15vw, 132px)",
    borderRadius: "50%",
    background: "rgba(7, 25, 40, 0.96)",
    boxShadow: "0 0 32px rgba(25, 178, 241, 0.2), inset 0 0 0 1px rgba(151, 225, 255, 0.16)",
  };
}

function getLoadingSpinnerRingStyle(): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(from -24deg, #1cbcf1 0deg, #18a9e4 76deg, rgba(37, 85, 151, 0.84) 77deg, rgba(27, 58, 107, 0.76) 360deg)",
  };
}

function getLoadingIconWellStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    inset: 9,
    borderRadius: "50%",
    background: "radial-gradient(circle at 40% 30%, #112b42, #07131f 72%)",
    boxShadow: "inset 0 0 0 1px rgba(115, 192, 239, 0.18)",
  };
}

function getLoadingIconStyle(): CSSProperties {
  return {
    width: "46%",
    height: "46%",
    filter: "brightness(0) saturate(100%) invert(68%) sepia(79%) saturate(1428%) hue-rotate(161deg) brightness(101%) contrast(102%) drop-shadow(0 0 10px rgba(41, 196, 246, 0.36))",
  };
}

function getLoadingTitleStyle(): CSSProperties {
  return {
    margin: 0,
    color: "rgba(247, 250, 255, 0.99)",
    fontSize: FULL_SCREEN_LOADING_TITLE_FONT_SIZE,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1.08,
  };
}

function getLoadingInfoStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
    minHeight: 42,
    padding: "8px 48px",
    boxSizing: "border-box",
    border: "1px solid rgba(72, 155, 222, 0.28)",
    borderRadius: 12,
    textAlign: "center",
    background: "linear-gradient(135deg, rgba(17, 37, 57, 0.9), rgba(12, 27, 43, 0.78))",
  };
}

function getLoadingInfoIconStyle(): CSSProperties {
  return {
    position: "absolute",
    left: 14,
    width: 22,
    height: 22,
    filter: "brightness(0) saturate(100%) invert(68%) sepia(79%) saturate(1428%) hue-rotate(161deg) brightness(101%) contrast(102%)",
  };
}

function getLoadingInfoTextStyle(): CSSProperties {
  return { margin: 0, color: "rgba(188, 216, 242, 0.92)", fontSize: "clamp(0.78rem, 1.35vw, 1rem)", lineHeight: 1.25 };
}

export function DeckyFullScreenLoadingState({
  description,
  isError,
  title,
}: DeckyFullScreenLoadingStateProps): JSX.Element {
  const spinnerRef = useRef<HTMLDivElement>(null);

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
      role={isError ? "alert" : "status"}
      style={{ ...getDeckyFullScreenLoadingPageStyle(), ...getLoadingFrameStyle() }}
    >
      <div style={getLoadingContentStyle()}>
        <div aria-hidden="true" style={getLoadingSpinnerStyle()}>
          <div ref={spinnerRef} style={getLoadingSpinnerRingStyle()} />
          <div style={getLoadingIconWellStyle()}>
            <svg aria-hidden="true" viewBox="0 0 24 24" style={getLoadingIconStyle()}>
              <path
                fill="#2bc3f2"
                d="M6.2 3.5h11.6v3.9a5.8 5.8 0 0 1-4.3 5.6v2.1h2.2a1.1 1.1 0 0 1 0 2.2H8.3a1.1 1.1 0 0 1 0-2.2h2.2V13a5.8 5.8 0 0 1-4.3-5.6V3.5Zm-2.7 2h2v2.1a3.3 3.3 0 0 0 1.1 2.5A5.9 5.9 0 0 1 4 9.3a3.7 3.7 0 0 1-.5-1.8V5.5Zm15 0h2v2a3.7 3.7 0 0 1-.5 1.8 5.9 5.9 0 0 1-2.6.8 3.3 3.3 0 0 0 1.1-2.5V5.5Z"
              />
            </svg>
          </div>
        </div>
        <h1 style={getLoadingTitleStyle()}>{title}</h1>
        <p style={{ margin: "-5px 0 0", color: "#b8d8f3", fontSize: FULL_SCREEN_LOADING_BODY_FONT_SIZE, lineHeight: 1.2 }}>Preparing your data. This may take a few moments.</p>
        <div style={getLoadingInfoStyle()}>
          <img alt="" aria-hidden="true" src={infoIconUrl} style={getLoadingInfoIconStyle()} />
          <p style={getLoadingInfoTextStyle()}>{description}</p>
        </div>
      </div>
    </section>
  );
}
