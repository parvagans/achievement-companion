export function getDeckyGameArtworkFallbackInitials(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "AC";
  }

  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
      .trim() || "AC"
  );
}
