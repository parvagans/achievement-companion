/** Achievement badges retain their original square canvas, including transparent/provider borders. */
export function DeckyAchievementArtwork({ src, size }: { readonly src: string; readonly size: number }): JSX.Element {
  return <img src={src} alt="" data-ac-achievement-artwork style={{ display: "block", width: size, height: size, flexShrink: 0, objectFit: "contain", borderRadius: 0 }} />;
}
