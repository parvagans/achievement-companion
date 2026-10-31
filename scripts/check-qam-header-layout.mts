import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { renderCompactProfileHeader } from "../tests/helpers/compact-profile-header-render";

// A local Chromium layout check, not a substitute for Steam/GamepadUI verification.
const output = resolve(".tmp/qam-header");
mkdirSync(output, { recursive: true });
const before = process.argv[2];
const cases: string[] = [];
for (const provider of ["Steam", "RetroAchievements"]) for (const width of [268, 284, 320]) {
  for (const resolution of [0, 32, 512, 2048]) for (const focused of [false, true]) {
    const avatar = resolution ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${resolution}" height="${resolution}"><rect width="100%" height="100%" fill="#159ccb"/><circle cx="${resolution / 2}" cy="${resolution / 2}" r="${resolution / 3}" fill="white"/></svg>`)}` : undefined;
    const { html } = renderCompactProfileHeader({ provider, focused, currentGame: provider === "RetroAchievements",
      ...(avatar ? { avatar } : {}), ...(before ? { sourcePath: before } : {}) });
    cases.push(`<section class="case ${focused ? "light" : ""}" data-case="${provider}/${width}/${resolution}/${focused}" style="width:${width}px"><small>${provider} · ${width}px · ${resolution || "missing"} · ${focused ? "focused/light" : "normal/dark"}</small>${html}</section>`);
  }
}
const script = `
window.addEventListener('load', () => {
 const failures = [], measurements = [];
 for (const row of document.querySelectorAll('.case')) {
  const header = row.querySelector('[data-ac-compact-profile-header]'), control = row.querySelector('[aria-label^="Open " ]');
  const avatar = row.querySelector('[data-ac-compact-profile-avatar]') || control.querySelector('span');
  const heading = header.firstElementChild, image = control.querySelector('img');
  const box = n => { const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
  const h=box(header), c=box(control), a=box(avatar), t=box(heading), i=image && box(image);
  const range=document.createRange(); range.selectNodeContents(heading); const text=range.getBoundingClientRect();
  const pin=box(row.querySelector('[aria-label="Pinned Achievements"]'));
  const checks = { pinTarget:pin.width===38 && pin.height===38, headerHeight:Math.abs(h.height-38)<.1, controlHeight:Math.abs(c.height-38)<.1,
   contentWidth:c.width===38, avatar:a.width===24 && a.height===24, image:!i || i.width===24 && i.height===24,
   noOverlap:t.right<=header.lastElementChild.getBoundingClientRect().left && text.right<=header.lastElementChild.getBoundingClientRect().left, oneLine:t.height<20, inside:c.right<=h.right+.1 };
  const result={name:row.dataset.case,header:h,control:c,avatar:a,image:i,checks}; measurements.push(result);
  if(Object.values(checks).some(v=>!v)) failures.push(result);
 }
 document.getElementById('layout-results').textContent=JSON.stringify({count:measurements.length,failures,measurements});
});`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:16px;background:#06111a;color:#f2f7fb;font-family:Arial,sans-serif}
main{display:grid;grid-template-columns:repeat(3,340px);gap:12px}.case{padding:8px;border:1px solid #456;box-sizing:content-box}
small{display:block;margin-bottom:6px;font-size:10px}.light{--ac-text-primary:#182c30;--ac-accent:#186a72;--ac-content-stat:linear-gradient(#e6e7dd,#d8ddd0);--ac-compact-focus-background:#ccdacc;background:#efeee3;color:#182c30}
</style></head><body><main>${cases.join("")}</main><pre id="layout-results"></pre><script>${script}</script></body></html>`;
const file = resolve(output, before ? "before.html" : "after.html");
writeFileSync(file, html);
const browser = process.env["AC_LAYOUT_BROWSER"] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const result = spawnSync(browser, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${output}/browser-profile`,
  "--dump-dom", "--virtual-time-budget=2000", "--window-size=1280,800", `--screenshot=${output}/${before ? "before" : "after"}.png`, pathToFileURL(file).href],
{ encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
if (result.error) throw result.error;
assert.equal(result.status, 0, result.stderr);
const payload = result.stdout.match(/<pre id="layout-results">(.*?)<\/pre>/s)?.[1];
assert.ok(payload, "Chromium did not produce rendered layout measurements");
const report = JSON.parse(payload.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
writeFileSync(resolve(output, before ? "before.json" : "after.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.count, failures: report.failures.length, sample: report.measurements[0], screenshot: `${output}/${before ? "before" : "after"}.png` }, null, 2));
assert.equal(report.failures.length, 0, "Rendered header geometry failed; see the local JSON report");
