export interface DeckyCommunityRarityDistribution {
  readonly common: number;
  readonly uncommon: number;
  readonly rare: number;
  readonly veryRare: number;
  readonly total: number;
}

export type DeckyCommunityRarityBand = "common" | "uncommon" | "rare" | "veryRare";

export function getDeckyCommunityRarityBand(percentage: number): DeckyCommunityRarityBand {
  if (percentage >= 50) return "common";
  if (percentage >= 20) return "uncommon";
  if (percentage >= 5) return "rare";
  return "veryRare";
}

export function countDeckyCommunityRarityBands(
  percentages: readonly number[],
): DeckyCommunityRarityDistribution {
  const counts = { common: 0, uncommon: 0, rare: 0, veryRare: 0 };
  for (const percentage of percentages) counts[getDeckyCommunityRarityBand(percentage)] += 1;
  return { ...counts, total: percentages.length };
}
