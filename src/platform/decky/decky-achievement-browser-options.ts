export type AchievementBrowserSort =
  | "default"
  | "name-asc"
  | "name-desc"
  | "rarity-asc"
  | "rarity-desc"
  | "points-desc"
  | "points-asc"
  | "recently-unlocked";

export type AchievementBrowserDisplayMode = "detailed" | "compact";

export const ACHIEVEMENT_BROWSER_SORT_OPTIONS: readonly {
  readonly value: AchievementBrowserSort;
  readonly label: string;
}[] = [
  { value: "default", label: "Default Order" },
  { value: "name-asc", label: "Name — A to Z" },
  { value: "name-desc", label: "Name — Z to A" },
  { value: "rarity-asc", label: "Rarest First" },
  { value: "rarity-desc", label: "Most Common First" },
  { value: "points-desc", label: "Highest Points" },
  { value: "points-asc", label: "Lowest Points" },
  { value: "recently-unlocked", label: "Recently Unlocked" },
];

export const ACHIEVEMENT_BROWSER_DISPLAY_OPTIONS: readonly {
  readonly value: AchievementBrowserDisplayMode;
  readonly label: string;
}[] = [
  { value: "detailed", label: "Detailed" },
  { value: "compact", label: "Compact" },
];

export function formatAchievementBrowserSortLabel(sort: AchievementBrowserSort): string {
  return ACHIEVEMENT_BROWSER_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Default Order";
}

export function formatAchievementBrowserDisplayLabel(displayMode: AchievementBrowserDisplayMode): string {
  return ACHIEVEMENT_BROWSER_DISPLAY_OPTIONS.find((option) => option.value === displayMode)?.label ?? "Detailed";
}

export interface AchievementBrowserSortValues {
  readonly title: string;
  readonly rarityPercent?: number;
  readonly pointsValue?: number;
  readonly unlockedAt?: number;
}

const achievementBrowserTitleCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function compareOptionalNumbers(
  left: number | undefined,
  right: number | undefined,
  direction: 1 | -1,
): number {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  return (left - right) * direction;
}

export function getSupportedAchievementBrowserSorts<T>(
  items: readonly T[],
  getValues: (item: T) => AchievementBrowserSortValues,
): readonly AchievementBrowserSort[] {
  const values = items.map(getValues);
  const hasRarity = values.some((item) => item.rarityPercent !== undefined);
  const hasPoints = values.some((item) => item.pointsValue !== undefined);
  const hasUnlockTimestamp = values.some((item) => item.unlockedAt !== undefined);
  return ACHIEVEMENT_BROWSER_SORT_OPTIONS.map((option) => option.value).filter((sort) => {
    if (sort === "rarity-asc" || sort === "rarity-desc") return hasRarity;
    if (sort === "points-desc" || sort === "points-asc") return hasPoints;
    if (sort === "recently-unlocked") return hasUnlockTimestamp;
    return true;
  });
}

export function sortAchievementBrowserItems<T>(
  items: readonly T[],
  sort: AchievementBrowserSort,
  getValues: (item: T) => AchievementBrowserSortValues,
): readonly T[] {
  if (sort === "default") return items;
  return items.map((item, index) => ({ item, index, values: getValues(item) })).sort((left, right) => {
    let comparison = 0;
    switch (sort) {
      case "name-asc":
        comparison = achievementBrowserTitleCollator.compare(left.values.title, right.values.title);
        break;
      case "name-desc":
        comparison = achievementBrowserTitleCollator.compare(right.values.title, left.values.title);
        break;
      case "rarity-asc":
        comparison = compareOptionalNumbers(left.values.rarityPercent, right.values.rarityPercent, 1);
        break;
      case "rarity-desc":
        comparison = compareOptionalNumbers(left.values.rarityPercent, right.values.rarityPercent, -1);
        break;
      case "points-desc":
        comparison = compareOptionalNumbers(left.values.pointsValue, right.values.pointsValue, -1);
        break;
      case "points-asc":
        comparison = compareOptionalNumbers(left.values.pointsValue, right.values.pointsValue, 1);
        break;
      case "recently-unlocked":
        comparison = compareOptionalNumbers(left.values.unlockedAt, right.values.unlockedAt, -1);
        break;
    }
    return comparison !== 0 ? comparison : left.index - right.index;
  }).map(({ item }) => item);
}
