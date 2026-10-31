import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { pinnedModalHarness } from "../tests/helpers/pinned-modal-render";

const output = resolve(".tmp/pinned-card-refinement"); mkdirSync(output, { recursive: true });
const baseline = process.argv[2] ?? resolve(output, "head-modal.tsx");
if (!process.argv[2]) writeFileSync(baseline, execFileSync("git", ["show", "HEAD:src/platform/decky/decky-pinned-achievements-modal.tsx"]));
const art = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#159ccb"/></svg>')}`;
const specimens: string[] = [];
for (const provider of ["steam", "retroachievements"]) for (const variant of ["short", "long", "missing-art", "unavailable"]) {
  for (const width of [608, 440, 320]) for (const light of [false, true]) {
    const pins = ["1", "2"].map((gameId) => ({ providerId: provider, accountId: provider === "steam" ? "current" : "ra", gameId, achievementId: "a", completionMode: variant === "long" ? "softcore" : variant === "missing-art" ? "both" : "hardcore" }));
    const metadata = Object.fromEntries(pins.map((pin) => [JSON.stringify([pin.providerId, pin.accountId, pin.gameId]), variant === "unavailable" ? { status: "error" } : { status: "success", data: {
      game: { providerId: provider, gameId: pin.gameId, title: variant === "long" ? "A very long game title that must wrap sensibly without displacing the action controls ".repeat(2) : "Deep Rock Galactic: Survivor", platformLabel: variant === "long" ? "A long console and platform name".repeat(3) : "Nintendo 64", ...(variant !== "missing-art" ? { coverImageUrl: art } : {}) },
      achievements: [{ achievementId: "a", title: variant === "long" ? "An unusually long achievement title that needs two lines ".repeat(4) : "Slick, like butter", description: variant === "long" ? "Complete a demanding objective without losing any progress. ".repeat(12) : "Dodge 100 times during a run", ...(variant !== "missing-art" ? { badgeImageUrl: art } : {}) }],
    } }]));
    for (const phase of ["before", "after"]) {
      const harness = pinnedModalHarness({ pins, metadata, focusedAction: light, ...(phase === "before" ? { sourcePath: baseline } : {}) });
      const markup = renderToStaticMarkup(createElement(harness.exports.PinnedAchievementsContent, { initialProvider: provider, focusCloseButton: () => true, onDetails: () => {} }));
      specimens.push(`<section class="specimen ${light ? "light" : ""}" data-name="${provider}/${variant}/${width}/${light}" data-phase="${phase}" style="width:${width}px"><small>${phase} · ${provider} · ${variant} · ${width}px · ${light ? "light/focused" : "dark"}</small>${markup}</section>`);
    }
  }
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:16px;font:14px Arial;background:#06111a;color:#f2f7fb}main{display:grid;grid-template-columns:repeat(2,608px);gap:12px}.specimen{min-width:0}small{display:block;margin-bottom:6px}.light{--ac-text-primary:#182c30;--ac-text-secondary:#42555a;--ac-content-card:linear-gradient(#e6e7dd,#d8ddd0);--ac-content-stat:linear-gradient(#dedfd4,#cccebf);color:#182c30;background:#efeee3}*{box-sizing:border-box}</style></head><body><p>Actual modal card markup; native Steam shell and controller navigation are not simulated.</p><main>${specimens.join("")}</main><pre id="results"></pre><script>
window.addEventListener('load',()=>{
 const rows=[...document.querySelectorAll('.specimen')].map(sample=>{
  const list=sample.querySelector('[data-ac-pinned-list]'),cards=[...list.querySelectorAll('article')],first=cards[0],buttons=[...first.querySelectorAll('[role=button]')],info=first.querySelector('[data-ac-pin-achievement-info]'),actions=first.querySelector('[data-ac-pin-actions]');
  const r=e=>e.getBoundingClientRect(),view=r(list),box=r(first);
  const overflow=list.scrollWidth>list.clientWidth+1;
  const outside=buttons.some(b=>r(b).left<box.left||r(b).right>box.right||r(b).bottom>box.bottom);
  return {name:sample.dataset.name,phase:sample.dataset.phase,height:box.height,viewport:view.height,completeCards:cards.filter(c=>r(c).bottom<=view.bottom+.1).length,overflow,outside,targetHeights:buttons.map(b=>r(b).height),sideBySide:info&&actions ? r(actions).left>=r(info).right-1 && r(actions).top<r(info).bottom : null};
 });document.getElementById('results').textContent=JSON.stringify(rows);
});</script></body></html>`;
const file = resolve(output, "comparison.html"); writeFileSync(file, html);
const result = spawnSync(process.env["AC_LAYOUT_BROWSER"] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless", "--disable-gpu", "--no-first-run", `--user-data-dir=${output}/browser-profile`, "--dump-dom", "--virtual-time-budget=2000", "--window-size=1280,800", `--screenshot=${output}/comparison.png`, pathToFileURL(file).href], { encoding: "utf8", timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
assert.equal(result.status, 0, result.stderr);
const payload = result.stdout.match(/<pre id="results">(.*?)<\/pre>/s)?.[1]; assert.ok(payload);
const rows = JSON.parse(payload); writeFileSync(resolve(output, "measurements.json"), JSON.stringify(rows, null, 2));
const after = rows.filter((row: any) => row.phase === "after");
for (const row of after) {
  assert.equal(row.viewport, 220); assert.equal(row.overflow, false, row.name); assert.equal(row.outside, false, row.name);
  assert.ok(row.targetHeights.every((height: number) => height >= 38), row.name);
  assert.equal(row.sideBySide, !row.name.includes('/320/'), row.name);
}
console.log(JSON.stringify({ cases: after.length, shortCards: rows.filter((row: any) => row.name.includes('/short/608/false')) }, null, 2));
