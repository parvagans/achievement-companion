import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/** Render the real header; substitute only the native Decky boundary and scroll/observer effects. */
export function renderCompactProfileHeader({ provider = "Steam", avatar, focused = false, currentGame = false, sourcePath, onActivate = () => {}, onCancel = () => {}, onFocused = () => {}, onActivated = () => {}, onOpenPinned = () => {} }: {
  provider?: string; avatar?: string; focused?: boolean; currentGame?: boolean; sourcePath?: string;
  onActivate?: () => void; onCancel?: () => void; onFocused?: (node: HTMLElement) => void; onActivated?: (node: HTMLElement) => void; onOpenPinned?: (node: HTMLDivElement) => void;
} = {}) {
  const file = resolve("src/platform/decky/decky-compact-profile-header.tsx");
  const require = createRequire(file);
  let control: Record<string, any> = {};
  let pinnedControl: Record<string, any> = {};
  let pinnedRef: React.ForwardedRef<HTMLDivElement>;
  let controlRef: React.ForwardedRef<HTMLDivElement>;
  const native = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    if (props["aria-label"] === "Pinned Achievements") { pinnedControl = props; pinnedRef = ref; }
    else if (props.role === "button") { control = props; controlRef = ref; }
    return React.createElement("div", Object.fromEntries(Object.entries(props).filter(([key]) =>
      !key.startsWith("on") && !["preferredFocus", "noFocusRing"].includes(key))), props.children);
  });
  const localRequire = (name: string) => {
    if (name === "@decky/ui") return { Focusable: native };
    if (name === "./decky-focus-scroll") return { scrollDeckyFocusTargetToTop: () => {} };
    if (name === "./decky-visual-focus-state") return { useDeckyVisualFocusState: () => {} };
    if (name === "react") return { ...React, useState: (value: unknown) => React.useState(typeof value === "boolean" ? focused : value) };
    return require(name);
  };
  const compiled = ts.transpileModule(readFileSync(sourcePath ?? file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports: Record<string, React.ComponentType<any>> = {};
  new Function("require", "exports", compiled.outputText)(localRequire, exports);
  const html = renderToStaticMarkup(React.createElement(exports["DeckyCompactProfileHeader"]!, {
    identity: { displayName: "Account name must not appear visually", ...(avatar ? { avatarUrl: avatar } : {}) },
    providerName: provider, refreshedAt: undefined, currentGame, onActivate, onCancel,
    targetProps: { preferredFocus: true, onFocused, onActivated },
    pinnedTargetProps: { preferredFocus: false, onFocused, onActivated }, onOpenPinned,
  }));
  return { html, control, pinnedControl, attachPinned: (node: HTMLDivElement) => { if (typeof pinnedRef === "function") pinnedRef(node); }, attach: (node: HTMLDivElement) => { if (typeof controlRef === "function") controlRef(node); } };
}
