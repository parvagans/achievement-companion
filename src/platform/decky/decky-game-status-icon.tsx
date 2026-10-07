import { useId, type CSSProperties } from "react";
import crownIconUrl from "./assets/achievement-badge/crown.svg";
import laurelIconUrl from "./assets/achievement-badge/laurel.svg";

export type DeckyGameStatusIconKind = "beaten" | "mastered";

function getMaskedAssetStyle(
  assetUrl: string,
  color: string,
  placement: Pick<CSSProperties, "width" | "height" | "top" | "left">,
): CSSProperties {
  const maskUrl = `url("${assetUrl}")`;
  return {
    position: "absolute",
    ...placement,
    backgroundColor: color,
    maskImage: maskUrl,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "100% 100%",
    WebkitMaskImage: maskUrl,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
  };
}

/** Shared RA completion iconography for the game badge and compact profile. */
export function DeckyGameStatusIcon({
  kind,
  size,
  color,
  accentColor = color,
  glow,
}: {
  readonly kind: DeckyGameStatusIconKind;
  readonly size: number;
  readonly color: string;
  readonly accentColor?: string;
  readonly glow?: string;
}): JSX.Element {
  const checkerFlagId = useId().replace(/:/g, "");
  const style = glow === undefined ? { color } : { color, filter: `drop-shadow(0 0 ${Math.max(3, Math.round(size / 10))}px ${glow})` };
  if (kind === "mastered") {
    return (
      <span aria-hidden="true" style={{ ...style, position: "relative", display: "block", width: size, height: size }}>
        <span style={getMaskedAssetStyle(laurelIconUrl, color, { width: size, height: size * (46 / 48), top: size / 48, left: 0 })} />
        <span style={getMaskedAssetStyle(crownIconUrl, accentColor, { width: size * (27 / 48), height: size * (27 / 48), top: size * (10 / 48), left: size * (10.5 / 48) })} />
      </span>
    );
  }

  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 64 64" width={size} style={style}>
      <defs>
        <clipPath id={checkerFlagId}>
          <path d="M20 10c10-5 20 7 34 0v29c-14 7-24-7-34 0V10Z" />
        </clipPath>
      </defs>
      <path d="M17 57 21 7" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      <g clipPath={`url(#${checkerFlagId})`}>
        <path d="M20 10c10-5 20 7 34 0v29c-14 7-24-7-34 0V10Z" fill={accentColor} />
        <path d="M20 10h9v9h-9zM38 10h9v9h-9zM29 19h9v9h-9zM47 19h9v9h-9zM20 28h9v9h-9zM38 28h9v9h-9zM29 37h9v9h-9zM47 37h9v9h-9z" fill="currentColor" />
      </g>
      <path d="M20 10c10-5 20 7 34 0v29c-14 7-24-7-34 0V10Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
