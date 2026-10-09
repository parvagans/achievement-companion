import raCoinIconUrl from "./assets/ra-coin.svg";

export { raCoinIconUrl as RA_COIN_ICON_URL };

export function DeckyRetroAchievementsPointsIcon({ size = 15 }: { readonly size?: number }): JSX.Element {
  return (
    <img
      alt=""
      aria-hidden="true"
      src={raCoinIconUrl}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        objectFit: "contain",
        filter: "drop-shadow(0 0 1px rgba(255, 211, 88, 0.24))",
      }}
    />
  );
}
