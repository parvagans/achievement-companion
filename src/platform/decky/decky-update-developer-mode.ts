import { readDeckyStorageText } from "./storage";

export const DECKY_DEVELOPER_UPDATE_MODE_STORAGE_KEY =
  "achievement-companion:developer-update-mode";

export function isDeckyDeveloperUpdateModeEnabled(): boolean {
  return readDeckyStorageText(DECKY_DEVELOPER_UPDATE_MODE_STORAGE_KEY) === "true";
}
