import { useState } from "react";

export const compactCalendarPreferenceKey = (providerId: string): string => `achievement-companion:compact-calendar-expanded:${providerId}:v1`;
export function readCompactCalendarExpanded(providerId: string, storage?: Pick<Storage, "getItem">): boolean {
  try { return (storage ?? globalThis.localStorage)?.getItem(compactCalendarPreferenceKey(providerId)) === "true"; } catch { return false; }
}
export function saveCompactCalendarExpanded(providerId: string, expanded: boolean, storage?: Pick<Storage, "setItem">): void {
  try { (storage ?? globalThis.localStorage)?.setItem(compactCalendarPreferenceKey(providerId), String(expanded)); } catch { /* Session state still works if storage is unavailable. */ }
}
export function useCompactCalendarExpanded(providerId: string) {
  const [expanded, setExpanded] = useState(() => readCompactCalendarExpanded(providerId));
  return [expanded, (next: boolean) => { saveCompactCalendarExpanded(providerId, next); setExpanded(next); }] as const;
}
