import type { JSX } from "react";

export interface DeckySteamIconProps {
  readonly size?: number;
  readonly color?: string;
}

function SteamIconBase({ children, size, color, strokeWidth = 2 }: DeckySteamIconProps & { readonly children: JSX.Element | JSX.Element[]; readonly strokeWidth?: number }): JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 24 24" width={size}>
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}>
        {children}
      </g>
    </svg>
  );
}

export function DeckySteamPlayIcon(props: DeckySteamIconProps = {}): JSX.Element {
  const { size = 16, color = "currentColor" } = props;
  return <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 24 24" width={size}><path d="M8 5v14l11-7z" fill={color} /></svg>;
}

export function DeckySteamExternalLinkIcon(props: DeckySteamIconProps = {}): JSX.Element {
  const { size = 16, color = "currentColor" } = props;
  return <SteamIconBase size={size} color={color}><path d="M14 5h5v5" /><path d="M19 5 11 13" /><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></SteamIconBase>;
}

export function DeckySteamHuntersIcon(props: DeckySteamIconProps = {}): JSX.Element {
  const { size = 16, color = "currentColor" } = props;
  return <SteamIconBase size={size} color={color}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></SteamIconBase>;
}

export function DeckySteamDlcIcon(props: DeckySteamIconProps = {}): JSX.Element {
  const { size = 30, color = "#c084fc" } = props;
  return <SteamIconBase size={size} color={color} strokeWidth={1.8}><path d="M5 7h3.8a2.2 2.2 0 1 0 4.4 0H17v3.8a2.2 2.2 0 1 1 0 4.4V19H5Z" /></SteamIconBase>;
}

export function DeckySteamUnobtainableIcon(props: DeckySteamIconProps = {}): JSX.Element {
  const { size = 22, color = "#ef4444" } = props;
  return <SteamIconBase size={size} color={color} strokeWidth={1.8}><circle cx="12" cy="12" r="8.5" /><path d="M6.5 6.5 17.5 17.5" /></SteamIconBase>;
}

export function DeckySteamConditionalIcon(props: DeckySteamIconProps = {}): JSX.Element {
  const { size = 22, color = "#facc15" } = props;
  return <SteamIconBase size={size} color={color} strokeWidth={1.8}><path d="M12 3.5 21.5 20h-19L12 3.5Z" /><path d="M12 10v4" /><path d="M12 17.2h.01" /></SteamIconBase>;
}

export function DeckySteamBrokenIcon(props: DeckySteamIconProps = {}): JSX.Element {
  const { size = 22, color = "#cbd5e1" } = props;
  return <SteamIconBase size={size} color={color} strokeWidth={1.8}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></SteamIconBase>;
}
