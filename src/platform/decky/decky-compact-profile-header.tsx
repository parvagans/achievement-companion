import { DeckyUpNextPinIcon } from "./decky-up-next-pin-icon";
import { Focusable } from "@decky/ui";
import { useRef, useState } from "react";
import type { NormalizedProfile } from "@core/domain";
import type { DeckyCompactUpNextFocusTargetProps } from "./decky-compact-up-next-card";
import { addProfileAvatarCacheBustParam } from "./decky-avatar-cache-busting";
import { DeckyRetroAchievementsActiveGameDot } from "./decky-retroachievements-active-game-dot";
import { scrollDeckyFocusTargetToTop } from "./decky-focus-scroll";
import { useDeckyVisualFocusState } from "./decky-visual-focus-state";
import { achievementCompanionQamTheme as theme, getQamCompactFocusControlStyle } from "./decky-qam-theme";

/** Account navigation stays mounted independently of recommendation availability. */
export function DeckyCompactProfileHeader({ identity, providerName, refreshedAt, currentGame = false, onActivate, onCancel, targetProps, pinnedTargetProps, onOpenPinned }: {
  readonly identity: NormalizedProfile["identity"];
  readonly providerName: string;
  readonly refreshedAt: number | undefined;
  readonly currentGame?: boolean;
  readonly onActivate: () => void;
  readonly onCancel: () => void;
  readonly targetProps: DeckyCompactUpNextFocusTargetProps;
  readonly pinnedTargetProps: DeckyCompactUpNextFocusTargetProps;
  readonly onOpenPinned: (anchor: HTMLDivElement) => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const generation = useRef(0);
  const [focused, setFocused] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState<string>();
  useDeckyVisualFocusState(ref, setFocused);
  const avatar = addProfileAvatarCacheBustParam(identity.avatarUrl, refreshedAt);
  const activate = (): void => {
    if (ref.current !== null) targetProps.onActivated(ref.current);
    onActivate();
  };
  const focus = (): void => {
    const node = ref.current;
    if (node === null) return;
    const request = ++generation.current;
    setFocused(true);
    scrollDeckyFocusTargetToTop(node, () => generation.current === request);
    targetProps.onFocused(node);
  };
  const blur = (): void => { generation.current += 1; setFocused(false); };
  const initials = identity.displayName.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AC";
  return <div data-ac-compact-profile-header style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8, minWidth: 0, width: "100%" }}>
    <div data-ac-compact-game-heading style={{ minWidth: 0, whiteSpace: "nowrap", color: theme.color.accent, fontSize: theme.type.compact.heading, fontWeight: 850, letterSpacing: "0.055em", lineHeight: 1.2 }}>
      {currentGame ? <DeckyRetroAchievementsActiveGameDot /> : null}{currentGame ? "CURRENT GAME" : "CONTINUE PLAYING"}
    </div>
    <Focusable flow-children="left-right" noFocusRing tabIndex={-1} style={{ display: "flex", gap: 4, width: 80, minWidth: 80, maxWidth: 80 }}>
    <PinnedShortcut targetProps={pinnedTargetProps} onOpen={onOpenPinned} onCancel={onCancel} />
    <Focusable noFocusRing role="button" tabIndex={0} aria-label={`Open ${providerName} profile full-screen for ${identity.displayName}`} onOKActionDescription="Open Profile"
      preferredFocus={targetProps.preferredFocus} ref={(node) => { ref.current = node; targetProps.elementRef?.(node); }}
      onActivate={activate} onClick={activate} onCancel={onCancel} onFocus={focus} onGamepadFocus={focus} onBlur={blur} onGamepadBlur={blur}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", justifySelf: "end", gap: 6,
        width: 38, minWidth: 38, maxWidth: 38, height: 38, minHeight: 38, maxHeight: 38, flex: "0 0 auto", whiteSpace: "nowrap", lineHeight: 1.2, padding: 0, boxSizing: "border-box",
        borderRadius: theme.radius.small, border: "1px solid transparent", background: "transparent",
        color: theme.color.textPrimary, fontSize: theme.type.compact.metadata, fontWeight: 700, ...(focused ? getQamCompactFocusControlStyle() : {}) }}>
      <span data-ac-compact-profile-avatar aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 24, minWidth: 24, maxWidth: 24, height: 24, minHeight: 24, maxHeight: 24, flex: "0 0 24px", boxSizing: "border-box",
        borderRadius: theme.radius.small, background: theme.surface.contentStat, color: theme.color.textPrimary, fontSize: theme.type.compact.caption, lineHeight: 1 }}>
        {avatar !== undefined && avatar !== failedAvatar
          ? <img alt="" src={avatar} width={24} height={24} onError={() => setFailedAvatar(avatar)} style={{ display: "block", width: 24, minWidth: 24, maxWidth: 24,
            height: 24, minHeight: 24, maxHeight: 24, flex: "0 0 24px", objectFit: "cover", borderRadius: theme.radius.small }} />
          : initials}
      </span>
    </Focusable>
    </Focusable>
  </div>;
}

function PinnedShortcut({ targetProps, onOpen, onCancel }: { targetProps: DeckyCompactUpNextFocusTargetProps; onOpen: (anchor: HTMLDivElement) => void; onCancel: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  useDeckyVisualFocusState(ref, setFocused);
  const activate = (): void => { if (ref.current) { targetProps.onActivated(ref.current); onOpen(ref.current); } };
  return <Focusable noFocusRing role="button" tabIndex={0} aria-label="Pinned Achievements" onOKActionDescription="Pinned Achievements" preferredFocus={targetProps.preferredFocus}
    ref={(node) => { ref.current = node; targetProps.elementRef?.(node); }} onActivate={activate} onClick={activate} onCancel={onCancel}
    onGamepadFocus={() => { setFocused(true); if (ref.current) { scrollDeckyFocusTargetToTop(ref.current); targetProps.onFocused(ref.current); } }} onGamepadBlur={() => setFocused(false)}
    style={{ width: 38, minWidth: 38, maxWidth: 38, height: 38, minHeight: 38, maxHeight: 38, flex: "0 0 38px", display: "grid", placeItems: "center", padding: 0, boxSizing: "border-box", border: "1px solid transparent", borderRadius: theme.radius.small, background: "transparent", color: theme.color.textPrimary, ...(focused ? getQamCompactFocusControlStyle() : {}) }}>
    <span aria-hidden="true" style={{ display: "flex", width: 20, minWidth: 20, maxWidth: 20, height: 20, minHeight: 20, maxHeight: 20, flex: "0 0 20px" }}><DeckyUpNextPinIcon size={20} /></span>
  </Focusable>;
}
