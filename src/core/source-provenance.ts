/** Provenance follows exact source objects, never a later global cache lookup. */
const sources = new WeakMap<object, readonly string[]>();
export function inheritSourceProvenance<T extends object>(value: T, ...inputs: readonly object[]): T {
  const revisions = inputs.flatMap(input => sources.get(input) ?? []);
  if (revisions.length) sources.set(value, revisions);
  return value;
}
export function setSourceProvenance(value: object, revisions: readonly string[]): void { sources.set(value, revisions); }
export function readSourceProvenance(value: object): readonly string[] { return sources.get(value) ?? []; }
