import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getRetroAchievementsFirstSubsetTarget } from "../src/platform/decky/decky-retroachievements-subset-navigation";
import { buildSubsetDiscoveryPanel } from "../src/platform/decky/decky-retroachievements-subset-discovery-model";

const partial = { verified: 99, total: 101, remaining: 2, unsupported: 0, running: false, complete: false, checkpointSaved: true };
test("discovery presentation distinguishes console progress, running, deferred, failures and completion", () => {
  const model = buildSubsetDiscoveryPanel(partial, 100);
  assert.equal(model?.progress, "99 / 101 verified");
  assert.equal(model?.disabled, false);
  assert.equal(buildSubsetDiscoveryPanel({ ...partial, running: true }, 100)?.disabled, true);
  assert.match(buildSubsetDiscoveryPanel({ ...partial, retryAt: 200, failureCategory: "rate_limit" }, 100)!.label, /cooldown/);
  assert.equal(buildSubsetDiscoveryPanel({ ...partial, retryAt: 200 }, 100)?.disabled, true);
  assert.equal(buildSubsetDiscoveryPanel({ ...partial, retryAt: 200 }, 201)?.disabled, false);
  assert.match(buildSubsetDiscoveryPanel({ ...partial, checkpointSaved: false }, 100)!.label, /could not be saved/);
  assert.equal(buildSubsetDiscoveryPanel({ ...partial, complete: true, remaining: 0, verified: 101 }), undefined);
});
test("first subset Up reaches the enabled discovery action; Down preserves expanded and next-card navigation", () => {
  const action = {} as HTMLElement, achievement = {} as HTMLElement, next = {} as HTMLElement;
  let enabled = true, expanded = false;
  const root = { querySelector: () => enabled ? action : null, querySelectorAll: () => [source, next] };
  const container = { querySelector: () => expanded ? achievement : null };
  const source = { closest: (selector: string) => selector.includes("-container") ? container : root } as unknown as HTMLElement;
  assert.equal(getRetroAchievementsFirstSubsetTarget(source, "up"), action);
  assert.equal(getRetroAchievementsFirstSubsetTarget(source, "down"), next);
  expanded = true;
  assert.equal(getRetroAchievementsFirstSubsetTarget(source, "down"), achievement);
  enabled = false;
  assert.equal(getRetroAchievementsFirstSubsetTarget(source, "up"), source, "completed/disabled action cannot take focus");
});
test("discovery is inside the shared vertical focus tree, preserves A/touch/Back and restores focus when its action disappears", async () => {
  const [section, panel, button, page] = await Promise.all([
    "decky-retroachievements-subsets-section.tsx", "decky-retroachievements-subset-discovery-panel.tsx", "decky-full-screen-action-controls.tsx", "decky-full-screen-game-page.tsx",
  ].map((name) => readFile(new URL(`../src/platform/decky/${name}`, import.meta.url), "utf8")));
  assert.match(section!, /data-achievement-companion-ra-subsets-section[\s\S]*flow-children="vertical"[\s\S]*DeckyRetroAchievementsSubsetDiscoveryPanel[\s\S]*subsets\.map/);
  assert.match(section!, /requestDeckySteamGamepadFocusAfterMount\(target\)/);
  assert.match(section!, /action \?\? root\?\.querySelector/);
  assert.match(section!, /getRetroAchievementsFirstSubsetTarget/);
  assert.match(panel!, /onCancel=\{onBack\}/);
  assert.match(panel!, /DeckyFullscreenActionButton[\s\S]*compact[\s\S]*onClick=\{onContinue\}/);
  assert.match(button!, /onActivate=\{handleClick\}[\s\S]*onClick=\{handleClick\}/);
  assert.match(page!, /subsetContinueRunningRef\.current \|\| subsetDiscoveryStatus\?\.running/);
  assert.doesNotMatch(page!, /<p>\{relatedGamesState\.error\?\.userMessage\}<\/p>/);
});
test("Community busy surface fills its inherited viewport without the Overview inset; footer space and branded loader remain owned", async () => {
  const [page, resource, loader] = await Promise.all([
    "decky-full-screen-game-page.tsx", "decky-retroachievements-community-resource.tsx", "decky-full-screen-loading-state.tsx",
  ].map((name) => readFile(new URL(`../src/platform/decky/${name}`, import.meta.url), "utf8")));
  assert.match(page!, /if \(section === "community" && fillCommunity\)[\s\S]*flex: "1 1 auto", minHeight: 0, padding: 0/);
  assert.match(page!, /paddingBottom: footerHeight/);
  assert.match(page!, /fillHeight=\{activeSteamSection === "overview" \|\| \(!isSteamProvider && activeSteamSection === "community"\)\}/);
  assert.match(resource!, /data-ra-community-loading-viewport style=\{\{ flex: "1 1 auto", minHeight: 0, width: "100%"/);
  assert.doesNotMatch(resource!, /PanelSectionRow|PanelSection|minHeight: \d{3}/);
  assert.match(loader!, /DeckyLoadingBrandMark[\s\S]*getLoadingInfoStyle\(\)/);
});
