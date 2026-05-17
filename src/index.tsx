import { definePlugin } from "@decky/api";
import { DeckyBootstrap } from "@platform/decky/bootstrap";

function AchievementCompanionIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      focusable="false"
      style={{ width: "1em", height: "1em", verticalAlign: "-0.125em", overflow: "visible" }}
    >
      {/* Trophy body */}
      <path d="M5 2 Q4 9 6.5 13 Q8.5 17 12 18 Q15.5 17 17.5 13 Q20 9 19 2 Z" fill="#e6b020"/>

      {/* Handles */}
      <path d="M5 4 Q1 4 1 9 Q1 13 5 13" fill="none" stroke="#e6b020" stroke-width="2" stroke-linecap="round"/>
      <path d="M19 4 Q23 4 23 9 Q23 13 19 13" fill="none" stroke="#e6b020" stroke-width="2" stroke-linecap="round"/>

      {/* Stem */}
      <rect x="10.5" y="18" width="3" height="3" rx="0.5" fill="#c49010"/>

      {/* Base */}
      <path d="M7 21 Q12 23 17 21 L16.5 23 Q12 24.5 7.5 23 Z" fill="#e6b020"/>

      {/* Shine circle */}
      <circle cx="12" cy="9" r="3.5" fill="white" opacity="0.12"/>

      {/* Star */}
      <path d="M12 5 L13 8 L16 8 L13.5 10 L14.5 13 L12 11 L9.5 13 L10.5 10 L8 8 L11 8 Z" fill="white" opacity="0.94"/>
    </svg>
  );
}

export default definePlugin(() => ({
  name: "Achievement Companion",
  titleView: <span>Achievement Companion</span>,
  content: <DeckyBootstrap />,
  icon: <AchievementCompanionIcon />,
  onDismount() {},
}));
