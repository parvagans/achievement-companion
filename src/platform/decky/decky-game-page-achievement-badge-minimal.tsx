import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { GamePageAchievementBadgeSize } from "@core/settings";
import crownLaurelIconUrl from "./assets/achievement-badge/crown-laurel.svg";
import beatenFlagIconUrl from "./assets/flag.svg";
import type { DeckyGamePageAchievementBadgePresentation } from "./decky-game-page-achievement-badge-presentation";
import { resolveDeckyGamePageAchievementBadgeProviderIconUrl } from "./decky-game-page-achievement-badge-theme";
import {
  MINIMAL_GAME_PAGE_BADGE_DIMENSIONS,
  resolveMinimalGamePageBadgeStatusIcon,
  type MinimalGamePageBadgeDimensions,
} from "./decky-game-page-achievement-badge-minimal-model";

function getMinimalBadgeShellStyle(
  focused: boolean,
  dimensions: MinimalGamePageBadgeDimensions,
): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    width: dimensions.width,
    height: dimensions.height,
    padding: `0 ${String(dimensions.padding)}px`,
    gap: dimensions.gap,
    boxSizing: "border-box",
    border: `1px solid ${focused ? "rgba(235,235,235,.62)" : "rgba(190,190,190,.32)"}`,
    borderRadius: 8,
    background: focused ? "rgba(23,29,37,.95)" : "rgba(15,20,27,.90)",
    color: "#f5f5f5",
    fontFamily: '"Motiva Sans", Arial, sans-serif',
    fontSize: dimensions.font,
    lineHeight: 1,
    fontWeight: 600,
    letterSpacing: ".02em",
    pointerEvents: "none",
    transition: "background-color 120ms ease-out, border-color 120ms ease-out",
  };
}

function renderMinimalStatusIcon(
  presentation: DeckyGamePageAchievementBadgePresentation,
  dimensions: MinimalGamePageBadgeDimensions,
): ReactNode {
  const icon = resolveMinimalGamePageBadgeStatusIcon(presentation.variant);
  if (icon === "crown-laurel") {
    return (
      <img
        alt=""
        aria-hidden="true"
        data-ac-game-page-badge-status-icon="crown-laurel"
        src={crownLaurelIconUrl}
        width={dimensions.statusIcon}
        height={dimensions.statusIcon}
        style={{
          display: "block",
          width: dimensions.statusIcon,
          height: dimensions.statusIcon,
          flex: `0 0 ${String(dimensions.statusIcon)}px`,
          objectFit: "contain",
          filter: "brightness(0) invert(1)",
          clipPath: "inset(8% 8% 6%)",
          transform: "scale(1.22)",
          transformOrigin: "center",
        }}
      />
    );
  }

  if (icon === "flag") {
    return (
      <img
        alt=""
        aria-hidden="true"
        data-ac-game-page-badge-status-icon="flag"
        src={beatenFlagIconUrl}
        width={dimensions.statusIcon}
        height={dimensions.statusIcon}
        style={{
          display: "block",
          width: dimensions.statusIcon,
          height: dimensions.statusIcon,
          flex: `0 0 ${String(dimensions.statusIcon)}px`,
          objectFit: "contain",
          filter: "grayscale(1) invert(1)",
        }}
      />
    );
  }

  return null;
}

export function DeckyGamePageAchievementBadgeMinimal({
  focused,
  presentation,
  size,
}: {
  readonly focused: boolean;
  readonly presentation: DeckyGamePageAchievementBadgePresentation;
  readonly size: GamePageAchievementBadgeSize;
}): JSX.Element {
  const loadingLabelRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (presentation.variant !== "loading") return;
    const label = loadingLabelRef.current;
    const ownerWindow = label?.ownerDocument.defaultView;
    if (label === null || ownerWindow === null || ownerWindow === undefined) return;

    const reducedMotion = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    const updateAnimation = (): void => {
      animation?.cancel();
      animation = reducedMotion.matches
        ? undefined
        : label.animate(
          [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }],
          { duration: 1_800, easing: "ease-in-out", iterations: Infinity },
        );
    };

    updateAnimation();
    reducedMotion.addEventListener("change", updateAnimation);
    return () => {
      reducedMotion.removeEventListener("change", updateAnimation);
      animation?.cancel();
    };
  }, [presentation.variant]);

  const dimensions = MINIMAL_GAME_PAGE_BADGE_DIMENSIONS[size];
  const providerIconUrl = resolveDeckyGamePageAchievementBadgeProviderIconUrl(
    presentation.provider,
    presentation.variant,
  );
  const statusIcon = renderMinimalStatusIcon(presentation, dimensions);

  return (
    <span
      aria-hidden="true"
      data-ac-game-page-badge-style="minimal"
      data-ac-game-page-badge-variant={presentation.variant}
      data-ac-game-page-badge-size={size}
      style={getMinimalBadgeShellStyle(focused, dimensions)}
    >
      <img
        alt=""
        aria-hidden="true"
        data-ac-game-page-badge-provider-icon={
          presentation.variant === "loading" ? "info" : presentation.provider
        }
        src={providerIconUrl}
        width={dimensions.providerIcon}
        height={dimensions.providerIcon}
        style={{
          display: "block",
          width: dimensions.providerIcon,
          height: dimensions.providerIcon,
          flex: `0 0 ${String(dimensions.providerIcon)}px`,
          objectFit: "contain",
          filter: "grayscale(1) brightness(0) invert(1)",
        }}
      />
      {statusIcon}
      <span
        ref={loadingLabelRef}
        data-ac-game-page-badge-loading-label={
          presentation.variant === "loading" ? "true" : undefined
        }
        style={{ minWidth: 0, whiteSpace: "nowrap", color: "#f5f5f5" }}
      >
        {presentation.statusLabel}
      </span>
      <span
        style={{
          marginLeft: "auto",
          flex: "0 0 auto",
          whiteSpace: "nowrap",
          color: "#c7c7c7",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {presentation.countLabel.replace(/\s/gu, "")}
      </span>
    </span>
  );
}
