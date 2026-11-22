import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import deckyPlugin from "@decky/rollup";

const brandAssets = resolve(fileURLToPath(new URL("./src/platform/decky/assets/brand/", import.meta.url)));
const inlineIconSuffix = "?inline-brand-icon";

export default deckyPlugin({
  plugins: [{
    name: "inline-brand-icons",
    resolveId(source, importer) {
      if (importer === undefined || !source.startsWith("./") || !source.endsWith(".svg")) return null;
      const iconPath = resolve(dirname(importer), source);
      if (dirname(iconPath) !== brandAssets) return null;
      return iconPath + inlineIconSuffix;
    },
    load(id) {
      if (!id.endsWith(inlineIconSuffix)) return null;

      // Keep support icons available in both Steam windows, independent of Decky's asset server.
      const iconPath = id.slice(0, -inlineIconSuffix.length);
      this.addWatchFile(iconPath);
      const svg = readFileSync(iconPath, "utf8");
      const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      return `export default ${JSON.stringify(url)};`;
    },
  }],
});
