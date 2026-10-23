import assert from "node:assert/strict";
import test from "node:test";
import type { GameDetailSnapshot, NormalizedAchievement } from "../src/core/domain";
import { buildDeckyAchievementModalModel } from "../src/platform/decky/decky-achievement-detail-modal-model";

function snapshot(providerId: "steam" | "retroachievements"): GameDetailSnapshot {
  return {
    game: {
      providerId, gameId: "game", title: "Sample Game", status: "in-progress",
      summary: { unlockedCount: 1, totalCount: 1 },
      metrics: [{ key: "total-players", label: "Total Players", value: "100" }],
    },
    achievements: [{
      providerId, gameId: "game", achievementId: "achievement", title: "Sample Achievement",
      description: "A complete description", badgeImageUrl: "/badge.png", isUnlocked: true,
      unlockedAt: 1000, points: 5,
      metrics: [
        { key: "true-ratio", label: "True Ratio", value: "12" },
        { key: "unlocked-count", label: "Total Players", value: "25" },
        { key: "hardcore-unlocked-count", label: "Hardcore Unlocks", value: "10" },
        { key: "softcore-unlocked-count", label: "Softcore Unlocks", value: "15" },
        { key: "author", label: "Author", value: "Creator" },
        { key: "global-percent", label: "Global Unlock Rate", value: "42.3" },
      ],
      ...(providerId === "retroachievements" ? { hardcoreUnlockedAt: 1000, softcoreUnlockedAt: 2000, unlockMode: "hardcore" as const, classification: "missable" as const } : {}),
    }],
  };
}

function withAchievement(base: GameDetailSnapshot, changes: Partial<NormalizedAchievement>): GameDetailSnapshot {
  return { ...base, achievements: [{ ...base.achievements[0]!, ...changes }] };
}

function withSteamHunters(base: GameDetailSnapshot, overrides: Record<string, unknown> = {}, groupName = "Base Game", dlcAppName?: string): GameDetailSnapshot {
  return {
    ...base,
    steamHunters: {
      source: "steamhunters", app: { appId: 1, playersQualifiedCount: 100, tags: [] },
      achievementsBySteamAchievementId: { achievement: { apiName: "achievement", localPercentage: 25, points: 30, obtainability: "obtainable", ...overrides } },
      achievementGroups: [],
      achievementGroupsBySteamAchievementId: { achievement: { achievementApiNames: ["achievement"], name: groupName, ...(dlcAppName !== undefined ? { dlcAppName } : {}) } },
    },
  } as GameDetailSnapshot;
}

test("RA achievement modal separates personal dates and sourced community counts", () => {
  const model = buildDeckyAchievementModalModel(snapshot("retroachievements"), "achievement", "hardcore");
  assert.ok(model);
  assert.equal(model.gameTitle, "Sample Game");
  assert.equal(model.artworkUrl, "/badge.png");
  assert.equal(model.status, "Hardcore unlocked");
  assert.deepEqual(model.yourUnlockMetrics.map(({ label, tone }) => ({ label, tone })), [
    { label: "Hardcore unlock", tone: "hardcore" }, { label: "Softcore unlock", tone: "softcore" },
  ]);
  assert.deepEqual(model.metadata, [{ label: "Type", value: "Missable" }, { label: "Author", value: "Creator" }]);
  assert.deepEqual(model.communityMetrics, [
    { label: "Points", value: "5" }, { label: "RetroPoints", value: "12" },
    { label: "Players unlocked", value: "25 / 100 (25.00%)" },
    { label: "Unlock modes", value: "10 Hardcore · 15 Softcore-only" },
  ]);
});

