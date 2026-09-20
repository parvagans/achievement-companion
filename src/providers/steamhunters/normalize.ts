import type {
  RawSteamHuntersAchievementResponse,
  RawSteamHuntersAchievementGroupResponse,
  RawSteamHuntersAchievementGroupsResponse,
  RawSteamHuntersAppResponse,
  RawSteamHuntersTag,
} from "./raw-types";
import type {
  SteamHuntersAchievement,
  SteamHuntersAchievementGroup,
  SteamHuntersApp,
  SteamHuntersObtainability,
  SteamHuntersTag,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRawApp(value: unknown): RawSteamHuntersAppResponse | undefined {
  return isRecord(value) ? value as RawSteamHuntersAppResponse : undefined;
}

function asRawAchievement(value: unknown): RawSteamHuntersAchievementResponse | undefined {
  return isRecord(value) ? value as RawSteamHuntersAchievementResponse : undefined;
}

function asRawAchievementGroup(value: unknown): RawSteamHuntersAchievementGroupResponse | undefined {
  return isRecord(value) ? value as RawSteamHuntersAchievementGroupResponse : undefined;
}

function asRawTag(value: unknown): RawSteamHuntersTag | undefined {
  return isRecord(value) ? value as RawSteamHuntersTag : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  const numberValue = finiteNumber(value);
  return numberValue !== undefined && numberValue >= 0 && Number.isInteger(numberValue)
    ? numberValue
    : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const numberValue = finiteNumber(value);
  return numberValue !== undefined && numberValue >= 0 ? numberValue : undefined;
}

function percentage(value: unknown): number | undefined {
  const numberValue = finiteNumber(value);
  return numberValue !== undefined && numberValue >= 0 && numberValue <= 100 ? numberValue : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const normalized = stringValue(entry);
    return normalized === undefined ? [] : [normalized];
  });
}

export function normalizeSteamHuntersObtainability(value: unknown): SteamHuntersObtainability {
  switch (value) {
    case 0:
      return "obtainable";
    case 1:
      return "broken-but-obtainable";
    case 2:
      return "conditionally-obtainable";
    case 3:
      return "unobtainable";
    default:
      return "unknown";
  }
}

function normalizeTags(value: unknown): readonly SteamHuntersTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const rawTag = asRawTag(entry);
    if (rawTag === undefined) {
      return [];
    }

    const name = stringValue(rawTag.name);
    if (name === undefined) {
      return [];
    }

    const id = nonNegativeInteger(rawTag.tagId);
    return [{ name, ...(id !== undefined ? { id } : {}) }];
  });
}

export function normalizeSteamHuntersApp(value: unknown): SteamHuntersApp | undefined {
  const raw = asRawApp(value);
  if (raw === undefined) {
    return undefined;
  }

  const appId = nonNegativeInteger(raw.appId);
  if (appId === undefined || appId <= 0) {
    return undefined;
  }

  const name = stringValue(raw.name);
  const achievementCount = nonNegativeInteger(raw.achievementCount);
  const playersPerfectedCount = nonNegativeInteger(raw.playersPerfectedCount);
  const playersCompletedCount = nonNegativeInteger(raw.playersCompletedCount);
  const playersBaseGameCompletedCount = nonNegativeInteger(raw.playersBaseGameCompletedCount);
  const playersStartedCount = nonNegativeInteger(raw.playersStartedCount);
  const playersQualifiedCount = nonNegativeInteger(raw.playersQualifiedCount);
  const playerCount = nonNegativeInteger(raw.playerCount);
  const userCount = nonNegativeInteger(raw.userCount);
  const unobtainableAchievementCount = nonNegativeInteger(raw.unobtainableAchievementCount);
  const points = nonNegativeNumber(raw.points);
  const fastestCompletionTime = nonNegativeInteger(raw.fastestCompletionTime);
  const medianCompletionTime = nonNegativeInteger(raw.medianCompletionTime);
  const releaseDate = stringValue(raw.releaseDate);
  const hasPaidDlc = booleanValue(raw.hasPaidDlc);

  return {
    appId,
    ...(name !== undefined ? { name } : {}),
    ...(achievementCount !== undefined ? { achievementCount } : {}),
    ...(playersPerfectedCount !== undefined ? { playersPerfectedCount } : {}),
    ...(playersCompletedCount !== undefined ? { playersCompletedCount } : {}),
    ...(playersBaseGameCompletedCount !== undefined ? { playersBaseGameCompletedCount } : {}),
    ...(playersStartedCount !== undefined ? { playersStartedCount } : {}),
    ...(playersQualifiedCount !== undefined ? { playersQualifiedCount } : {}),
    ...(playerCount !== undefined ? { playerCount } : {}),
    ...(userCount !== undefined ? { userCount } : {}),
    ...(unobtainableAchievementCount !== undefined ? { unobtainableAchievementCount } : {}),
    ...(points !== undefined ? { points } : {}),
    ...(fastestCompletionTime !== undefined ? { fastestCompletionTime } : {}),
    ...(medianCompletionTime !== undefined ? { medianCompletionTime } : {}),
    ...(releaseDate !== undefined ? { releaseDate } : {}),
    ...(hasPaidDlc !== undefined ? { hasPaidDlc } : {}),
    tags: normalizeTags(raw.tags),
  };
}

