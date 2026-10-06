import semver from "semver";
import {
  UPDATE_MANIFEST_SCHEMA,
  type UpdateChannel,
  type UpdateManifest,
} from "./update-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Update manifest ${key} is required.`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`Update manifest ${key} must be a string.`);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseUpdateManifest(value: unknown, manifestUrl?: string): UpdateManifest {
  if (!isRecord(value)) throw new Error("Update manifest must be a JSON object.");
  if (value["schema"] !== UPDATE_MANIFEST_SCHEMA) {
    throw new Error(`Unsupported update manifest schema: ${String(value["schema"])}.`);
  }
  const version = requiredString(value, "version");
  if (semver.valid(version) === null) throw new Error("Update manifest version is not valid SemVer.");
  const channelValue = requiredString(value, "channel");
  if (channelValue !== "stable" && channelValue !== "preview") {
    throw new Error("Update manifest channel must be stable or preview.");
  }
  const channel: UpdateChannel = channelValue;
  const downloadUrlValue = requiredString(value, "downloadUrl");
  let downloadUrl: string;
  try {
    downloadUrl = new URL(downloadUrlValue, manifestUrl).toString();
  } catch {
    throw new Error("Update manifest downloadUrl is invalid.");
  }
  if (!/^https?:$/u.test(new URL(downloadUrl).protocol)) {
    throw new Error("Update manifest downloadUrl must use HTTP or HTTPS.");
  }
  const sha256 = requiredString(value, "sha256").toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new Error("Update manifest sha256 must be 64 hexadecimal characters.");
  }
  const releaseNotes = optionalString(value, "releaseNotes");
  const minDeckyVersion = optionalString(value, "minDeckyVersion");
  if (minDeckyVersion !== undefined && semver.valid(minDeckyVersion) === null) {
    throw new Error("Update manifest minDeckyVersion is not valid SemVer.");
  }
  return {
    schema: UPDATE_MANIFEST_SCHEMA,
    version,
    channel,
    downloadUrl,
    sha256,
    ...(releaseNotes !== undefined ? { releaseNotes } : {}),
    ...(minDeckyVersion !== undefined ? { minDeckyVersion } : {}),
  };
}
