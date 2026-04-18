import { definePlugin } from "@decky/api";
import { DeckyBootstrap } from "@platform/decky/bootstrap";

function AchievementCompanionIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M12 2.5 4.5 6.5v5.4c0 4.9 3.1 8.6 7.5 9.6 4.4-1 7.5-4.7 7.5-9.6V6.5L12 2.5z"
        fill="currentColor"
      />
      <path d="M12 7.2v9.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.2 12h9.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
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