test("Steam achievement modal distinguishes SteamHunters qualified and Steam global data", () => {
  const base = snapshot("steam");
  const enriched = {
    ...base,
    steamHunters: {
      source: "steamhunters", app: { appId: 1, playersQualifiedCount: 100, tags: [] },
      achievementsBySteamAchievementId: { achievement: { apiName: "achievement", localPercentage: 25, points: 30, obtainability: "conditionally-obtainable" } },
      achievementGroups: [],
      achievementGroupsBySteamAchievementId: { achievement: { achievementApiNames: ["achievement"], name: "Extra Content" } },
    },
  } as GameDetailSnapshot;
  const model = buildDeckyAchievementModalModel(enriched, "achievement", "both");
  assert.ok(model);
  assert.equal(model.status, "Unlocked");
  assert.deepEqual(model.yourUnlockMetrics, [{ label: "Unlocked", value: new Date(1000).toLocaleString(), tone: "positive" }]);
  assert.deepEqual(model.metadata, [{ label: "Group", value: "Extra Content" }]);
  assert.deepEqual(model.communityMetrics, [
    { label: "SteamHunters points", value: "30" },
    { label: "SteamHunters qualified players", value: "25 / 100 (25%)" },
    { label: "Steam global unlock rate", value: "42.3%" },
    { label: "Obtainability", value: "Conditionally Obtainable", tone: "warning" },
  ]);
});

test("achievement modal omits unavailable community values and honors RA mode", () => {
  const base = snapshot("retroachievements");
  const bare = { ...base, achievements: [{ ...base.achievements[0]!, metrics: [], points: undefined, classification: undefined, hardcoreUnlockedAt: undefined, unlockMode: "softcore" }] } as GameDetailSnapshot;
  const model = buildDeckyAchievementModalModel(bare, "achievement", "softcore");
  assert.ok(model);
  assert.equal(model.status, "Softcore unlocked");
  assert.deepEqual(model.yourUnlockMetrics.map(({ label }) => label), ["Softcore unlock"]);
  assert.deepEqual(model.metadata, []);
  assert.deepEqual(model.communityMetrics, []);
  assert.equal(buildDeckyAchievementModalModel(bare, "missing", "both"), undefined);
});

test("RA modal combines identical Hardcore and Softcore dates", () => {
  const base = snapshot("retroachievements");
  const sameDate = { ...base, achievements: [{ ...base.achievements[0]!, softcoreUnlockedAt: 1000 }] } as GameDetailSnapshot;
  const model = buildDeckyAchievementModalModel(sameDate, "achievement", "both");
  assert.ok(model);
  assert.deepEqual(model.yourUnlockMetrics, [{ label: "Hardcore + Softcore", value: new Date(1000).toLocaleString(), tone: "hardcore" }]);
});

test("Steam locked and missing-date states do not imply a successful dated unlock", () => {
  const locked = buildDeckyAchievementModalModel(withAchievement(snapshot("steam"), { isUnlocked: false }), "achievement", "both")!;
  assert.deepEqual(locked.yourUnlockMetrics, [{ label: "Your unlock", value: "Locked", tone: "muted" }]);
  const undated = buildDeckyAchievementModalModel(withAchievement(snapshot("steam"), { unlockedAt: undefined }), "achievement", "both")!;
  assert.deepEqual(undated.yourUnlockMetrics, [{ label: "Unlocked", value: "Date not recorded", tone: "positive" }]);
});

test("RA distinguishes an actual other-mode date from the selected mode's locked state", () => {
  const softcoreOnly = withAchievement(snapshot("retroachievements"), { hardcoreUnlockedAt: undefined, unlockMode: "softcore" });
  const model = buildDeckyAchievementModalModel(softcoreOnly, "achievement", "hardcore")!;
  assert.equal(model.isUnlocked, false);
  assert.deepEqual(model.yourUnlockMetrics, [
    { label: "Softcore unlock", value: new Date(2000).toLocaleString(), tone: "softcore" },
    { label: "Hardcore unlock", value: "Locked", tone: "muted" },
  ]);
});

test("RA retains both recorded mode dates without adding a contradictory locked entry", () => {
  const model = buildDeckyAchievementModalModel(snapshot("retroachievements"), "achievement", "softcore")!;
  assert.equal(model.isUnlocked, true);
  assert.equal(model.status, "Softcore unlocked");
  assert.deepEqual(model.yourUnlockMetrics.map(({ label }) => label), ["Hardcore unlock", "Softcore unlock"]);
  assert.equal(model.yourUnlockMetrics.some(({ value }) => value === "Locked"), false);
});

test("RA legacy unlocks use their generic date when mode dates are absent", () => {
  const legacy = withAchievement(snapshot("retroachievements"), { hardcoreUnlockedAt: undefined, softcoreUnlockedAt: undefined });
  const model = buildDeckyAchievementModalModel(legacy, "achievement", "hardcore")!;
  assert.deepEqual(model.yourUnlockMetrics, [{ label: "Hardcore unlocked", value: new Date(1000).toLocaleString(), tone: "hardcore" }]);
});

