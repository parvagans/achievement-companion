import type { AchievementClassification } from "@core/domain";
import type { CSSProperties } from "react";

interface AchievementTypeBadgeDescriptor {
  readonly label: string;
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly color: string;
}

const BADGE_DESCRIPTORS: Readonly<Record<AchievementClassification, AchievementTypeBadgeDescriptor>> = {
  missable: {
    label: "Missable",
    backgroundColor: "rgba(190, 116, 79, 0.14)",
    borderColor: "rgba(222, 154, 112, 0.42)",
    color: "rgba(247, 205, 174, 0.96)",
  },
  progression: {
    label: "Progression",
    backgroundColor: "rgba(79, 137, 184, 0.14)",
    borderColor: "rgba(113, 174, 220, 0.4)",
    color: "rgba(190, 224, 249, 0.96)",
  },
  "win-condition": {
    label: "Win Condition",
    backgroundColor: "rgba(178, 147, 65, 0.14)",
    borderColor: "rgba(218, 185, 91, 0.42)",
    color: "rgba(244, 222, 157, 0.97)",
  },
};

export function getAchievementTypeBadgeDescriptor(
  classification: unknown,
): AchievementTypeBadgeDescriptor | undefined {
  if (
    classification !== "missable" &&
    classification !== "progression" &&
    classification !== "win-condition"
  ) {
    return undefined;
  }

  return BADGE_DESCRIPTORS[classification];
}

function getAchievementTypeBadgeStyle(
  descriptor: AchievementTypeBadgeDescriptor,
): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    padding: "2px 6px",
    border: `1px solid ${descriptor.borderColor}`,
    borderRadius: 999,
    backgroundColor: descriptor.backgroundColor,
    color: descriptor.color,
    fontSize: "0.68em",
    fontWeight: 800,
    letterSpacing: "0.025em",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
}

export function DeckyAchievementTypeBadge({
  classification,
}: {
  readonly classification: unknown;
}): JSX.Element | null {
  const descriptor = getAchievementTypeBadgeDescriptor(classification);
  if (descriptor === undefined) {
    return null;
  }

  return <span style={getAchievementTypeBadgeStyle(descriptor)}>{descriptor.label}</span>;
}
