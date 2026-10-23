import assert from "node:assert/strict";
import test from "node:test";
import { isBlankSteamHeaderResponse, isLegacySteamHeaderUrl } from "../src/platform/decky/decky-steam-header-placeholder";

test("only legacy Steam header URLs are checked for placeholder artwork", () => {
  assert.equal(isLegacySteamHeaderUrl("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42/header.jpg"), true);
  assert.equal(isLegacySteamHeaderUrl("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42/library_hero.jpg"), false);
  assert.equal(isLegacySteamHeaderUrl("https://example.com/store_item_assets/steam/apps/42/header.jpg"), false);
});

test("a successful tiny Steam header is treated as a placeholder, while real artwork is preserved", () => {
  const response = (length: string, status = 200): Response => new Response(null, {
    status,
    headers: { "content-type": "image/jpeg", "content-length": length },
  });
  assert.equal(isBlankSteamHeaderResponse(response("1441")), true);
  assert.equal(isBlankSteamHeaderResponse(response("52598")), false);
  assert.equal(isBlankSteamHeaderResponse(response("1441", 404)), false);
  assert.equal(isBlankSteamHeaderResponse(new Response(null, { status: 200 })), false);
});
