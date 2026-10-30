import { Focusable } from "@decky/ui";
import { useState } from "react";
import { DeckyUpNextPinIcon } from "./decky-up-next-pin-icon";
import type { UpNextPinAction } from "./decky-up-next-pin-action";
import { achievementCompanionQamTheme as theme, getQamCompactFocusControlStyle } from "./decky-qam-theme";

/** Adjacent sibling action: never nest an interactive control inside an achievement button. */
export function DeckyUpNextPinButton({ action, onCancel, onFocusedChange }: {
  readonly action: UpNextPinAction | undefined;
  readonly onFocusedChange?: ((focused: boolean) => void) | undefined;
  readonly onCancel?: (() => void) | undefined;
}): JSX.Element | null {
  const [focused, setFocused] = useState(false);
  if (action === undefined) return null;
  const style = { borderRadius: theme.radius.small, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentStat,
    color: action.pinned ? theme.color.accent : theme.color.textPrimary, width: 32, height: 32, boxSizing: "border-box", flexShrink: 0, padding: 6, minHeight: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: theme.type.fontFamily,
    fontSize: theme.type.compact.metadata, fontWeight: 700, cursor: "pointer", ...(focused ? getQamCompactFocusControlStyle() : {}) } as const;
  return <Focusable noFocusRing role="button" data-ac-up-next-pin-action aria-label={action.pinned ? "Unpin achievement" : "Pin achievement"} aria-pressed={action.pinned}
    onOKActionDescription={action.label} onActivate={action.activate} onClick={action.activate} {...(onCancel ? { onCancel } : {})}
    onFocus={() => { setFocused(true); onFocusedChange?.(true); }} onGamepadFocus={() => { setFocused(true); onFocusedChange?.(true); }}
    onBlur={() => { setFocused(false); onFocusedChange?.(false); }} onGamepadBlur={() => { setFocused(false); onFocusedChange?.(false); }} style={style}><DeckyUpNextPinIcon filled={action.pinned} /></Focusable>;
}
