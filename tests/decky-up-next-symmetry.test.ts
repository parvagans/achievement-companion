import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { overviewFixtureRenderer, overviewMeasurementScript, type OverviewFixture } from "./helpers/decky-overview-fixture";

test("only the internal list fills three tracks; one/two suggestions keep natural tracks and native focus ownership", async () => {
  const { content } = await overviewFixtureRenderer();
  for (const count of [1, 2, 3]) for (const pinned of [false, true]) {
    const suggestions = Array.from({ length: count }, (_, i) => ({ achievement: { providerId: "steam", gameId: "1", achievementId: String(i), title: "Target", description: "Full description ".repeat(30), metrics: [], isUnlocked: false }, pinned: pinned && i === 0 }));
    const actions = { suggestions, hiddenSuggestions: [], onTogglePin() {}, onFocusedSuggestionChange() {}, onOpenAchievement() {}, onJumpToAchievement() {}, onDismissSuggestion() {} };
    const panel = content.DeckyOverviewCompanion({ actions, completed: false, history: null });
    assert.deepEqual(panel.props.style, { ...content.overviewPanelStyle, gap: 6 }, "outer surface dimensions and padding are unchanged");
    const list = panel.props.children[1];
    assert.equal(list.props["flow-children"], "column"); assert.equal(list.props.style.gap, 8);
    assert.equal(list.props.style.gridTemplateRows, count === 3 ? "repeat(3, minmax(0, 1fr))" : `repeat(${count}, max-content)`);
    assert.equal(list.props.style.overflowY, undefined, "long text must not turn Overview into a scroll list");
    for (const element of list.props.children) {
      const row = content.SuggestionRow(element.props);
      assert.equal(row.props["flow-children"], "left-right"); assert.equal(row.props.style.alignItems, "center");
      assert.equal(row.props.children[0].props.style.alignSelf, "stretch");
      assert.equal(row.props.children[0].props.style.gridTemplateColumns, "36px minmax(0, 1fr) 88px");
      assert.equal(row.props.children[0].props.style.padding, "4px 8px");
      assert.equal(element.key, element.props.suggestion.achievement.achievementId);
      const description = row.props.children[0].props.children[1].props.children[1];
      assert.equal(description.props.children, suggestions[0]!.achievement.description);
      assert.equal(description.props.style.whiteSpace, "pre-wrap");
      assert.equal(description.props.style.WebkitLineClamp, 2);
      assert.equal(row.props.children[0].props["aria-label"].includes(suggestions[0]!.achievement.description), true, "full canonical description remains accessible");
    }
  }
});

