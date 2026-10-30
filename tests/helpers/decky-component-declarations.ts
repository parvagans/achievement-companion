import { readFile } from "node:fs/promises";
import ts from "typescript";

/** Exercise production declarations while stubbing Steam-only module boundaries. */
export async function components(file: string, names: readonly string[], dependencies: Record<string, unknown>, sourceOverride?: string) {
  const text = sourceOverride ?? await readFile(new URL(`../../src/platform/decky/${file}`, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const source = ast.statements.filter((node) => ts.isFunctionDeclaration(node) ? names.includes(node.name?.text ?? "")
    : ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => names.includes(declaration.name.getText(ast))))
    .map((node) => node.getText(ast).replace(/^export\s+/, "")).join("\n");
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: "createElement", jsxFragmentFactory: "Fragment", target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return {${names.join(",")}};`)(...Object.values(dependencies));
}
