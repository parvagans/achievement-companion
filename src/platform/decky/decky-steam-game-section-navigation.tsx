import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DeckyFullscreenActionButton, DeckyFullscreenActionRow } from "./decky-full-screen-action-controls";
import { measureSteamGameFooterLayout, STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX } from "./decky-steam-game-footer-layout";

export type DeckySteamGameSectionId = "overview" | "achievements" | "community";

export interface DeckySteamGameSection {
  readonly id: DeckySteamGameSectionId;
  readonly label: string;
}

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
    pointerEvents: "auto",
  };
}

function getSectionTabsStyle(): CSSProperties {
  return { flex: "1 1 auto", minWidth: 0 };
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
  onSelectSection,
  onHeightChange,
}: {
  readonly activeSection: DeckySteamGameSectionId;
  readonly sections: readonly DeckySteamGameSection[];
  readonly onSelectSection: (section: DeckySteamGameSectionId) => void;
  readonly onHeightChange: (height: number) => void;
}): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState({ height: STEAM_GAME_FOOTER_FALLBACK_HEIGHT_PX, zIndex: 20 });

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

  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {portalTarget !== null ? createPortal(
        <div aria-label="Steam game sections" style={getFooterStyle(layout.height, layout.zIndex)}>
          <span style={getShoulderHintStyle()}>L1</span>
          <div style={getSectionTabsStyle()}>
            <DeckyFullscreenActionRow>
              {sections.map((section) => (
                <DeckyFullscreenActionButton
                  key={section.id}
                  compact
                  label={section.label}
                  selected={activeSection === section.id}
                  onClick={() => {
                    onSelectSection(section.id);
                  }}
                />
              ))}
            </DeckyFullscreenActionRow>
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
