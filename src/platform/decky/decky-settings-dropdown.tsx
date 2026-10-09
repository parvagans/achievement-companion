import { Focusable, Menu, MenuItem, showContextMenu, type GamepadEvent } from "@decky/ui";
import { useEffect, useRef, useState } from "react";
import caretDownIconUrl from "./assets/caret-down.svg";
import { registerDeckyFullscreenPopupCancel } from "./decky-full-screen-popup-state";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { steamTheme } from "./steam-theme";

/** The native modal selector used by both providers' full-screen settings. */
export function DeckySettingsDropdown<T extends string | number>({
  label, value, options, formatOption = String, disabled = false, onChange, onGamepadDirection,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly formatOption?: (option: T) => string;
  readonly disabled?: boolean;
  readonly onChange: (value: T) => void;
  readonly onGamepadDirection: (event: GamepadEvent) => void;
  readonly themeVariant?: "steam" | "ra";
}): JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<ReturnType<typeof showContextMenu>>();
  const unregisterCancelRef = useRef<() => void>();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = (): void => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    unregisterCancelRef.current?.();
    unregisterCancelRef.current = undefined;
    setMenuOpen(false);
    if (triggerRef.current !== null) requestDeckySteamGamepadFocusAfterMount(triggerRef.current);
  };
  const openMenu = (): void => {
    if (disabled || menuRef.current !== undefined || triggerRef.current === null) return;
    setMenuOpen(true);
    menuRef.current = showContextMenu(
      <Menu label={label} onCancel={closeMenu}>
        {options.map((option) => <MenuItem key={option} selected={value === option} onClick={() => { onChange(option); closeMenu(); }}>{formatOption(option)}</MenuItem>)}
      </Menu>,
      triggerRef.current,
      { bModal: true, bMatchWidth: true },
    );
    unregisterCancelRef.current = registerDeckyFullscreenPopupCancel(closeMenu);
  };
  useEffect(() => () => {
    menuRef.current?.Hide();
    menuRef.current = undefined;
    unregisterCancelRef.current?.();
    unregisterCancelRef.current = undefined;
  }, []);
  const valueLabel = formatOption(value);
  return <Focusable ref={triggerRef} className="ac-settings-action" data-settings-dropdown={label} noFocusRing role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-expanded={menuOpen} aria-label={`${label}: ${valueLabel}`} onActivate={openMenu} onClick={openMenu} onGamepadDirection={onGamepadDirection} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, padding: "8px 12px", boxSizing: "border-box", border: `1px solid ${steamTheme.color.borderSubtle}`, borderRadius: steamTheme.radius.small, background: steamTheme.surface.contentStat, color: disabled ? steamTheme.color.textSecondary : steamTheme.color.textPrimary, opacity: disabled ? .65 : 1 }}>
    <span style={{ minWidth: 0, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong }}>{label}</span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, color: steamTheme.color.accent, fontSize: steamTheme.type.fullscreen.body, fontWeight: steamTheme.type.weight.strong }}><span>{valueLabel}</span><img alt="" src={caretDownIconUrl} style={{ width: 12, height: 12, objectFit: "contain", filter: steamTheme.iconFilter.accent, flexShrink: 0 }} /></span>
  </Focusable>;
}
