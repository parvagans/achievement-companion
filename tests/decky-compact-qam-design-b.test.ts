import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckyCompactUpNextContent } from "../src/platform/decky/decky-compact-up-next-content";
import { shouldRestoreCompactUpNextToAchievements } from "../src/platform/decky/decky-compact-up-next-focus";

test("recommendation descriptions follow the artwork/title row and retain full detail text", () => {
  const description = "Complete the final mission without losing a unit. ".repeat(12);
  const html = renderToStaticMarkup(createElement(DeckyCompactUpNextContent, {
    label: "UP NEXT · PINNED", achievement: { title: "A long achievement title ".repeat(6), description, badgeImageUrl: "badge.png" },
  }));
  assert.match(html, /width:48px;height:48px/u);
  assert.match(html, /<\/div><\/div><span data-ac-up-next-description/u);
  assert.match(html, /font-size:14px;line-height:1.2/u);
  assert.match(html, /font-size:12px;line-height:1.3/u);
  assert.equal((html.match(/-webkit-line-clamp:2/gu) ?? []).length, 2);
  assert.ok(html.includes(description));
  assert.doesNotMatch(html, /min-height|height:66px|line-clamp:3/u);
});

test("short and missing-art recommendations reserve no description or image space", () => {
  for (const label of ["UP NEXT", "UP NEXT · BEAT", "UP NEXT · MASTER", "UP NEXT · PINNED"]) {
    const html = renderToStaticMarkup(createElement(DeckyCompactUpNextContent, { label, achievement: { title: "Win" } }));
    assert.ok(html.includes(label));
    assert.match(html, /grid-template-columns:minmax\(0, 1fr\)/u);
    assert.doesNotMatch(html, /<img|data-ac-up-next-description|min-height/u);
  }
});

test("unavailable Up Next controls restore to the surviving list without stealing other section focus", () => {
  const saved = { kind: "up-next", gameId: "1", control: "pin" as const };
  assert.equal(shouldRestoreCompactUpNextToAchievements(saved, "1", []), false);
  assert.equal(shouldRestoreCompactUpNextToAchievements(saved, "1", ["pin"]), true);
  assert.equal(shouldRestoreCompactUpNextToAchievements(saved, "2", []), true);
  assert.equal(shouldRestoreCompactUpNextToAchievements({ ...saved, control: "recommendation" }, "1", ["recommendation"]), true);
  for (const kind of ["profile", "calendar-entry", "achievement", "settings"]) {
    assert.equal(shouldRestoreCompactUpNextToAchievements({ kind }, "1", ["pin", "recommendation"]), false);
  }
  assert.equal(shouldRestoreCompactUpNextToAchievements({ ...saved, control: "options" }, "1", ["pin"]), false);
});

test("both providers keep profile navigation outside the nullable game card", () => {
  for (const provider of ["steam", "retroachievements"]) {
    const source = readFileSync(`src/platform/decky/decky-${provider}-compact-profile.tsx`, "utf8");
    assert.ok(source.indexOf("<DeckyCompactProfileHeader") < source.indexOf("<DeckyCompactUpNextCard"));
    assert.doesNotMatch(source, /function ProfileCard|title="Profile"/u);
    assert.match(source, /shouldRestoreCompactUpNextToAchievements\(saved, gameId, unavailableControls\)/u);
  }
  const header = readFileSync("src/platform/decky/decky-compact-profile-header.tsx", "utf8");
  assert.match(header, /minHeight: 38/u);
  assert.doesNotMatch(header, /\{identity.displayName\}<\//u);
  const card = readFileSync("src/platform/decky/decky-compact-up-next-card.tsx", "utf8");
  assert.match(card, /recommendationActionable \? Focusable : "div"/u);
  assert.match(card, /role=\{recommendationActionable \? "button" : "status"\}/u);
});
