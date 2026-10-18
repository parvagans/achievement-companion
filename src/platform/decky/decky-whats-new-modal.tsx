import {
  ConfirmModal,
  Focusable,
  GamepadButton,
  Navigation as DeckyNavigation,
  showModal,
  type GamepadEvent,
} from "@decky/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { APP_VERSION } from "../../generated/version";
import githubInvertocatBlackUrl from "./assets/brand/github-invertocat-black.svg";
import githubInvertocatWhiteUrl from "./assets/brand/github-invertocat-white.svg";
import kofiSymbolUrl from "./assets/brand/kofi-symbol.svg";
import { applyAchievementCompanionTheme } from "./decky-theme-palette";
import { readDeckySettings } from "./decky-settings";
import { takeDeckySteamGamepadFocus } from "./decky-steam-gamepad-focus";
import { playDeckySteamNavigationSound } from "./decky-steam-navigation-sound";
import { WHATS_NEW_SECTIONS } from "./decky-whats-new-content";
import { steamTheme } from "./steam-theme";

const GITHUB_URL = "https://github.com/parvagans/achievement-companion";
const KOFI_URL = "https://ko-fi.com/parvagans";
const NOTES_VIEWPORT_HEIGHT_PX = 120;
const NOTES_SCROLL_STEP_PX = 48;

function hasLightForeground(color: string): boolean {
  const value = color.trim();
  const hex = /^#([\da-f]{6})$/iu.exec(value)?.[1];
  const rgb = hex !== undefined
    ? [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)]
    : /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/iu.exec(value)?.slice(1, 4).map(Number);
  if (rgb === undefined) return true;
  const [red = 255, green = 255, blue = 255] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue >= 0.5;
}

