let gamePageBadgeSettingsExpanded = false;

/** Preserve provider-menu disclosure state across native modal remounts. */
export function readDeckyGamePageBadgeSettingsExpanded(): boolean {
  return gamePageBadgeSettingsExpanded;
}

export function writeDeckyGamePageBadgeSettingsExpanded(expanded: boolean): void {
  gamePageBadgeSettingsExpanded = expanded;
}

/** A genuinely new compact session starts with optional settings collapsed. */
export function resetDeckyProviderMenuSessionState(): void {
  gamePageBadgeSettingsExpanded = false;
}
