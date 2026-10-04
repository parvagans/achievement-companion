import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Steam game achievement return has one scroll-restoration owner", async () => {
  const source = await readFile(
    new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /<TopAlignedScrollViewport[\s\S]*restoreAfterLayout[\s\S]*restoreScrollTop=\{readSteamGameSectionPageState/u,
  );
  assert.match(
    source,
    /scrollContainer\.addEventListener\("scroll", onScroll[\s\S]*return \(\) => \{\s*scrollContainer\.removeEventListener/u,
  );
  assert.match(
    source,
    /const onScroll = \(\): void => \{\s*if \(readSteamGameSectionPageState\(providerId, gameId\)\.restoreRequested\) \{\s*return;/u,
  );
  assert.doesNotMatch(
    source,
    /return \(\) => \{\s*onScroll\(\);\s*scrollContainer\.removeEventListener/u,
    "route teardown must not overwrite the explicitly saved scroll origin with a reset container offset",
  );
});
