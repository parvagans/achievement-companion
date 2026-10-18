import { useEffect, useRef, type CSSProperties } from "react";
import retroAchievementsIconUrl from "./assets/retroachievements.svg";
import steamIconUrl from "./assets/steam.svg";
import steamDeckIconUrl from "./assets/steam-deck.svg";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";

export { DECKY_LOADING_COLORS, DECKY_LOADING_PAGE_BACKGROUND } from "./decky-brand-colors";

export type DeckyLoadingProviderId = "steam" | "retroachievements";

export function getDeckyLoadingProviderId(providerId: string | undefined): DeckyLoadingProviderId | undefined {
  return providerId === "steam" || providerId === "retroachievements" ? providerId : undefined;
}

export function getDeckyLoadingInfoCardStyle(compact = false): CSSProperties {
  return {
    border: "1px solid transparent",
    borderRadius: compact ? 10 : 12,
    background: qamTheme.loading.infoBackground,
    boxShadow: qamTheme.loading.infoShadow,
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
    background: qamTheme.loading.markBackground,
    boxShadow: qamTheme.loading.markShadow,
  };
}

function getBrandRingStyle(): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: qamTheme.loading.ring,
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
    background: qamTheme.loading.well,
    boxShadow: `inset 0 0 0 1px ${qamTheme.loading.wellBorder}`,
  };
}

function getDeckIconStyle(compact: boolean): CSSProperties {
  return {
    display: "block",
    width: compact ? "72%" : "74%",
    height: "auto",
    filter: qamTheme.loading.deckIconFilter,
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
    border: `1px solid ${qamTheme.loading.badgeBorder}`,
    borderRadius: "50%",
    background: qamTheme.loading.badgeBackground,
    boxShadow: qamTheme.loading.badgeShadow,
  };
}

function getProviderIconStyle(compact: boolean): CSSProperties {
  return {
    width: compact ? 12 : 17,
    height: compact ? 12 : 17,
    objectFit: "contain",
    filter: qamTheme.loading.providerIconFilter,
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
