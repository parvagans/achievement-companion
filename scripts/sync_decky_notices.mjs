import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const canonicalNoticePath = resolve("THIRD_PARTY_NOTICES.md");
const generatedNoticePath = resolve("defaults", "THIRD_PARTY_NOTICES.md");

let canonicalNotice;
try {
  canonicalNotice = await readFile(canonicalNoticePath);
} catch (error) {
  const detail = error instanceof Error ? ` ${error.message}` : "";
  throw new Error(`Canonical THIRD_PARTY_NOTICES.md is missing or unreadable.${detail}`, {
    cause: error,
  });
}

if (canonicalNotice.byteLength === 0) {
  throw new Error("Canonical THIRD_PARTY_NOTICES.md is empty.");
}

await mkdir(dirname(generatedNoticePath), { recursive: true });
await writeFile(generatedNoticePath, canonicalNotice);
