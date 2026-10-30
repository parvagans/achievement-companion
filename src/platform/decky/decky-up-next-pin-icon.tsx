/** Small status glyph for the user's active target; not an interactive control. */
export function DeckyUpNextPinIcon({ filled = true, size = 16 }: { readonly filled?: boolean; readonly size?: number }): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={filled ? "Pinned" : "Pin"} data-ac-pin-filled={filled} style={{ flexShrink: 0 }}>
    <path d="M9 3h6v6l3 3v3H6v-3l3-3V3Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}
