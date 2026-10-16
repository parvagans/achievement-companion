import type { UpdateState } from "../../update/update-types";

export function getDeckyUpdateStatusText(state: UpdateState): string | undefined {
  if (state.status === "checking") return "Checking…";
  if (state.status === "downloading") return "Downloading…";
  if (state.status === "verifying") return "Verifying…";
  if (state.status === "installing") return "Installing…";
  if (state.status === "updateAvailable") return undefined;
  return state.message;
}
