import { useEffect, useRef, type CSSProperties } from "react";
import retroAchievementsIconUrl from "./assets/retroachievements.svg";
import steamIconUrl from "./assets/steam.svg";
import steamDeckIconUrl from "./assets/steam-deck.svg";
import { DECKY_LOADING_COLORS } from "./decky-brand-colors";

export { DECKY_LOADING_COLORS, DECKY_LOADING_PAGE_BACKGROUND } from "./decky-brand-colors";

export type DeckyLoadingProviderId = "steam" | "retroachievements";

export function getDeckyLoadingProviderId(providerId: string | undefined): DeckyLoadingProviderId | undefined {
  return providerId === "steam" || providerId === "retroachievements" ? providerId : undefined;
}

export function getDeckyLoadingInfoCardStyle(compact = false): CSSProperties {
  return {
    border: "1px solid transparent",
    borderRadius: compact ? 10 : 12,
    background: `linear-gradient(145deg, rgba(7, 24, 40, 0.96), rgba(6, 14, 27, 0.96)) padding-box, linear-gradient(112deg, ${DECKY_LOADING_COLORS.cyan}94, ${DECKY_LOADING_COLORS.blue}6e 54%, ${DECKY_LOADING_COLORS.magenta}7a) border-box`,
    boxShadow: "0 8px 26px rgba(0, 0, 0, 0.18), 0 0 24px rgba(15, 156, 239, 0.055)",
  };
}

function getBrandMarkStyle(compact: boolean): CSSProperties {
  const size = compact ? 56 : "clamp(92px, 15vw, 132px)";
  return {
    position: "relative",
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "50%",
    background: `radial-gradient(circle at 36% 24%, rgba(22, 50, 76, 0.98), ${DECKY_LOADING_COLORS.navy} 73%)`,
    boxShadow: "0 0 34px rgba(12, 177, 238, 0.19), 0 0 48px rgba(190, 43, 221, 0.07), inset 0 0 0 1px rgba(158, 229, 255, 0.16)",
  };
}

function getBrandRingStyle(): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: `conic-gradient(from -28deg, ${DECKY_LOADING_COLORS.cyan} 0deg, ${DECKY_LOADING_COLORS.blue} 112deg, ${DECKY_LOADING_COLORS.violet} 214deg, ${DECKY_LOADING_COLORS.magenta} 280deg, rgba(27, 58, 107, 0.78) 281deg, rgba(27, 58, 107, 0.78) 360deg)`,
  };
}

function getBrandWellStyle(compact: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    inset: compact ? 6 : 9,
    borderRadius: "50%",
    background: "radial-gradient(circle at 38% 24%, #10253a, #050b14 74%)",
    boxShadow: "inset 0 0 0 1px rgba(136, 202, 241, 0.19)",
  };
}

function getDeckIconStyle(compact: boolean): CSSProperties {
  return {
    display: "block",
    width: compact ? "72%" : "74%",
    height: "auto",
    filter: "brightness(0) saturate(100%) invert(75%) sepia(90%) saturate(1724%) hue-rotate(151deg) brightness(103%) contrast(104%) drop-shadow(0 0 7px rgba(8, 213, 245, 0.32))",
  };
}

function getProviderBadgeStyle(compact: boolean): CSSProperties {
  const size = compact ? 21 : 29;
  return {
    position: "absolute",
    right: compact ? -2 : -3,
    bottom: compact ? -2 : -3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    border: "1px solid rgba(202, 230, 255, 0.62)",
    borderRadius: "50%",
    background: "linear-gradient(145deg, #13243a, #07101d)",
    boxShadow: "0 0 0 2px rgba(20, 123, 255, 0.46), 0 0 15px rgba(239, 56, 213, 0.2)",
  };
}

function getProviderIconStyle(compact: boolean): CSSProperties {
  return {
    width: compact ? 12 : 17,
    height: compact ? 12 : 17,
    objectFit: "contain",
    filter: "brightness(0) invert(1) drop-shadow(0 0 4px rgba(8, 213, 245, 0.2))",
  };
}

export function DeckyLoadingBrandMark({
  compact = false,
  isLoading = true,
  providerId,
}: {
  readonly compact?: boolean;
  readonly isLoading?: boolean;
  readonly providerId?: string | undefined;
}): JSX.Element {
  const ringRef = useRef<HTMLDivElement>(null);
  const knownProvider = getDeckyLoadingProviderId(providerId);

  useEffect(() => {
    const ring = ringRef.current;
    const ownerWindow = ring?.ownerDocument.defaultView;
    if (ring === null || ownerWindow === null || ownerWindow === undefined || !isLoading) {
      return;
    }

    const reducedMotion = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    const updateAnimation = (): void => {
      animation?.cancel();
      animation = reducedMotion.matches
        ? undefined
        : ring.animate(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 1_650, easing: "linear", iterations: Infinity },
        );
    };

    updateAnimation();
    reducedMotion.addEventListener("change", updateAnimation);
    return () => {
      reducedMotion.removeEventListener("change", updateAnimation);
      animation?.cancel();
    };
  }, [isLoading]);

  const providerIconUrl = knownProvider === "steam"
    ? steamIconUrl
    : knownProvider === "retroachievements"
      ? retroAchievementsIconUrl
      : undefined;

  return (
    <div
      aria-hidden="true"
      data-ac-loading-brand-mark="true"
      data-provider={knownProvider}
      style={getBrandMarkStyle(compact)}
    >
      <div ref={ringRef} style={getBrandRingStyle()} />
      <div style={getBrandWellStyle(compact)}>
        <img alt="" src={steamDeckIconUrl} style={getDeckIconStyle(compact)} />
      </div>
      {providerIconUrl !== undefined ? (
        <span style={getProviderBadgeStyle(compact)}>
          <img alt="" src={providerIconUrl} style={getProviderIconStyle(compact)} />
        </span>
      ) : null}
    </div>
  );
}
