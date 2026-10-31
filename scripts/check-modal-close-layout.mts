import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import ts from "typescript";

const output = resolve(".tmp/modal-close"); mkdirSync(output, { recursive: true });
const guard = ts.transpileModule(readFileSync("src/platform/decky/decky-modal-close-scroll.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const html = `<!doctype html><html><head><style>body{font:16px Arial;background:#06111a;color:#f2f7fb;margin:20px}main{display:flex;gap:20px}.outer{height:380px;width:550px;overflow:auto;border:1px solid #456}.dialog{padding:16px;background:#071b29}.content{height:160px;overflow:auto;border:1px solid #456}button{height:38px;width:100%;margin-top:16px}.gpfocus{outline:2px solid #2bc3f2}</style></head><body><p>Local browser scroll regression fixture; native Steam interaction requires hardware testing.</p><main>${["What's New", "Pinned Achievements"].map((title, index) => `<div class="outer"><section class="dialog"><h2>${title}</h2><div class="content" style="height:${index ? 220 : 160}px"><div style="height:600px">Scrollable content stays independent.</div></div><button>Close</button></section><div style="height:500px"></div></div>`).join("")}</main><pre id="results"></pre><script>
const exports={};${guard}
window.addEventListener('load',async()=>{
 const results=[];
 for(const outer of document.querySelectorAll('.outer')){
  const dialog=outer.querySelector('.dialog'),content=outer.querySelector('.content'),button=outer.querySelector('button');
  content.scrollTop=80;const before=dialog.getBoundingClientRect().top;
  const lock=exports.preserveModalAncestorScrollWhileFocused(button);
  button.classList.add('gpfocus');button.focus({preventScroll:true});outer.scrollTop=55;lock.restore();
  outer.scrollTop=65;outer.dispatchEvent(new Event('scroll'));
  await Promise.resolve();
  results.push({before,after:dialog.getBoundingClientRect().top,outerScroll:outer.scrollTop,innerScroll:content.scrollTop});
  button.classList.remove('gpfocus');await Promise.resolve();outer.scrollTop=35;outer.dispatchEvent(new Event('scroll'));
  results[results.length-1].releasedScroll=outer.scrollTop;lock.release();outer.scrollTop=0;
 }
 document.getElementById('results').textContent=JSON.stringify(results);
});</script></body></html>`;
const file = resolve(output, "fixture.html"); writeFileSync(file, html);
const result = spawnSync(process.env["AC_LAYOUT_BROWSER"] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless", "--disable-gpu", "--no-first-run", `--user-data-dir=${output}/profile`, "--dump-dom", "--virtual-time-budget=2000", "--window-size=1280,800", `--screenshot=${output}/fixture.png`, pathToFileURL(file).href], { encoding: "utf8", timeout: 45000, maxBuffer: 2 * 1024 * 1024 });
assert.equal(result.status, 0, result.stderr);
const payload = result.stdout.match(/<pre id="results">(.*?)<\/pre>/s)?.[1]; assert.ok(payload);
const report = JSON.parse(payload); console.log(report); writeFileSync(resolve(output, "measurements.json"), JSON.stringify(report, null, 2));
for (const row of report) { assert.equal(row.before, row.after); assert.equal(row.outerScroll, 0); assert.equal(row.innerScroll, 80); assert.equal(row.releasedScroll, 35); }
