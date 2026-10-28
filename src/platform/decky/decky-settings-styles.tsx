import { useLayoutEffect, useRef } from "react";
import { achievementCompanionQamTheme as theme } from "./decky-qam-theme";
import { retainDeckyDocumentStyles } from "./decky-document-styles";

export function getDeckySettingsStylesCss(): string {
  const scope = ":is(.ac-steam-settings-page,.ac-ra-fullscreen-settings-page,.ac-provider-about-page)";
  const focused = ":is(.gpfocus,.gpfocuswithin,:focus,:focus-within)";
  const action = `${scope} :is(.ac-settings-action,.ac-ra-settings-save)`;
  const input = `${scope} :is(.ac-ra-settings-input,.ac-steam-settings-input)`;
  const help = `${scope} :is(.ac-ra-settings-help-link,.ac-steam-settings-help-link)`;
  return `
${action}{outline:none!important}
${action}:not(.gpfocus):not(.gpfocuswithin):not(:focus):not(:focus-within){box-shadow:none!important}
${action}${focused}{border-color:${theme.focus.border}!important;box-shadow:${theme.focus.shadow}!important;background:${theme.surface.focusedContentStat}!important}
${input}{min-height:0!important;margin:0!important}
${input},${input} *{font-size:${theme.type.fullscreen.body}px!important;line-height:1.2!important}
${input} [class*="DialogInput"]{min-height:0!important;margin:0!important;padding-block:0!important}
${input} input{height:30px!important;min-height:30px!important;padding:3px 9px!important}
${action}[data-ac-settings-tone="danger"]${focused}{background:${theme.status.danger.surface}!important}
${action}[data-ac-settings-tone="success"]${focused}{border-color:${theme.status.success.border}!important;background:${theme.status.success.surface}!important;color:${theme.status.success.text}!important}
${help}{outline:none!important}
${help}${focused}{outline:2px solid ${theme.focus.border}!important;outline-offset:1px;background:${theme.focus.background}!important;box-shadow:${theme.focus.shadow}!important;color:${theme.color.textPrimary}!important}
`;
}

export function DeckySettingsStyles(): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const ownerDocument = anchorRef.current?.ownerDocument;
    if (ownerDocument === undefined) return;
    return retainDeckyDocumentStyles(ownerDocument, "settings", getDeckySettingsStylesCss());
  }, []);
  return <span ref={anchorRef} hidden aria-hidden="true" />;
}
