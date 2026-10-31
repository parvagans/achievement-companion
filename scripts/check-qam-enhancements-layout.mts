import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { pinnedModalHarness } from "../tests/helpers/pinned-modal-render";
import { loadLocalComponent } from "../tests/helpers/render-decky-component";

const art = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#159ccb"/></svg>')}`;
const pins = Array.from({ length: 6 }, (_, index) => ({ providerId: index < 3 ? "steam" : "retroachievements", accountId: index < 3 ? "current" : "ra", gameId: String(index + 1), achievementId: String(index), completionMode: "hardcore" }));
const metadata = Object.fromEntries(pins.map((pin, index) => [JSON.stringify([pin.providerId, pin.accountId, pin.gameId]), { status: "success", data: {
  game: { providerId: pin.providerId, gameId: pin.gameId, title: `Example game ${index + 1}`, platformLabel: "PlayStation", coverImageUrl: art },
  achievements: [{ achievementId: pin.achievementId, title: "A meaningful achievement title", description: "Complete the final mission without losing a unit. ".repeat(3), badgeImageUrl: art }],
} }]));
const harness = pinnedModalHarness({ pins, metadata });
const modals = ["steam", "retroachievements"].map((initialProvider) => renderToStaticMarkup(createElement(harness.exports.PinnedAchievementsContent, { initialProvider, focusCloseButton: () => true, onDetails: () => {}, onList: () => {} })));
const disclosures: string[] = [];
for (const expanded of [false, true]) {
  const { exports } = loadLocalComponent("src/platform/decky/decky-compact-calendar-disclosure.tsx", {
    "./decky-compact-calendar-preference": { useCompactCalendarExpanded: () => [expanded, () => {}] },
    "./decky-focus-scroll": {}, "./decky-steam-gamepad-focus": {},
  });
  const target = { preferredFocus: false, onActivated: () => {}, onFocused: () => {} };
  for (const selectedDay of [undefined, new Date(2026, 9, 25).getTime()]) disclosures.push(renderToStaticMarkup(createElement(exports.DeckyCompactCalendarDisclosure, {
    providerId: "steam", weeks: 12, selectedDay, onClear: () => {}, onCancel: () => {}, targetProps: target, clearTargetProps: target,
    children: createElement("div", { style: { height: 100 } }, "Existing calendar mounts here"),
  })));
}
const output = resolve(".tmp/qam-enhancements"); mkdirSync(output, { recursive: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#06111a;color:#f2f7fb;font-family:Arial;margin:16px}main{display:flex;gap:18px}.modal{width:590px;min-width:0;padding:16px;background:#071b29;box-sizing:border-box}.disclosure{width:268px;margin-top:12px;border:1px solid #456}h2{font-size:20px}*{box-sizing:border-box}</style></head><body><p>Local component geometry preview — native Steam shell and controller behavior require Deck verification.</p><main>${modals.map((modal) => `<section class="modal"><h2>Pinned Achievements</h2>${modal}</section>`).join("")}</main>${disclosures.map((item) => `<section class="disclosure">${item}</section>`).join("")}<pre id="results"></pre><script>
window.addEventListener('load',()=>{
 const lists=[...document.querySelectorAll('[data-ac-pinned-list]')];
 const headers=[...document.querySelectorAll('[data-ac-calendar-disclosure]')];
 const results={listHeights:lists.map(x=>x.getBoundingClientRect().height),scrolls:lists.map(x=>x.scrollHeight>x.clientHeight),overflow:lists.some(x=>x.scrollWidth>x.clientWidth+1),
  disclosures:headers.map(x=>{const button=x.querySelector('[aria-expanded]'),heading=button.firstElementChild;const range=document.createRange();range.selectNodeContents(heading);return {height:button.getBoundingClientRect().height,overlap:range.getBoundingClientRect().right>button.lastElementChild.getBoundingClientRect().left};})};
 document.getElementById('results').textContent=JSON.stringify(results);
});</script></body></html>`;
const file = resolve(output, "preview.html"); writeFileSync(file, html);
const browser = process.env["AC_LAYOUT_BROWSER"] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const result = spawnSync(browser, ["--headless", "--disable-gpu", "--no-first-run", `--user-data-dir=${output}/profile`, "--dump-dom", "--virtual-time-budget=2000", "--window-size=1280,800", `--screenshot=${output}/preview.png`, pathToFileURL(file).href], { encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
assert.equal(result.status, 0, result.stderr);
const json = result.stdout.match(/<pre id="results">(.*?)<\/pre>/s)?.[1]; assert.ok(json);
const report = JSON.parse(json); writeFileSync(resolve(output, "measurements.json"), JSON.stringify(report, null, 2)); console.log(report);
assert.deepEqual(report.listHeights, [220, 220]); assert.deepEqual(report.scrolls, [true, true]); assert.equal(report.overflow, false);
for (const row of report.disclosures) { assert.equal(row.height, 38); assert.equal(row.overlap, false); }
