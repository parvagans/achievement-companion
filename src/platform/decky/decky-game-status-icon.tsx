import type { CSSProperties } from "react";
import crownLaurelIconUrl from "./assets/achievement-badge/crown-laurel.svg";
import beatenFlagIconUrl from "./assets/flag.svg";

export type DeckyGameStatusIconKind = "beaten" | "mastered" | "perfected";

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

/** Completion iconography shared by RA surfaces and the native game-page badge. */
export function DeckyGameStatusIcon({
  kind,
  size,
  color,
  glow,
}: {
  readonly kind: DeckyGameStatusIconKind;
  readonly size: number;
  readonly color: string;
  readonly accentColor?: string;
  readonly glow?: string;
}): JSX.Element {
  const style = glow === undefined ? { color } : { color, filter: `drop-shadow(0 0 ${Math.max(3, Math.round(size / 10))}px ${glow})` };
  if (kind === "mastered" || kind === "perfected") {
    return (
      <span aria-hidden="true" style={{ ...style, position: "relative", display: "block", width: size, height: size }}>
        <span style={getMaskedAssetStyle(crownLaurelIconUrl, color, { width: size, height: size, top: 0, left: 0 })} />
      </span>
    );
  }

  return <img alt="" aria-hidden="true" src={beatenFlagIconUrl} width={size} height={size} style={{ display: "block", width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 0 1px rgba(255,255,255,.95))" }} />;
}
