import { ConfirmModal, Focusable, showModal } from "@decky/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { APP_VERSION } from "../../generated/version";
import { applyAchievementCompanionTheme } from "./decky-theme-palette";
import { readDeckySettings } from "./decky-settings";
import { WHATS_NEW_SECTIONS } from "./decky-whats-new-content";
import { steamTheme } from "./steam-theme";

function WhatsNewContent(): JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [focusedTab, setFocusedTab] = useState<number | undefined>(undefined);
  const activeSection = WHATS_NEW_SECTIONS[activeTab] ?? WHATS_NEW_SECTIONS[0];

  useEffect(() => {
    const ownerDocument = contentRef.current?.ownerDocument;
    if (ownerDocument !== undefined) {
      applyAchievementCompanionTheme(ownerDocument, readDeckySettings().theme);
    }
  }, []);

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
      <div role="tabpanel" aria-label={activeSection.title} style={{ height: 176, overflowY: "auto" }}>
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

export function openDeckyWhatsNewModal(): void {
  let modal: ReturnType<typeof showModal> | undefined;
  let closed = false;
  const closeModal = (): void => {
    if (closed) return;
    closed = true;
    modal?.Close();
  };
  modal = showModal(
    <ConfirmModal
      strTitle="Whats New"
      strOKButtonText="Close"
      bAlertDialog
      bAllowFullSize
      closeModal={closeModal}
      onOK={closeModal}
      onCancel={closeModal}
    >
      <WhatsNewContent />
    </ConfirmModal>,
    undefined,
    { strTitle: "Whats New", bHideMainWindowForPopouts: false },
  );
}