export function normalizeSteamHuntersAchievement(value: unknown): SteamHuntersAchievement | undefined {
  const raw = asRawAchievement(value);
  if (raw === undefined) {
    return undefined;
  }

  const apiName = stringValue(raw.apiName);
  if (apiName === undefined) {
    return undefined;
  }

  const achievementId = nonNegativeInteger(raw.achievementId);
  const name = stringValue(raw.name);
  const description = stringValue(raw.description);
  const steamPercentage = percentage(raw.steamPercentage);
  const localPercentage = percentage(raw.localPercentage);
  const points = nonNegativeNumber(raw.points);
  const steamPoints = nonNegativeNumber(raw.steamPoints);

  return {
    apiName,
    ...(achievementId !== undefined ? { achievementId } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(steamPercentage !== undefined ? { steamPercentage } : {}),
    ...(localPercentage !== undefined ? { localPercentage } : {}),
    ...(points !== undefined ? { points } : {}),
    ...(steamPoints !== undefined ? { steamPoints } : {}),
    obtainability: normalizeSteamHuntersObtainability(raw.obtainability),
  };
}

export function normalizeSteamHuntersAchievements(value: unknown): readonly SteamHuntersAchievement[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const achievement = normalizeSteamHuntersAchievement(entry);
        return achievement !== undefined ? [achievement] : [];
      })
    : [];
}

export function normalizeSteamHuntersAchievementGroup(value: unknown): SteamHuntersAchievementGroup | undefined {
  const raw = asRawAchievementGroup(value);
  if (raw === undefined) {
    return undefined;
  }

  const achievementApiNames = stringArray(raw.achievementApiNames);
  if (achievementApiNames.length === 0) {
    return undefined;
  }

  const bannerUrl = stringValue(raw.bannerUrl);
  const dlcAppId = nonNegativeInteger(raw.dlcAppId);
  const dlcAppName = stringValue(raw.dlcAppName);
  const name = stringValue(raw.name);
  const releaseDate = stringValue(raw.releaseDate);

  return {
    achievementApiNames,
    ...(bannerUrl !== undefined ? { bannerUrl } : {}),
    ...(dlcAppId !== undefined ? { dlcAppId } : {}),
    ...(dlcAppName !== undefined ? { dlcAppName } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(releaseDate !== undefined ? { releaseDate } : {}),
  };
}

export function normalizeSteamHuntersAchievementGroups(value: unknown): readonly SteamHuntersAchievementGroup[] {
  const rawCollection = isRecord(value)
    ? (value as RawSteamHuntersAchievementGroupsResponse).groups
    : value;
  if (!Array.isArray(rawCollection)) {
    return [];
  }

  return rawCollection.flatMap((entry) => {
    const group = normalizeSteamHuntersAchievementGroup(entry);
    return group === undefined ? [] : [group];
  });
}