test("browser-rendered cards fill the existing panel symmetrically without clipping or normal-content scrolling", { skip: !process.env.AC_LAYOUT_BROWSER }, async () => {
  const output = resolve(process.env.AC_LAYOUT_OUTPUT ?? ".tmp/up-next-pins/symmetry-layout");
  await mkdir(output, { recursive: true });
  const short = "Collect the first reward.";
  const long = "Complete every objective in the stage without losing a life or restarting the mission.";
  const fixtures: OverviewFixture[] = [];
  const starcraft = [
    'Complete the Zerg mission "Omega" from the Brood War expansion to finish the "The Queen of Blades" campaign and expansion.',
    'Control 5 Archons at the same time in the Protoss mission "The Insurgent" from the Brood War expansion.',
    'Infest 5 Command Centers in the Zerg mission "The Kel-Morian Combine" from the Brood War expansion.',
  ];
  fixtures.push({ id: "starcraft-screenshot", width: 800, height: 425, scale: 1.5, descriptions: starcraft, titles: ["Queen Bitch of the Universe", "Thoughts in Chaos", "I Am Wretched..."], firstClassification: "win-condition", pinned: true });
  for (const viewport of [{ id: "deck", width: 800, height: 425, scale: 1.5 }, { id: "smaller-ui", width: 976, height: 512, scale: 1.25 }, { id: "docked", width: 1232, height: 610, scale: 1.5 }]) {
    for (const [name, descriptions] of [["short", [short, short, short]], ["long", [long, long, long]], ["mixed", [short, long, short]], ["one", [short]], ["two", [short, short]], ["extreme", [short, long.repeat(20), short]]] as const) {
      fixtures.push({ ...viewport, id: `${viewport.id}-${name}`, descriptions, pinned: name === "mixed", theme: name === "long" ? "ac-ember" : "ac-blue", missingArt: name === "two", longTitle: name === "long" });
    }
  }
  const run = async (name: string, source?: string) => {
    const renderer = await overviewFixtureRenderer(source);
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:16px;background:#0d1420;color:white}*{box-sizing:border-box}</style>${fixtures.map(renderer.render).join("")}<pre id="measurements"></pre><script>${overviewMeasurementScript()}</script>`;
    const file = resolve(output, `${name}.html`);
    await writeFile(file, html);
    const result = spawnSync(process.env.AC_LAYOUT_BROWSER!, ["--headless", "--disable-gpu", "--disable-extensions", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(output, "browser-profile")}`, "--host-resolver-rules=MAP * ~NOTFOUND", "--force-device-scale-factor=1", "--window-size=1280,800", "--virtual-time-budget=1000", `--screenshot=${resolve(output, `${name}.png`)}`, "--dump-dom", pathToFileURL(file).href], { encoding: "utf8", timeout: 45000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr.slice(-1000));
    const serialized = /<pre id="measurements">([^<]+)<\/pre>/.exec(result.stdout)?.[1];
    assert.ok(serialized, "the browser produced actual layout measurements");
    const reports = JSON.parse(serialized) as any[];
    await writeFile(resolve(output, `${name}-measurements.json`), JSON.stringify(reports, null, 2));
    return reports;
  };
  const after = await run("after");
  for (const report of after) {
    const fixture = fixtures.find((item) => item.id === report.id)!;
    const scale = fixture.scale;
    const tolerance = 1.1;
    assert.ok(report.rootOverflow <= 1, `${report.id}: outer Overview remains within its existing height`);
    for (const gap of report.gaps) assert.ok(Math.abs(gap - 8 * scale) < tolerance, `${report.id}: consistent gaps`);
    for (const card of report.cards) {
      assert.ok(Math.abs(card.pin.y + card.pin.height / 2 - card.rect.y - card.rect.height / 2) < tolerance, `${report.id}: centered thumbtack`);
      assert.ok(Math.abs(card.text.y + card.text.height / 2 - card.rect.y - card.rect.height / 2) < tolerance, `${report.id}: centered content`);
      if (card.art) assert.ok(Math.abs(card.art.height - 36 * scale) < tolerance);
      assert.equal(card.description.lineClamp, "2", `${report.id}: bounded summary`);
      assert.ok(card.description.clientHeight <= 2 * card.description.lineHeight + 1, `${report.id}: at most two visible lines`);
      assert.ok(card.description.rect.bottom <= card.rect.bottom + tolerance);
      assert.ok(card.rect.bottom <= report.list.bottom + tolerance, `${report.id}: every card is inside the list`);
    }
    assert.ok(report.scrollHeight <= report.clientHeight + 1, `${report.id}: even extreme descriptions must not push cards below the panel`);
    if (report.cards.length === 3) {
      const heights = report.cards.map((card: any) => card.rect.height);
      assert.ok(Math.max(...heights) - Math.min(...heights) < tolerance, `${report.id}: equal card heights`);
      assert.ok(Math.abs(report.cards[2].rect.bottom - report.list.bottom) < tolerance, `${report.id}: use the full list height`);
    }
    if (report.id.endsWith("-short")) assert.ok(report.scrollHeight <= report.clientHeight + 1, `${report.id}: normal content does not scroll`);
    if (report.cards.length < 3) assert.ok(report.cards[0].rect.height < report.list.height * .6, `${report.id}: do not inflate a single card`);
  }
  if (process.env.AC_LAYOUT_BEFORE_SOURCE) {
    const before = await run("before", await readFile(process.env.AC_LAYOUT_BEFORE_SOURCE, "utf8"));
    for (const fixture of fixtures) {
      const old = before.find((item) => item.id === fixture.id), current = after.find((item) => item.id === fixture.id);
      assert.equal(current.panel.width, old.panel.width, `${fixture.id}: outer panel width unchanged`);
      assert.equal(current.panel.height, old.panel.height, `${fixture.id}: outer panel height unchanged`);
      assert.equal(current.progress.width, old.progress.width); assert.equal(current.progress.height, old.progress.height);
    }
  }
});