function WhatsNewContent({ onOpenExternalUrl }: {
  readonly onOpenExternalUrl: (url: string) => void;
}): JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [focusedTab, setFocusedTab] = useState<number | undefined>(undefined);
  const [focusedSupportAction, setFocusedSupportAction] = useState<string>();
  const [hoveredSupportAction, setHoveredSupportAction] = useState<string>();
  const [githubIconUrl, setGithubIconUrl] = useState(githubInvertocatWhiteUrl);
  const activeSection = WHATS_NEW_SECTIONS[activeTab] ?? WHATS_NEW_SECTIONS[0];

  useEffect(() => {
    const ownerDocument = contentRef.current?.ownerDocument;
    if (ownerDocument !== undefined) {
      applyAchievementCompanionTheme(ownerDocument, readDeckySettings().theme);
      const foreground = ownerDocument.defaultView
        ?.getComputedStyle(ownerDocument.documentElement)
        .getPropertyValue("--ac-text-primary") ?? "";
      setGithubIconUrl(hasLightForeground(foreground) ? githubInvertocatWhiteUrl : githubInvertocatBlackUrl);
    }
  }, []);

  useEffect(() => {
    if (notesRef.current !== null) notesRef.current.scrollTop = 0;
  }, [activeTab]);

  const consumeDirection = (event: GamepadEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const focusAndConsume = (event: GamepadEvent, target: HTMLElement | null): boolean => {
    if (target === null || !takeDeckySteamGamepadFocus(target)) return false;
    consumeDirection(event);
    playDeckySteamNavigationSound(target.ownerDocument);
    return true;
  };

  const handleTabDirection = (index: number, event: GamepadEvent): void => {
    const notes = notesRef.current;
    const button = event.detail.button;
    const content = contentRef.current;
    if (notes === null || content === null) return;

    if (button === GamepadButton.DIR_LEFT || button === GamepadButton.DIR_RIGHT) {
      const targetIndex = index + (button === GamepadButton.DIR_RIGHT ? 1 : -1);
      focusAndConsume(
        event,
        content.querySelector<HTMLElement>(`[data-ac-whats-new-tab="${targetIndex}"]`),
      );
      return;
    }

    if (button !== GamepadButton.DIR_UP && button !== GamepadButton.DIR_DOWN) return;
    const maxScrollTop = Math.max(0, notes.scrollHeight - notes.clientHeight);
    const movingDown = button === GamepadButton.DIR_DOWN;
    const canScroll = movingDown ? notes.scrollTop < maxScrollTop - 1 : notes.scrollTop > 1;
    if (canScroll) {
      notes.scrollTop = Math.max(
        0,
        Math.min(maxScrollTop, notes.scrollTop + (movingDown ? NOTES_SCROLL_STEP_PX : -NOTES_SCROLL_STEP_PX)),
      );
      consumeDirection(event);
      return;
    }

    if (!movingDown) return;
    const source = content.querySelector<HTMLElement>(`[data-ac-whats-new-tab="${index}"]`);
    const supportActions = [...content.querySelectorAll<HTMLElement>("[data-ac-whats-new-support-action]")];
    if (source === null || supportActions.length === 0) return;
    const sourceCenter = source.getBoundingClientRect().left + source.getBoundingClientRect().width / 2;
    const target = supportActions.reduce((nearest, candidate) => {
      const nearestCenter = nearest.getBoundingClientRect().left + nearest.getBoundingClientRect().width / 2;
      const candidateCenter = candidate.getBoundingClientRect().left + candidate.getBoundingClientRect().width / 2;
      return Math.abs(candidateCenter - sourceCenter) < Math.abs(nearestCenter - sourceCenter) ? candidate : nearest;
    });
    focusAndConsume(event, target);
  };

  const supportActions = [
    { key: "github", label: "Star on GitHub", url: GITHUB_URL, icon: githubIconUrl, iconStyle: githubIconStyle },
    { key: "kofi", label: "Support on Ko-fi", url: KOFI_URL, icon: kofiSymbolUrl, iconStyle: kofiIconStyle },
  ] as const;

  return (
    <div
      ref={contentRef}
      data-achievement-companion-whats-new="true"
      style={{
        color: steamTheme.color.textPrimary,
        fontFamily: steamTheme.type.fontFamily,
        fontSize: steamTheme.type.fullscreen.body,
        width: "min(100%, 780px)",
      }}
    >
      <style>{`
        [data-achievement-companion-whats-new="true"] [data-ac-whats-new-notes="true"]::-webkit-scrollbar {
          width: 8px;
        }
        [data-achievement-companion-whats-new="true"] [data-ac-whats-new-notes="true"]::-webkit-scrollbar-track {
          background: ${steamTheme.surface.progressTrack};
          border-radius: ${steamTheme.radius.pill}px;
        }
        [data-achievement-companion-whats-new="true"] [data-ac-whats-new-notes="true"]::-webkit-scrollbar-thumb {
          background: ${steamTheme.color.accent};
          border-radius: ${steamTheme.radius.pill}px;
        }
      `}</style>
      <div style={{ color: steamTheme.color.textSecondary, marginBottom: steamTheme.space.md }}>
        Achievement Companion v{APP_VERSION} · Recent changes
      </div>
      <Focusable
        flow-children="left-right"
        noFocusRing
        tabIndex={-1}
        role="tablist"
        aria-label="Recent changes"
        style={{ display: "flex", gap: steamTheme.space.sm, marginBottom: steamTheme.space.md }}
      >
        {WHATS_NEW_SECTIONS.map((section, index) => (
          <Focusable
            key={section.title}
            noFocusRing
            role="tab"
            data-ac-whats-new-tab={index}
            aria-selected={activeTab === index}
            aria-label={section.title}
            tabIndex={0}
            preferredFocus={index === 0}
            onGamepadDirection={(event) => handleTabDirection(index, event)}
            onActivate={() => setActiveTab(index)}
            onClick={() => setActiveTab(index)}
            onFocus={() => { setFocusedTab(index); setActiveTab(index); }}
            onGamepadFocus={() => { setFocusedTab(index); setActiveTab(index); }}
            onBlur={() => setFocusedTab((current) => current === index ? undefined : current)}
            onGamepadBlur={() => setFocusedTab((current) => current === index ? undefined : current)}
            style={{
              ...tabStyle,
              borderColor: focusedTab === index ? steamTheme.focus.border : steamTheme.color.borderSubtle,
              background: focusedTab === index
                ? steamTheme.surface.focusedSelectedContentStat
                : activeTab === index ? steamTheme.surface.selectedContentStat : steamTheme.surface.contentStat,
              boxShadow: focusedTab === index ? steamTheme.focus.shadow : undefined,
            }}
          >{section.title}</Focusable>
        ))}
      </Focusable>
      <div
        ref={notesRef}
        data-ac-whats-new-notes="true"
        role="tabpanel"
        aria-label={activeSection.title}
        style={{
          height: NOTES_VIEWPORT_HEIGHT_PX,
          overflowX: "hidden",
          overflowY: "auto",
          overscrollBehavior: "contain",
          scrollbarGutter: "stable",
        }}
      >
        <div role="list" style={{ display: "grid", gap: steamTheme.space.xs }}>
          {activeSection.items.map((item) => (
            <div
              key={item}
              role="listitem"
              style={noteRowStyle}
            >
              <span aria-hidden="true" style={{ color: steamTheme.color.accent, fontWeight: 700 }}>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <Focusable
        data-ac-whats-new-support="true"
        flow-children="left-right"
        noFocusRing
        tabIndex={-1}
        role="group"
        aria-label="Support Achievement Companion"
        style={supportRowStyle}
      >
        {supportActions.map((action) => {
          const focused = focusedSupportAction === action.key;
          const hovered = hoveredSupportAction === action.key;
          const openExternalUrl = (): void => onOpenExternalUrl(action.url);
          return (
            <Focusable
              key={action.key}
              data-ac-whats-new-support-action={action.key}
              noFocusRing
              role="link"
              tabIndex={0}
              aria-label={action.label}
              onActivate={openExternalUrl}
              onClick={openExternalUrl}
              onFocus={() => setFocusedSupportAction(action.key)}
              onGamepadFocus={() => setFocusedSupportAction(action.key)}
              onBlur={() => setFocusedSupportAction((current) => current === action.key ? undefined : current)}
              onGamepadBlur={() => setFocusedSupportAction((current) => current === action.key ? undefined : current)}
              onMouseEnter={() => setHoveredSupportAction(action.key)}
              onMouseLeave={() => setHoveredSupportAction((current) => current === action.key ? undefined : current)}
              style={{
                ...supportActionStyle,
                borderColor: focused
                  ? steamTheme.focus.border
                  : hovered ? steamTheme.color.borderStrong : steamTheme.color.borderSubtle,
                background: focused
                  ? steamTheme.surface.focusedContentStat
                  : hovered ? steamTheme.surface.selectedContentStat : steamTheme.surface.contentStat,
                boxShadow: focused ? steamTheme.focus.shadow : undefined,
              }}
            >
              <img alt="" aria-hidden="true" src={action.icon} style={action.iconStyle} />
              <span>{action.label}</span>
            </Focusable>
          );
        })}
      </Focusable>
    </div>
  );
}

const tabStyle: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  minHeight: 38,
  display: "grid",
  placeItems: "center",
  border: `1px solid ${steamTheme.color.borderSubtle}`,
  borderRadius: steamTheme.radius.pill,
  color: steamTheme.color.textPrimary,
  fontSize: steamTheme.type.fullscreen.body,
  fontWeight: steamTheme.type.weight.strong,
  cursor: "pointer",
};

const noteRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: steamTheme.space.sm,
  lineHeight: 1.35,
  padding: "5px 8px",
  color: steamTheme.color.textPrimary,
};

const supportRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: steamTheme.space.sm,
  marginTop: steamTheme.space.md,
  paddingTop: steamTheme.space.md,
  borderTop: `1px solid ${steamTheme.color.borderSubtle}`,
};