test("Steam omits routine obtainability and base-game metadata but keeps exceptional restrictions", () => {
  for (const groupName of ["Base Game", "base-game", "Sample Game"]) {
    const model = buildDeckyAchievementModalModel(withSteamHunters(snapshot("steam"), {}, groupName), "achievement", "both")!;
    assert.deepEqual(model.metadata, []);
    assert.equal(model.communityMetrics.some(({ label }) => label === "Obtainability"), false);
  }
  const restricted = buildDeckyAchievementModalModel(withSteamHunters(snapshot("steam"), { obtainability: "unobtainable" }), "achievement", "both")!;
  assert.deepEqual(restricted.communityMetrics.find(({ label }) => label === "Obtainability"), { label: "Obtainability", value: "Unobtainable", tone: "danger" });
  const dlc = buildDeckyAchievementModalModel(withSteamHunters(snapshot("steam"), {}, "Extra Content", "Expansion One"), "achievement", "both")!;
  assert.deepEqual(dlc.metadata, [{ label: "DLC", value: "Expansion One" }]);
  assert.equal(dlc.communityMetrics.some(({ label }) => label === "DLC" || label === "Group"), false);
});

test("RA combines only available validated mode counts and retains sourced zero", () => {
  const base = snapshot("retroachievements");
  const counts = [
    { key: "unlocked-count", label: "Total Players", value: "0" },
    { key: "hardcore-unlocked-count", label: "Hardcore Unlocks", value: "0" },
  ];
  const model = buildDeckyAchievementModalModel(withAchievement(base, { metrics: counts }), "achievement", "both")!;
  assert.deepEqual(model.communityMetrics.find(({ label }) => label === "Players unlocked"), { label: "Players unlocked", value: "0 / 100 (0.00%)" });
  assert.deepEqual(model.communityMetrics.find(({ label }) => label === "Unlock modes"), { label: "Unlock modes", value: "0 Hardcore" });
  assert.equal(model.communityMetrics.some(({ value }) => value.includes("Softcore")), false);
});

test("RA invalid counts and denominators do not become fabricated players or percentages", () => {
  const base = snapshot("retroachievements");
  const invalid = withAchievement(base, { metrics: [
    { key: "unlocked-count", label: "Total Players", value: "-2" },
    { key: "hardcore-unlocked-count", label: "Hardcore Unlocks", value: "1.5" },
    { key: "softcore-unlocked-count", label: "Softcore Unlocks", value: "NaN" },
  ] });
  const model = buildDeckyAchievementModalModel(invalid, "achievement", "both")!;
  assert.deepEqual(model.communityMetrics.map(({ label }) => label), ["Points"]);
  for (const denominator of ["0", "-1", "1.5", "10"]) {
    const badDenominator = { ...base, game: { ...base.game, metrics: [{ key: "total-players", label: "Total Players", value: denominator }] } };
    const current = buildDeckyAchievementModalModel(badDenominator, "achievement", "both")!;
    assert.deepEqual(current.communityMetrics.find(({ label }) => label === "Players unlocked"), { label: "Players unlocked", value: "25" });
  }
});

test("Steam community rates reject invalid percentages and keep distinct populations at equal rates", () => {
  const equalRates = withAchievement(snapshot("steam"), { metrics: [{ key: "global-percent", label: "Global Unlock Rate", value: "25" }] });
  const model = buildDeckyAchievementModalModel(withSteamHunters(equalRates), "achievement", "both")!;
  assert.equal(model.communityMetrics.some(({ label }) => label === "SteamHunters qualified players"), true);
  assert.equal(model.communityMetrics.some(({ label }) => label === "Steam global unlock rate"), true);
  const invalid = withAchievement(snapshot("steam"), { metrics: [{ key: "global-percent", label: "Global Unlock Rate", value: "101" }] });
  const invalidModel = buildDeckyAchievementModalModel(withSteamHunters(invalid, { localPercentage: -1 }), "achievement", "both")!;
  assert.deepEqual(invalidModel.communityMetrics.map(({ label }) => label), ["SteamHunters points"]);
});
