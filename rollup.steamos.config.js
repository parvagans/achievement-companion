import deckyPlugin from "@decky/rollup";

const deckyConfig = deckyPlugin({}, ".");
const steamosPlugins = (deckyConfig.plugins ?? []).filter((plugin) => {
  const pluginName = plugin?.name;
  return pluginName !== "delete"
    && pluginName !== "rollup-plugin-external-globals"
    && pluginName !== "assets";
});

export default {
  ...deckyConfig,
  input: "./src/platform/steamos/bootstrap.tsx",
  plugins: steamosPlugins,
  external: [],
  output: {
    file: "dist-steamos/steamos-bootstrap.js",
    format: "esm",
    sourcemap: false,
    exports: "named",
  },
};
