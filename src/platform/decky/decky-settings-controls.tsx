import { Focusable, Toggle, type GamepadEvent } from "@decky/ui";
import chevronRightIconUrl from "./assets/chevron-right.svg";
import { steamTheme } from "./steam-theme";

/** Full-screen settings own the row chrome; Decky still owns the switch itself. */
export function DeckySettingsToggleRow({ label, description, checked, onChange, onGamepadDirection }: {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly onGamepadDirection?: (event: GamepadEvent) => void;
}): JSX.Element {
  const toggle = (): void => onChange(!checked);
  return <Focusable
    className="ac-settings-action"
    data-ac-settings-content-row="true"
    noFocusRing
    role="switch"
    tabIndex={0}
    aria-label={label}
    aria-checked={checked}
    onActivate={(event) => { if (event.target === event.currentTarget) toggle(); }}
    onClick={toggle}
    {...(onGamepadDirection !== undefined ? { onGamepadDirection } : {})}
    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 62, padding: "10px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat, color: steamTheme.color.textPrimary, fontFamily: steamTheme.type.fontFamily, scrollMargin: "12px 4px 24px" }}
  >
    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
      <span style={{ fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong, lineHeight: 1.3 }}>{label}</span>
      <span style={{ color: steamTheme.color.textSecondary, fontSize: steamTheme.type.fullscreen.metadata, fontWeight: steamTheme.type.weight.regular, lineHeight: 1.3 }}>{description}</span>
    </span>
    <span data-ac-settings-toggle-control="true" onClick={(event) => event.stopPropagation()} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center" }}>
      <Toggle value={checked} onChange={onChange} />
    </span>
  </Focusable>;
}

/** Keep the shared destination inside the provider settings gutter and scroll bounds. */
export function DeckySettingsGeneralLink({ onOpen, onGamepadDirection }: {
  readonly onOpen: () => void;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
}): JSX.Element {
  return <Focusable
    className="ac-settings-action"
    data-settings-general-link="true"
    noFocusRing
    role="button"
    tabIndex={0}
    aria-label="Open General Settings"
    onActivate={onOpen}
    onClick={onOpen}
    onGamepadDirection={onGamepadDirection}
    style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, maxWidth: "100%", minHeight: 40, padding: "7px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat, color: steamTheme.color.textPrimary, fontFamily: steamTheme.type.fontFamily, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong, lineHeight: 1.3, scrollMargin: "10px 4px" }}
  >
    <span>General Settings</span>
    <img alt="" aria-hidden="true" src={chevronRightIconUrl} style={{ width: 14, height: 14, flexShrink: 0, filter: steamTheme.iconFilter.accent }} />
  </Focusable>;
}