const supportActionStyle: CSSProperties = {
  flex: "0 1 210px",
  minWidth: 0,
  minHeight: 38,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: steamTheme.space.sm,
  padding: "6px 12px",
  boxSizing: "border-box",
  border: `1px solid ${steamTheme.color.borderSubtle}`,
  borderRadius: steamTheme.radius.pill,
  color: steamTheme.color.textPrimary,
  fontSize: steamTheme.type.fullscreen.body,
  fontWeight: steamTheme.type.weight.medium,
  cursor: "pointer",
};

const githubIconStyle: CSSProperties = {
  width: 19,
  height: 19,
  flexShrink: 0,
  objectFit: "contain",
};

const kofiIconStyle: CSSProperties = {
  width: 22,
  height: 18,
  flexShrink: 0,
  objectFit: "contain",
};

export function openDeckyWhatsNewModal(): void {
  let modal: ReturnType<typeof showModal> | undefined;
  let closed = false;
  let externalNavigationStarted = false;
  const closeModal = (): void => {
    if (closed) return;
    closed = true;
    modal?.Close();
  };
  const openExternalUrl = (url: string): void => {
    if (externalNavigationStarted) return;
    externalNavigationStarted = true;
    closeModal();
    DeckyNavigation.NavigateToExternalWeb(url);
  };
  modal = showModal(
    <ConfirmModal
      strTitle="Whats New"
      strOKButtonText="Close"
      bAlertDialog
      closeModal={closeModal}
      onOK={closeModal}
      onCancel={closeModal}
    >
      <WhatsNewContent onOpenExternalUrl={openExternalUrl} />
    </ConfirmModal>,
    undefined,
    { strTitle: "Whats New", bHideMainWindowForPopouts: false },
  );
}
