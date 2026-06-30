import { useEffect, useState, type CSSProperties } from "react";

export interface DeckySystemPillProps {
  readonly label: string;
  readonly iconUrl?: string | undefined;
  readonly style?: CSSProperties;
  readonly labelStyle?: CSSProperties;
  readonly iconSize?: number;
}

function getSystemPillLabelStyle(): CSSProperties {
  return {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

export function getDeckySystemIconStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    objectFit: "contain",
    flexShrink: 0,
  };
}

export interface DeckySystemIconProps {
  readonly iconUrl?: string | undefined;
  readonly iconSize?: number;
}

export function DeckySystemIcon({
  iconUrl,
  iconSize = 16,
}: DeckySystemIconProps): JSX.Element | null {
  const [isIconHidden, setIsIconHidden] = useState(iconUrl === undefined);

  useEffect(() => {
    setIsIconHidden(iconUrl === undefined);
  }, [iconUrl]);

  if (iconUrl === undefined || isIconHidden) {
    return null;
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => {
        setIsIconHidden(true);
      }}
      referrerPolicy="no-referrer"
      src={iconUrl}
      style={getDeckySystemIconStyle(iconSize)}
    />
  );
}

export function DeckySystemPill({
  label,
  iconUrl,
  style,
  labelStyle,
  iconSize = 16,
}: DeckySystemPillProps): JSX.Element {
  return (
    <span style={style}>
      <DeckySystemIcon iconSize={iconSize} iconUrl={iconUrl} />
      <span style={{ ...getSystemPillLabelStyle(), ...labelStyle }}>{label}</span>
    </span>
  );
}
