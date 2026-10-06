export function shouldNotifyUpdate(
  lastNotifiedVersion: string | undefined,
  availableVersion: string,
  force: boolean,
): boolean {
  return force || lastNotifiedVersion !== availableVersion;
}
