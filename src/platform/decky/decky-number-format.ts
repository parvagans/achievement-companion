/** Formats a numeric display metric without changing the underlying domain value. */
export function formatDeckyNumericText(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (match === null) {
    return value;
  }

  const [, sign, integerText, fractionText] = match;
  const integer = Number(integerText);
  if (!Number.isSafeInteger(integer)) {
    return value;
  }

  const formattedInteger = integer.toLocaleString();
  return `${sign ?? ""}${formattedInteger}${fractionText === undefined ? "" : `.${fractionText}`}`;
}
