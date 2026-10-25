import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckyFullScreenFooterActionLegend } from "../src/platform/decky/decky-full-screen-footer-overlay";

interface FooterActionState {
  readonly x?: string;
  readonly y?: string;
}

function renderStableActionLegend(state: FooterActionState): string {
  return renderToStaticMarkup(createElement(DeckyFullScreenFooterActionLegend, {
    ...(state.x !== undefined ? { contextualXActionLabel: state.x } : {}),
    ...(state.y !== undefined ? { secondaryActionLabel: state.y } : {}),
    stableActionSlots: true,
  }));
}

function readStableLegendStyle(markup: string): string {
  const match = markup.match(/data-achievement-companion-stable-action-slots="true" style="([^"]+)"/u);
  assert.ok(match !== null, "the game footer must render the stable action grid");
  return match[1] ?? "";
}

function readActionSlot(markup: string, slot: "x" | "y" | "a" | "b"): string {
  const slots = ["x", "y", "a", "b"] as const;
  const slotIndex = slots.indexOf(slot);
  const start = markup.indexOf(`data-achievement-companion-footer-action-slot="${slot}"`);
  assert.ok(start >= 0, `missing ${slot.toUpperCase()} footer slot`);
  const next = slots[slotIndex + 1];
  const end = next === undefined
    ? markup.length
    : markup.indexOf(`data-achievement-companion-footer-action-slot="${next}"`, start);
  return markup.slice(start, end);
}

test("game footer reserves identical X, Y, A, and B columns for every contextual state", () => {
  const states = [
    { x: "Hide", y: "Show" },
    { x: "Hide" },
    { y: "Show" },
    {},
  ] as const satisfies readonly FooterActionState[];
  const markupByState = states.map(renderStableActionLegend);
  const expectedStyle = readStableLegendStyle(markupByState[0] ?? "");

  assert.match(expectedStyle, /display:grid/u);
  assert.match(expectedStyle, /grid-template-columns:54px 60px 64px 54px/u);
  assert.match(expectedStyle, /width:256px/u);
  assert.match(expectedStyle, /min-width:256px/u);

  for (const markup of markupByState) {
    assert.equal(readStableLegendStyle(markup), expectedStyle);
    const slotOffsets = ["x", "y", "a", "b"].map((slot) => (
      markup.indexOf(`data-achievement-companion-footer-action-slot="${slot}"`)
    ));
    assert.deepEqual([...slotOffsets].sort((left, right) => left - right), slotOffsets);
    assert.match(readActionSlot(markup, "a"), />A<\/span><span>Select<\/span>/u);
    assert.match(readActionSlot(markup, "b"), />B<\/span><span>Back<\/span>/u);
  }

  assert.match(readActionSlot(markupByState[0] ?? "", "x"), />X<\/span><span>Hide<\/span>/u);
  assert.match(readActionSlot(markupByState[0] ?? "", "y"), />Y<\/span><span>Show<\/span>/u);
  assert.doesNotMatch(readActionSlot(markupByState[2] ?? "", "x"), />X<\/span>/u);
  assert.doesNotMatch(readActionSlot(markupByState[1] ?? "", "y"), />Y<\/span>/u);
  assert.doesNotMatch(readActionSlot(markupByState[3] ?? "", "x"), />X<\/span>/u);
  assert.doesNotMatch(readActionSlot(markupByState[3] ?? "", "y"), />Y<\/span>/u);
});

test("game footer keeps Y Show and Y Top in the same physical slot", () => {
  const showMarkup = renderStableActionLegend({ y: "Show" });
  const topMarkup = renderStableActionLegend({ y: "Top" });

  assert.equal(readStableLegendStyle(showMarkup), readStableLegendStyle(topMarkup));
  assert.match(readActionSlot(showMarkup, "y"), />Y<\/span><span>Show<\/span>/u);
  assert.match(readActionSlot(topMarkup, "y"), />Y<\/span><span>Top<\/span>/u);
  assert.equal(showMarkup.indexOf('data-achievement-companion-footer-action-slot="y"'),
    topMarkup.indexOf('data-achievement-companion-footer-action-slot="y"'));
});

test("non-game footer legends retain their existing flexible layout", () => {
  const markup = renderToStaticMarkup(createElement(DeckyFullScreenFooterActionLegend, {
    secondaryActionLabel: "Top",
  }));

  assert.doesNotMatch(markup, /data-achievement-companion-stable-action-slots/u);
  assert.doesNotMatch(markup, /data-achievement-companion-footer-action-slot/u);
  assert.match(markup, />Y<\/span><span>Top<\/span>/u);
  assert.match(markup, />A<\/span><span>Select<\/span>/u);
  assert.match(markup, />B<\/span><span>Back<\/span>/u);
});

test("only full-screen game navigation opts into stable action slots", async () => {
  const [gameNavigationSource, footerSource, profileSource, gamePageSource] = await Promise.all([
    readFile(new URL("../src/platform/decky/decky-full-screen-game-section-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-footer-overlay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/platform/decky/decky-full-screen-game-page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(gameNavigationSource, /<DeckyFullScreenFooterOverlay[\s\S]*stableActionSlots/u);
  assert.doesNotMatch(profileSource, /stableActionSlots/u);
  assert.match(footerSource, />L1<\/span>[\s\S]*getSectionTabsStyle[\s\S]*>R1<\/span>[\s\S]*DeckyFullScreenFooterActionLegend/u);
  assert.match(gamePageSource, /activeSteamSection === "achievements"[\s\S]*secondaryActionLabel: "Top"/u);
  assert.match(gamePageSource, /activeSteamSection === "overview" && focusedSuggestionId !== null[\s\S]*secondaryActionLabel: "Show", contextualXActionLabel: "Hide"/u);
  assert.match(footerSource, /button === DECKY_FULLSCREEN_FOOTER_TOP_BUTTON && onSecondaryActionRef\.current !== undefined/u);
});
