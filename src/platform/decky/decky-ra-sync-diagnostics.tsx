import { Focusable, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { callDeckyBackendMethod } from "./decky-backend-bridge";
import { getDeckyRetroAchievementsDataCoordinator } from "./providers/retroachievements/backend-transport";
import { steamTheme } from "./steam-theme";
import { RA_FOREGROUND_WAIT_MS } from "./retroachievements-data-coordinator";

interface SyncDiagnostics {
  cache: { healthy: boolean; resources?: number; databaseBytes?: number; storage: string; lastSuccessAt?: number; historyEvents?: number };
  requests: { pending: number; active: number; sent: number; cooldownUntil: number; recentErrors?: { at: number; endpoint: string; status: number }[] };
  coordinator: { hitRatio: number | null };
  lastFailure?: { at: number; status: number };
  historyActive: number;
}
const date = (value?: number) => value ? new Date(value).toLocaleString() : "Never";
async function diagnosticsCall<T>(method: string, payload: unknown = {}): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([callDeckyBackendMethod<T>(method, payload), new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Diagnostics deadline")), RA_FOREGROUND_WAIT_MS);
  })]); } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Entry snapshot and deliberate actions; no automatic diagnostic polling. */
export function DeckyRaSyncDiagnostics(): JSX.Element {
  const [snapshot, setSnapshot] = useState<SyncDiagnostics>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [gameId, setGameId] = useState("");
  const read = async () => { setSnapshot(await diagnosticsCall<SyncDiagnostics>("get_retroachievements_diagnostics")); };
  useEffect(() => {
    let active = true;
    void diagnosticsCall<SyncDiagnostics>("get_retroachievements_diagnostics").then((data) => {
      if (active) setSnapshot(data);
    }).catch(() => { if (active) setMessage("Diagnostics are unavailable. Reopen settings to retry."); });
    return () => { active = false; };
  }, []);
  const action = (label: string, run: () => Promise<void>, disabled = false) => {
    const activate = () => {
      setBusy(true);
      void run().catch(() => setMessage("The action could not finish. Saved data is retained.")).finally(() => setBusy(false));
    };
    return <Focusable
    className="ac-settings-action" noFocusRing role="button" aria-label={label} aria-disabled={busy || disabled}
    tabIndex={busy || disabled ? -1 : 0}
    {...(!busy && !disabled ? { onActivate: activate, onClick: activate } : {})}
    style={{ minHeight: 44, display: "grid", placeItems: "center", padding: "8px 12px",
      border: `1px solid ${steamTheme.color.borderStrong}`, borderRadius: steamTheme.radius.small,
      background: steamTheme.surface.contentStat, color: steamTheme.color.textPrimary,
      opacity: busy || disabled ? .55 : 1 }}
  >{label}</Focusable>;
  };
  const recover = async (target: string) => {
    const result = await diagnosticsCall<{ ok: boolean; message: string }>("recover_retroachievements_resource", { target, gameId });
    setMessage(result.message);
    if (result.ok) {
      const coordinator = getDeckyRetroAchievementsDataCoordinator();
      if (target === "game") coordinator.invalidateResource({ path: "API_GetGameInfoAndUserProgress.php", query: { g: gameId, a: 1 } });
      else coordinator.invalidateResources(target === "history-checkpoint" ? ["history-checkpoint"] : [
        "API_GetUserProfile.php", "API_GetUserSummary.php", "API_GetUserRecentAchievements.php",
        "API_GetUserRecentlyPlayedGames.php", "API_GetUserCompletionProgress.php",
      ]);
    }
    await read();
  };
  return <section data-achievement-companion-ra-sync-diagnostics style={{ display: "flex", flexDirection: "column", gap: 7,
    paddingTop: 10, borderTop: `1px solid ${steamTheme.color.borderSubtle}`, fontSize: steamTheme.type.fullscreen.metadata }}>
    <div style={{ color: steamTheme.color.textSecondary, fontWeight: steamTheme.type.weight.strong }}>DATA &amp; SYNC DIAGNOSTICS</div>
    {snapshot ? <>
      <div>Last successful RA sync: {date((snapshot.cache.lastSuccessAt ?? 0) * 1000)}</div>
      <div>Last failed RA sync: {date(snapshot.lastFailure?.at)}{snapshot.lastFailure ? ` · HTTP ${snapshot.lastFailure.status}` : ""}</div>
      <div>Cache: {snapshot.cache.healthy ? "Healthy" : "Recovery required"} · {snapshot.cache.resources ?? 0} resources · {((snapshot.cache.databaseBytes ?? 0) / 1048576).toFixed(1)} MiB</div>
      <div>{snapshot.cache.storage} · {snapshot.cache.historyEvents ?? 0} history events</div>
      <div>Requests this session: {snapshot.requests.sent} sent · {snapshot.requests.active} active · {snapshot.requests.pending} pending</div>
      <div>Cache hit ratio: {snapshot.coordinator.hitRatio === null ? "No reads yet" : `${Math.round(snapshot.coordinator.hitRatio * 100)}%`} · History jobs: {snapshot.historyActive}</div>
      <div>{snapshot.requests.cooldownUntil > Date.now() ? `Provider cooldown until ${date(snapshot.requests.cooldownUntil)}. Retry remains blocked.` : "No active provider cooldown."}</div>
      {snapshot.requests.recentErrors?.slice(-3).map((error, index) => <div key={index}>{date(error.at)} · {error.endpoint} · HTTP {error.status}</div>)}
    </> : <div>Loading diagnostics…</div>}
    <div role="status">{message}</div>
    {action("Refresh diagnostics", read)}
    {action("Export sanitized diagnostics", async () => {
      const result = await diagnosticsCall<{ ok: boolean; location?: string; message?: string }>("export_retroachievements_diagnostics");
      setMessage(result.ok ? `Export saved: ${result.location}` : result.message);
    })}
    {action("Revalidate profile on next entry", () => recover("profile"))}
    <TextField label="RetroAchievements game ID" value={gameId} onChange={(event) => setGameId(event.currentTarget.value)} />
    {action("Revalidate game on next entry", () => recover("game"), !/^\d+$/u.test(gameId))}
    {action("Rebuild history coverage checkpoint", () => recover("history-checkpoint"), (snapshot?.historyActive ?? 0) > 0)}
    <div style={{ color: steamTheme.color.textSecondary }}>Open Activity to resume a partial history import. Rebuilding coverage retains verified events and may require importing older ranges again.</div>
  </section>;
}
