let pluginSettingsExpanded = false;
let themeSettingsExpanded = false;
let gamePageBadgeSettingsExpanded = false;

export function readDeckyPluginSettingsExpanded(): boolean {
  return pluginSettingsExpanded;
}

export function writeDeckyPluginSettingsExpanded(expanded: boolean): void {
  pluginSettingsExpanded = expanded;
}

export function readDeckyThemeSettingsExpanded(): boolean {
  return themeSettingsExpanded;
}

export function writeDeckyThemeSettingsExpanded(expanded: boolean): void {
  themeSettingsExpanded = expanded;
}

/** Preserve provider-menu disclosure state across native modal remounts. */
export function readDeckyGamePageBadgeSettingsExpanded(): boolean {
  return gamePageBadgeSettingsExpanded;
}

export function writeDeckyGamePageBadgeSettingsExpanded(expanded: boolean): void {
  gamePageBadgeSettingsExpanded = expanded;
}

/** A genuinely new compact session starts with optional settings collapsed. */
export function resetDeckyProviderMenuSessionState(): void {
  pluginSettingsExpanded = false;
  themeSettingsExpanded = false;
  gamePageBadgeSettingsExpanded = false;
}
