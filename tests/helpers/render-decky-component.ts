import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import ts from "typescript";

/** Execute the real TSX with explicit native/service boundaries supplied by each test. */
export function loadLocalComponent(file: string, overrides: Record<string, unknown> = {}) {
  const path = resolve(file);
  const require = createRequire(path);
  const controls: any[] = [];
  const Focusable = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    controls.push({ ...props, attach: (node: HTMLDivElement) => { if (typeof ref === "function") ref(node); else if (ref) ref.current = node; } });
    return React.createElement("div", Object.fromEntries(Object.entries(props).filter(([name]) =>
      !name.startsWith("on") && !["noFocusRing", "preferredFocus"].includes(name))), props.children);
  });
  const exports: Record<string, any> = {};
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  new Function("require", "exports", compiled.outputText)((name: string) => overrides[name]
    ?? (name === "@decky/ui" ? { Focusable, GamepadButton: { DIR_UP: 9, DIR_DOWN: 10, DIR_LEFT: 11, DIR_RIGHT: 12 } } : require(name)), exports);
  return { exports, controls };
}
