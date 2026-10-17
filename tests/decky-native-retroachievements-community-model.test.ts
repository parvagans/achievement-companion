import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { NormalizedAchievement } from "../src/core/domain";
import {
  buildNativeRetroAchievementsCommunityModel,
  buildNativeRetroAchievementsCommunityModels,
  getRetroAchievementsAvailabilityDate,
} from "../src/platform/decky/decky-native-retroachievements-community-model";

test("hardcore native Community stats use RA progression medians and distribution mastery", () => {
  assert.deepEqual(buildNativeRetroAchievementsCommunityModel({
    mode: "hardcore",
    achievementsAvailableSince: "2021-11-01",
    stats: {
      totalPlayers: 2_224,
      beatenHardcoreSamples: 933,
      medianBeatSeconds: 13_800,
      masteredPlayers: 588,
      masteryPercent: 26.4388,
      masteredSamples: 500,
      medianMasterySeconds: 24_360,
    },
  }), {
    modeLabel: "Hardcore",
    achievementsAvailableSince: "2021-11-01",
    rows: [
      { id: "unlocked", label: "Unlocked an achievement", playerCount: 2_224 },
      { id: "beaten", label: "Beat the game", playerCount: 933, playerPercent: (933 / 2_224) * 100, medianSeconds: 13_800 },
      { id: "mastered", label: "Mastered", playerCount: 588, playerPercent: 26.4388, medianSeconds: 24_360 },
    ],
  });
});

test("softcore native Community stats use the casual completion fields", () => {
  const model = buildNativeRetroAchievementsCommunityModel({
    mode: "softcore",
    stats: {
      totalPlayers: 500,
      beatenSamples: 200,
      medianBeatSoftcoreSeconds: 3_600,
      completedSamples: 75,
      medianCompletionSeconds: 7_200,
    },
  });
  assert.equal(model?.modeLabel, "Casual");
  assert.deepEqual(model?.rows.map((row) => row.id), ["unlocked", "beaten", "completed"]);
  assert.equal(model?.rows[1]?.playerPercent, 40);
  assert.equal(model?.rows[2]?.playerPercent, 15);
});

test("native Community exposes Casual and Hardcore together without a saved-mode input", () => {
  const models = buildNativeRetroAchievementsCommunityModels({
    achievementsAvailableSince: "2021-11-01",
    stats: {
      totalPlayers: 1_000,
      beatenSamples: 400,
      medianBeatSoftcoreSeconds: 3_600,
      completedSamples: 250,
      medianCompletionSeconds: 7_200,
      beatenHardcoreSamples: 300,
      medianBeatSeconds: 5_400,
      masteredPlayers: 100,
      masteryPercent: 10,
      medianMasterySeconds: 10_800,
    },
  });
  assert.equal(models?.casual?.modeLabel, "Casual");
  assert.deepEqual(models?.casual?.rows.map((row) => row.id), ["unlocked", "beaten", "completed"]);
  assert.equal(models?.hardcore?.modeLabel, "Hardcore");
  assert.deepEqual(models?.hardcore?.rows.map((row) => row.id), ["unlocked", "beaten", "mastered"]);
  assert.deepEqual(models?.latestMasters, []);
  assert.equal(models?.casual?.achievementsAvailableSince, "2021-11-01");
  assert.equal(models?.hardcore?.achievementsAvailableSince, "2021-11-01");
});

test("missing community values stay absent instead of becoming false zeroes", () => {
  assert.equal(buildNativeRetroAchievementsCommunityModel({ mode: "hardcore", stats: undefined }), undefined);
  assert.equal(buildNativeRetroAchievementsCommunityModel({ mode: "hardcore", stats: {} }), undefined);
  assert.equal(buildNativeRetroAchievementsCommunityModels({ stats: undefined }), undefined);
  const latestOnly = buildNativeRetroAchievementsCommunityModels({
    stats: {
      latestMasters: [{ username: "TempoBlues", rank: 689, masteredAt: "2026-10-14T12:00:00.000Z" }],
    },
  });
  assert.equal(latestOnly?.casual, undefined);
  assert.equal(latestOnly?.hardcore, undefined);
  assert.equal(latestOnly?.latestMasters[0]?.rank, 689);
  const model = buildNativeRetroAchievementsCommunityModel({
    mode: "hardcore",
    stats: { medianBeatSeconds: 100 },
  });
  assert.deepEqual(model?.rows, [{ id: "beaten", label: "Beat the game", medianSeconds: 100 }]);
});

test("achievement availability uses the earliest valid RA creation date", () => {
  const rows = [
    { achievementId: "1", metrics: [{ key: "date-created", label: "Created", value: "2022-03-04 00:00:00" }] },
    { achievementId: "2", metrics: [{ key: "date-created", label: "Created", value: "2020-01-02 12:00:00" }] },
    { achievementId: "3", metrics: [{ key: "date-created", label: "Created", value: "unknown" }] },
  ].map((row): NormalizedAchievement => ({
    providerId: "retroachievements",
    gameId: "123",
    title: row.achievementId,
    description: "",
    badgeImageUrl: "",
    isUnlocked: false,
    ...row,
  }));
  assert.equal(getRetroAchievementsAvailabilityDate(rows), "2020-01-02");
});

test("Latest Masters paints one clipped highlight from native GamepadUI focus", () => {
  const source = readFileSync(
    "src/platform/decky/decky-native-retroachievements-community.tsx",
    "utf8",
  );
  assert.match(source, /\.Panel\.Focusable\.gpfocus/u);
  assert.match(source, /box-shadow: inset 0 0 0 2px/u);
  assert.match(source, /transform: none !important/u);
  const latestMasterRowSource = source.slice(
    source.indexOf("function LatestMasterRow"),
    source.indexOf("function CommunityModeButton"),
  );
  assert.doesNotMatch(latestMasterRowSource, /setFocused/u);
  assert.match(latestMasterRowSource, /onActivate=\{\(\) => \{\}\}/u);
  assert.doesNotMatch(latestMasterRowSource, /onClick|NavigateToExternalWeb|role="link"/u);
  assert.match(source, /const visibleLatestMasters = models\.latestMasters/u);
  assert.doesNotMatch(source, /Show all 10|Show 10 more|Show all latest masters/u);
  assert.match(source, /className=\{COMMUNITY_MODE_BUTTON_CLASS\}/u);
  assert.doesNotMatch(source.slice(source.indexOf("function CommunityModeButton"), source.indexOf("function playerCaption")), /setFocused/u);
  assert.match(source, /event\.detail\.button === GamepadButton\.DIR_RIGHT/u);
  assert.match(source, /event\.detail\.button === GamepadButton\.DIR_LEFT/u);
  assert.match(source, /event\.detail\.button === GamepadButton\.DIR_UP/u);
  assert.match(source, /event\.detail\.button === GamepadButton\.DIR_DOWN/u);
  assert.match(source, /handleCasualDirection/u);
  assert.match(source, /handleHardcoreDirection/u);
  assert.match(source, /handleLatestMasterDirection/u);
  assert.match(source, /focusLatestMaster\(event, index - 1\)/u);
  assert.match(source, /focusLatestMaster\(event, index \+ 1\)/u);
  assert.match(source, /takeDeckySteamGamepadFocus/u);
  assert.doesNotMatch(source, /<Section\s+label="Playtime Stats"/u);
  assert.match(source, /<div style=\{\{ color: palette\.text, fontSize: 18, fontWeight: 650, whiteSpace: "nowrap" \}\}>Playtime Stats<\/div>/u);
  assert.match(source, /paddingTop: 12/u);
});
