import type { CSSProperties } from "react";
import infoIconUrl from "./assets/info.svg";
import {
  DECKY_LOADING_COLORS,
  DECKY_LOADING_PAGE_BACKGROUND,
  DeckyLoadingBrandMark,
  getDeckyLoadingProviderId,
  getDeckyLoadingInfoCardStyle,
} from "./decky-loading-brand";

const FULL_SCREEN_LOADING_FONT_FAMILY = '"Motiva Sans", "Noto Sans", system-ui, sans-serif';
const FULL_SCREEN_LOADING_TITLE_FONT_SIZE = "clamp(1.25rem, 2.4vw, 2rem)";
const FULL_SCREEN_LOADING_BODY_FONT_SIZE = "clamp(0.82rem, 1.5vw, 1.05rem)";

export interface DeckyFullScreenLoadingStateProps {
  readonly description: string;
  readonly isError: boolean;
  readonly title: string;
  readonly providerId?: string | undefined;
  readonly useSteamTheme?: boolean;
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
    background: DECKY_LOADING_PAGE_BACKGROUND,
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

function getLoadingTitleStyle(): CSSProperties {
  return {
    margin: 0,
    color: DECKY_LOADING_COLORS.text,
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
    ...getDeckyLoadingInfoCardStyle(),
    textAlign: "center",
  };
}

function getLoadingInfoIconStyle(): CSSProperties {
  return {
    position: "absolute",
    left: 14,
    width: 22,
    height: 22,
    filter: "brightness(0) saturate(100%) invert(75%) sepia(90%) saturate(1724%) hue-rotate(151deg) brightness(103%) contrast(104%)",
  };
}

function getLoadingInfoTextStyle(): CSSProperties {
  return { margin: 0, color: DECKY_LOADING_COLORS.muted, fontSize: "clamp(0.78rem, 1.35vw, 1rem)", lineHeight: 1.25 };
}

export function DeckyFullScreenLoadingState({
  description,
  isError,
  title,
  providerId,
  useSteamTheme = false,
}: DeckyFullScreenLoadingStateProps): JSX.Element {
  const loadingProviderId = getDeckyLoadingProviderId(providerId) ?? (useSteamTheme ? "steam" : undefined);

  return (
    <section
      aria-busy={!isError}
      aria-label={title}
      aria-live="polite"
      data-achievement-companion-full-screen-loading-state="true"
      role={isError ? "alert" : "status"}
      {...(loadingProviderId === "steam" ? { "data-ac-steam-theme": "fullscreen" } : loadingProviderId === "retroachievements" ? { "data-ac-ra-theme": "fullscreen" } : {})}
      style={{ ...getDeckyFullScreenLoadingPageStyle(), ...getLoadingFrameStyle() }}
    >
      <div style={getLoadingContentStyle()}>
        <DeckyLoadingBrandMark isLoading={!isError} providerId={loadingProviderId} />
        <h1 style={getLoadingTitleStyle()}>{title}</h1>
        {!isError ? (
          <p style={{ margin: "-5px 0 0", color: DECKY_LOADING_COLORS.muted, fontSize: FULL_SCREEN_LOADING_BODY_FONT_SIZE, lineHeight: 1.2 }}>
            Preparing your data. This may take a few moments.
          </p>
        ) : null}
        <div style={getLoadingInfoStyle()}>
          <img alt="" aria-hidden="true" src={infoIconUrl} style={getLoadingInfoIconStyle()} />
          <p style={getLoadingInfoTextStyle()}>{description}</p>
        </div>
      </div>
    </section>
  );
}
