import { gamepadDialogClasses } from "@decky/ui";
import type { ReactNode } from "react";
import { getCompactAppearanceValueLabel, getNativeAppearanceSettingsRowsCss } from "./decky-appearance-settings-layout";

/** Informational layout owner only; the existing native Field and its controls own focus. */
export function DeckyAppearanceSettingsRow({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div data-ac-appearance-row data-ac-game-page-badge-dropdown="true">{children}</div>;
}

export function DeckyAppearanceSettingsRowsStyle(): JSX.Element {
  return <style>{getNativeAppearanceSettingsRowsCss(gamepadDialogClasses.Field)}</style>;
}

export function renderAppearanceDropdownValue(value: ReactNode): JSX.Element {
  return <span className="ac-appearance-value" title={typeof value === "string" ? value : undefined} aria-label={typeof value === "string" ? value : undefined}>{typeof value === "string" ? getCompactAppearanceValueLabel(value) : value}</span>;
}
