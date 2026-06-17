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

function getSystemPillIconStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    objectFit: "contain",
    flexShrink: 0,
  };
}

export function DeckySystemPill({
  label,
  iconUrl,
  style,
  labelStyle,
  iconSize = 16,
}: DeckySystemPillProps): JSX.Element {
  const [isIconHidden, setIsIconHidden] = useState(iconUrl === undefined);

  useEffect(() => {
    setIsIconHidden(iconUrl === undefined);
  }, [iconUrl]);

  return (
    <span style={style}>
      {iconUrl !== undefined && !isIconHidden ? (
        <img
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={() => {
            setIsIconHidden(true);
          }}
          referrerPolicy="no-referrer"
          src={iconUrl}
          style={getSystemPillIconStyle(iconSize)}
        />
      ) : null}
      <span style={{ ...getSystemPillLabelStyle(), ...labelStyle }}>{label}</span>
    </span>
  );
}
