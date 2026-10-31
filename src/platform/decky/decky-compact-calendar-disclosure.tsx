import { Focusable } from "@decky/ui";
import { useRef, useState, type ReactNode } from "react";
import type { DeckyCompactUpNextFocusTargetProps } from "./decky-compact-up-next-card";
import { useCompactCalendarExpanded } from "./decky-compact-calendar-preference";
import { formatCompactActivityDate } from "./decky-compact-activity-model";
import { achievementCompanionQamTheme as theme, getQamCompactFocusControlStyle } from "./decky-qam-theme";
import { scrollDeckyFocusTargetIntoView } from "./decky-focus-scroll";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { useDeckyVisualFocusState } from "./decky-visual-focus-state";

export function DeckyCompactCalendarDisclosure({ providerId, weeks, selectedDay, onClear, onCancel, targetProps, clearTargetProps, children }: {
  readonly providerId: string; readonly weeks: number; readonly selectedDay: number | undefined;
  readonly onClear: () => void; readonly onCancel: () => void;
  readonly targetProps: DeckyCompactUpNextFocusTargetProps; readonly clearTargetProps: DeckyCompactUpNextFocusTargetProps;
  readonly children: ReactNode;
}): JSX.Element {
  const [expanded, setExpanded] = useCompactCalendarExpanded(providerId);
  const ref = useRef<HTMLDivElement | null>(null);
  const clearRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [clearFocused, setClearFocused] = useState(false);
  useDeckyVisualFocusState(ref, setFocused);
  useDeckyVisualFocusState(clearRef, setClearFocused);
  const toggle = (): void => {
    if (ref.current) targetProps.onActivated(ref.current);
    setExpanded(!expanded);
    requestDeckySteamGamepadFocusAfterMount(ref.current);
  };
  const clear = (): void => {
    // Clear disappears with the filter; move focus before unmounting it.
    if (ref.current) { targetProps.onFocused(ref.current); }
    onClear();
    requestDeckySteamGamepadFocusAfterMount(ref.current);
  };
  return <section data-ac-calendar-disclosure={providerId} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
    <Focusable noFocusRing role="button" tabIndex={0} aria-expanded={expanded} aria-label={`Activity Calendar. ${selectedDay === undefined ? `Last ${weeks} weeks` : `Filtered: ${formatCompactActivityDate(selectedDay)}`}. ${expanded ? "Collapse" : "Expand"}`}
      preferredFocus={targetProps.preferredFocus} onOKActionDescription={expanded ? "Collapse" : "Expand"} onActivate={toggle} onClick={toggle} onCancel={onCancel}
      ref={(node) => { ref.current = node; targetProps.elementRef?.(node); }}
      onGamepadFocus={() => { setFocused(true); if (ref.current) { scrollDeckyFocusTargetIntoView(ref.current); targetProps.onFocused(ref.current); } }} onGamepadBlur={() => setFocused(false)}
      style={{ minHeight: 38, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 6, padding: "0 4px", borderRadius: theme.radius.small, border: "1px solid transparent", color: theme.color.accent, boxSizing: "border-box", ...(focused ? getQamCompactFocusControlStyle() : {}) }}>
      <span style={{ fontSize: theme.type.compact.heading, fontWeight: 850, whiteSpace: "nowrap" }}>ACTIVITY CALENDAR</span>
      <span style={{ fontSize: theme.type.compact.caption, color: theme.color.textSecondary, whiteSpace: "nowrap" }}>{selectedDay === undefined ? `Last ${weeks} weeks` : `Filtered: ${formatCompactActivityDate(selectedDay)}`} <span aria-hidden="true">{expanded ? "▴" : "▾"}</span></span>
    </Focusable>
    {selectedDay !== undefined ? <Focusable noFocusRing role="button" tabIndex={0} aria-label="Clear calendar date filter" onOKActionDescription="Clear date" preferredFocus={clearTargetProps.preferredFocus}
      ref={(node) => { clearRef.current = node; clearTargetProps.elementRef?.(node); }} onActivate={clear} onClick={clear} onCancel={onCancel}
      onGamepadFocus={() => { setClearFocused(true); if (clearRef.current) clearTargetProps.onFocused(clearRef.current); }} onGamepadBlur={() => setClearFocused(false)}
      style={{ minHeight: 38, borderRadius: theme.radius.small, border: `1px solid ${theme.color.borderSubtle}`, background: theme.surface.contentStat, color: theme.color.textPrimary, fontSize: theme.type.compact.metadata, display: "grid", placeItems: "center", ...(clearFocused ? getQamCompactFocusControlStyle() : {}) }}>Clear date filter</Focusable> : null}
    {expanded ? children : null}
  </section>;
}

