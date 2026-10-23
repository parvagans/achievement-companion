/** Center a target inside an already-inset viewport, clamping at either end. */
export function getCenteredViewportScrollTop(
  scrollTop: number,
  viewportTop: number,
  viewportHeight: number,
  scrollHeight: number,
  targetTop: number,
  targetHeight: number,
): number {
  const centered = scrollTop + targetTop - viewportTop - (viewportHeight - targetHeight) / 2;
  return Math.max(0, Math.min(Math.max(0, scrollHeight - viewportHeight), centered));
}
