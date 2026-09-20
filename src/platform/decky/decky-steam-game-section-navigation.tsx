import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { GamepadEvent } from "@decky/ui";
import { markDeckyFullscreenReturnRequested } from "./decky-full-screen-return-context";
import { consumeDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { measureSteamGameFooterLayout, STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX } from "./decky-steam-game-footer-layout";
import { handleSteamGameShoulderButtonDown } from "./decky-steam-game-shoulder-navigation";

export type DeckySteamGameSectionId = "overview" | "achievements" | "achievement-groups" | "community";

export interface DeckySteamGameSection {
  readonly id: DeckySteamGameSectionId;
  readonly label: string;
}

type CancelableGamepadEvent = Event & {
  readonly preventDefault?: () => void;
  readonly stopPropagation?: () => void;
  readonly stopImmediatePropagation?: () => void;
};

function getFooterStyle(height: number, zIndex: number): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    height,
    padding: "3px 12px",
    minWidth: 0,
    boxSizing: "border-box",
    borderTop: "1px solid rgba(125, 190, 255, 0.24)",
    background: "linear-gradient(180deg, #09151f, #050e16)",
    fontSize: 14,
    boxShadow: "0 -10px 28px rgba(0, 0, 0, 0.3)",
    position: "fixed",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex,
    // Section changes are intentionally controller-only through L1/R1.
    pointerEvents: "none",
  };
}

function getSectionTabsStyle(): CSSProperties {
  return {
    display: "flex",
    flex: "1 1 auto",
    gap: 6,
    minWidth: 0,
  };
}

function getSectionTabStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 0",
    minWidth: 0,
    minHeight: 30,
    padding: "3px 10px",
    border: `1px solid ${active ? "rgba(105, 176, 255, 0.72)" : "rgba(255, 255, 255, 0.12)"}`,
    borderRadius: 999,
    background: active
      ? "linear-gradient(180deg, rgba(74, 138, 204, 0.34), rgba(34, 79, 124, 0.3))"
      : "rgba(255, 255, 255, 0.035)",
    boxShadow: active ? "0 0 0 1px rgba(73, 155, 255, 0.32)" : "none",
    color: active ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.68)",
    fontSize: 12,
    fontWeight: active ? 800 : 700,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  };
}

function getLegendStyle(): CSSProperties {
  return {
    flex: "0 0 auto",
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: "0.76em",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function getShoulderHintStyle(): CSSProperties {
  return {
    ...getLegendStyle(),
    padding: "3px 5px",
    border: "1px solid rgba(255, 255, 255, 0.26)",
    borderRadius: 6,
    color: "rgba(255, 255, 255, 0.9)",
  };
}

function getActionLegendStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
    minWidth: 0,
  };
}

function getActionHintStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: "0.76em",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function getActionButtonHintStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.9)",
    color: "rgba(8, 18, 27, 1)",
    fontSize: "0.8em",
    fontWeight: 900,
  };
}

function DeckySteamGameActionHint({ button, label }: { readonly button: string; readonly label: string }): JSX.Element {
  return (
    <span style={getActionHintStyle()}>
      <span style={getActionButtonHintStyle()}>{button}</span>
      <span>{label}</span>
    </span>
  );
}

export function DeckySteamGameSectionNavigation({
  activeSection,
  sections,
  onPreviousSection,
  onNextSection,
  onBack,
  onHeightChange,
}: {
  readonly activeSection: DeckySteamGameSectionId;
  readonly sections: readonly DeckySteamGameSection[];
  readonly onPreviousSection: () => void;
  readonly onNextSection: () => void;
  readonly onBack: () => void;
  readonly onHeightChange: (height: number) => void;
}): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const onBackRef = useRef(onBack);
  const onPreviousSectionRef = useRef(onPreviousSection);
  const onNextSectionRef = useRef(onNextSection);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState({ height: STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX, zIndex: 20 });

  useLayoutEffect(() => {
    onBackRef.current = onBack;
    onPreviousSectionRef.current = onPreviousSection;
    onNextSectionRef.current = onNextSection;
  }, [onBack, onNextSection, onPreviousSection]);

  useLayoutEffect(() => {
    // The plugin executes in SharedJSContext; its global document is NOT the
    // Gaming Mode window. Anchor both the portal and measurements to the route.
    const ownerDocument = anchorRef.current?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (ownerDocument === undefined || ownerWindow === undefined || ownerWindow === null) {
      return;
    }
    const target = ownerDocument.createElement("div");
    target.dataset["achievementCompanionSteamGameFooterOverlay"] = "true";
    const updateLayout = (): void => {
      const measured = measureSteamGameFooterLayout(ownerDocument, target);
      setLayout(measured);
      onHeightChange(measured.height);
    };
    updateLayout();
    ownerDocument.body.appendChild(target);
    setPortalTarget(target);
    ownerWindow.addEventListener("resize", updateLayout);

    return () => {
      ownerWindow.removeEventListener("resize", updateLayout);
      target.remove();
    };
  }, [onHeightChange]);

  useLayoutEffect(() => {
    const ownerWindow = anchorRef.current?.ownerDocument.defaultView;
    if (ownerWindow === undefined || ownerWindow === null) {
      return;
    }

    // Raw SteamClient controller subscriptions only observe input. GamepadUI's
    // route event is cancelable, so one press changes one section and cannot
    // also activate Steam's global chrome after the old section unmounts.
    const onButtonDown = (event: Event): void => {
      handleSteamGameShoulderButtonDown(event as GamepadEvent, {
        onPreviousSection: () => onPreviousSectionRef.current(),
        onNextSection: () => onNextSectionRef.current(),
      });
    };
    ownerWindow.addEventListener("vgp_onbuttondown", onButtonDown, true);

    // The overlay replaces Steam's visual Back legend, so it provides the
    // equivalent controller behavior for every focused child on this route.
    const onCancel = (event: Event): void => {
      const cancelEvent = event as CancelableGamepadEvent;
      if (consumeDeckyFullscreenPopupCancel()) {
        cancelEvent.preventDefault?.();
        cancelEvent.stopPropagation?.();
        cancelEvent.stopImmediatePropagation?.();
        return;
      }
      cancelEvent.preventDefault?.();
      cancelEvent.stopPropagation?.();
      cancelEvent.stopImmediatePropagation?.();
      markDeckyFullscreenReturnRequested();
      onBackRef.current();
    };
    ownerWindow.addEventListener("vgp_oncancel", onCancel, true);
    return () => {
      ownerWindow.removeEventListener("vgp_onbuttondown", onButtonDown, true);
      ownerWindow.removeEventListener("vgp_oncancel", onCancel, true);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {portalTarget !== null ? createPortal(
        <div aria-label="Steam game sections" style={getFooterStyle(layout.height, layout.zIndex)}>
          <span style={getShoulderHintStyle()}>L1</span>
          <div style={getSectionTabsStyle()}>
            {sections.map((section) => (
              <span key={section.id} style={getSectionTabStyle(activeSection === section.id)}>
                {section.label}
              </span>
            ))}
          </div>
          <span style={getShoulderHintStyle()}>R1</span>
          <span style={getActionLegendStyle()}>
            <DeckySteamGameActionHint button="A" label="Select" />
            <DeckySteamGameActionHint button="B" label="Back" />
          </span>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}
