import semver from "semver";

export function isValidUpdateVersion(version: string): boolean {
  return semver.valid(version) !== null;
}

export function isNewerVersion(installed: string, remote: string): boolean {
  if (!isValidUpdateVersion(installed) || !isValidUpdateVersion(remote)) {
    throw new Error("Update comparison requires valid semantic versions.");
  }
  return semver.gt(remote, installed);
}

export function isDevelopmentVersion(version: string): boolean {
  const parsed = semver.parse(version);
  if (parsed === null) return false;
  return parsed.prerelease.some((part) => String(part).toLowerCase().includes("dev"))
    || parsed.build.some((part) => part.toLowerCase() === "local" || part.toLowerCase().includes("dev"));
}
