import { useEffect, useRef, type CSSProperties } from "react";
import infoIconUrl from "./assets/info.svg";
import trophyIconUrl from "./assets/trophy-filled.svg";

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
    padding: "clamp(18px, 3.5vh, 38px) clamp(20px, 4vw, 54px)",
    boxSizing: "border-box",
    overflow: "hidden",
    color: "rgba(245, 250, 255, 0.98)",
    background:
      "radial-gradient(ellipse at 76% 18%, rgba(42, 116, 172, 0.18), transparent 39%), radial-gradient(circle at 16% 80%, rgba(23, 91, 148, 0.14), transparent 34%), linear-gradient(135deg, #06111b 0%, #091827 52%, #06101a 100%)",
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
    padding: "clamp(72px, 13vh, 116px) clamp(20px, 8vw, 112px)",
    boxSizing: "border-box",
    textAlign: "center",
  };
}

function getLoadingContentStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 22,
    width: "100%",
    maxWidth: 680,
  };
}

function getLoadingSpinnerStyle(): CSSProperties {
  return {
    position: "relative",
    width: "clamp(112px, 18vw, 154px)",
    height: "clamp(112px, 18vw, 154px)",
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
    fontSize: "clamp(1.5rem, 3.2vw, 2.35rem)",
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
    padding: "13px 20px",
    boxSizing: "border-box",
    border: "1px solid rgba(72, 155, 222, 0.28)",
    borderRadius: 16,
    textAlign: "center",
    background: "linear-gradient(135deg, rgba(17, 37, 57, 0.9), rgba(12, 27, 43, 0.78))",
  };
}

function getLoadingInfoIconStyle(): CSSProperties {
  return {
    position: "absolute",
    left: 20,
    width: 30,
    height: 30,
    filter: "brightness(0) saturate(100%) invert(68%) sepia(79%) saturate(1428%) hue-rotate(161deg) brightness(101%) contrast(102%)",
  };
}

function getLoadingInfoTextStyle(): CSSProperties {
  return { margin: 0, color: "rgba(188, 216, 242, 0.92)", fontSize: "0.95rem", lineHeight: 1.35 };
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
      style={getLoadingFrameStyle()}
    >
      <div style={getLoadingContentStyle()}>
        <div aria-hidden="true" style={getLoadingSpinnerStyle()}>
          <div ref={spinnerRef} style={getLoadingSpinnerRingStyle()} />
          <div style={getLoadingIconWellStyle()}>
            <img alt="" src={trophyIconUrl} style={getLoadingIconStyle()} />
          </div>
        </div>
        <h1 style={getLoadingTitleStyle()}>{title}</h1>
        <div style={getLoadingInfoStyle()}>
          <img alt="" aria-hidden="true" src={infoIconUrl} style={getLoadingInfoIconStyle()} />
          <p style={getLoadingInfoTextStyle()}>{description}</p>
        </div>
      </div>
    </section>
  );
}
