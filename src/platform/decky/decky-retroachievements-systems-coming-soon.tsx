import { Focusable } from "@decky/ui";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { NormalizedGame, NormalizedProfile } from "@core/domain";
import gamepadIconUrl from "./assets/gamepad.svg";
import { DeckyLoadingBrandMark } from "./decky-loading-brand";
import { DeckyGameStatusIcon } from "./decky-game-status-icon";
import { getDeckyCompletionProgressStateForFullScreenEntryInitial, getDeckyDashboardStateForFullScreenEntryInitial, loadDeckyProviderFullScreenDataSession } from "./decky-app-services";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { DeckySystemIcon } from "./decky-system-pill";
import { useDeckySettings } from "./decky-settings";
import { buildRetroAchievementsSystemsOverview } from "./decky-retroachievements-systems-data";
import { RETROACHIEVEMENTS_PROVIDER_ID } from "../../providers/retroachievements";
import { raRecipes, raTheme } from "./ra-theme";
import { achievementCompanionQamTheme as qamTheme } from "./decky-qam-theme";

type Overview = ReturnType<typeof buildRetroAchievementsSystemsOverview>;

const chartColors = ["#ff455c", raTheme.color.accentStrong, raTheme.color.success, raTheme.color.rarity.rare, raTheme.color.points, raTheme.color.textMuted] as const;

const pageStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gridTemplateAreas: '"cards cards preview preview preview preview"', gap: 6,
  flex: "1 1 auto", width: "100%", height: "100%", minWidth: 0, minHeight: 0,
  padding: "calc(env(safe-area-inset-top, 0px) + 43px) 12px calc(env(safe-area-inset-bottom, 0px) + 48px)",
  boxSizing: "border-box", overflow: "hidden", background: raTheme.surface.page, color: raTheme.color.textPrimary,
};

const columnStyle: CSSProperties = {
  gridArea: "cards", display: "grid", gridTemplateRows: "minmax(0, 1.25fr) minmax(0, 1.05fr) minmax(0, 0.7fr)",
  gap: 6, minWidth: 0, minHeight: 0,
};

const panelStyle: CSSProperties = {
  ...raRecipes.card("fullscreen", true), display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0,
  padding: 12, gap: 9, overflow: "hidden", background: raTheme.surface.contentCard, boxSizing: "border-box",
};

const headingStyle: CSSProperties = {
  margin: 0, color: raTheme.color.textPrimary, fontSize: 16, fontWeight: 850, lineHeight: 1.15,
};

function count(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

function SystemsMetric({ value, label, icon, color }: {
  readonly value: number | undefined;
  readonly label: string;
  readonly icon: JSX.Element;
  readonly color: string;
}): JSX.Element {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "20px auto minmax(0, 1fr)", alignItems: "center", gap: 4, minWidth: 0, minHeight: 0, padding: "2px 5px", border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.medium, background: raTheme.surface.contentStat, boxSizing: "border-box", overflow: "hidden" }}>
      {icon}
      <strong style={{ color, fontSize: 16, lineHeight: 1, whiteSpace: "nowrap" }}>{count(value)}</strong>
      <span style={{ minWidth: 0, color: raTheme.color.textSecondary, fontSize: 9, lineHeight: 1.05, whiteSpace: "pre-line" }}>{label}</span>
    </div>
  );
}

function OverallProgressCard({ overview }: { readonly overview: Overview | undefined }): JSX.Element {
  const percent = overview?.completionPercent;
  return (
    <section data-ra-systems-card="overall" style={panelStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={headingStyle}>Overall Progress</h2>
          <div style={{ marginTop: 4, color: raTheme.color.textSecondary, fontSize: 13, lineHeight: 1.2 }}>
            {overview === undefined ? "Loading achievement progress…" : `${count(overview.unlocked)} ${overview.mode === "both" ? "" : `${overview.mode} `}unlocked${overview.total === undefined ? "" : ` · ${count(overview.total)} total`}`}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <strong style={{ fontSize: 26, lineHeight: 1 }}>{percent === undefined ? "—" : `${percent}%`}</strong>
          <span style={{ color: raTheme.color.textSecondary, fontSize: 11 }}>complete</span>
        </div>
      </div>
      <div role="progressbar" aria-label="Overall achievement completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} style={{ ...raRecipes.progressTrack, flex: "0 0 16px", width: "100%", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${percent ?? 0}%`, height: "100%", borderRadius: 999, background: raRecipes.progressFill.completion }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridTemplateRows: "repeat(2, minmax(0, 1fr))", gap: 6, flex: "1 1 auto", minHeight: 0 }}>
        <SystemsMetric icon={<img alt="" src={gamepadIconUrl} style={{ width: 20, height: 20, filter: raTheme.iconFilter.primary }} />} value={overview?.systems?.systemsWithUnlocks} label={"Systems\nwith unlocks"} color={raTheme.color.textPrimary} />
        <SystemsMetric icon={<img alt="" src={gamepadIconUrl} style={{ width: 20, height: 20, filter: raTheme.iconFilter.primary }} />} value={overview?.systems?.gamesWithUnlocks} label={"Games\nwith unlocks"} color={raTheme.color.textPrimary} />
        <SystemsMetric icon={<DeckyGameStatusIcon kind="beaten" size={20} color={raTheme.color.beatenFlagWhite} accentColor={raTheme.color.beatenFlagBlack} />} value={overview?.systems?.beatenGames} label={"Beaten\nGames"} color={raTheme.color.beaten} />
        <SystemsMetric icon={<DeckyGameStatusIcon kind="mastered" size={20} color={raTheme.color.mastered} accentColor={raTheme.color.hardcore} />} value={overview?.systems?.masteredGames} label={"Mastered\nGames"} color={raTheme.color.mastered} />
      </div>
    </section>
  );
}

function breakdownGradient(overview: Overview | undefined): string {
  const systems = overview?.systems;
  if (systems === undefined || systems.attributedUnlocks === 0) return raTheme.color.borderStrong;
  let position = 0;
  const stops = systems.breakdown.map((item, index) => {
    const start = position;
    position += item.unlocked / systems.attributedUnlocks * 100;
    return `${chartColors[index % chartColors.length]} ${start}% ${position}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function SystemBreakdownCard({ overview }: { readonly overview: Overview | undefined }): JSX.Element {
  const systems = overview?.systems;
  const items = systems?.breakdown ?? [];
  return (
    <section data-ra-systems-card="breakdown" style={panelStyle}>
      <h2 style={{ ...headingStyle, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>System Breakdown</h2>
      {items.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.35fr)", alignItems: "center", gap: 12, flex: "1 1 auto", minWidth: 0, minHeight: 0 }}>
           <div role="img" aria-label={`${count(systems?.attributedUnlocks)} ${overview?.mode === "both" ? "" : `${overview?.mode} `}unlocked achievements across systems`} style={{ display: "grid", placeItems: "center", width: "100%", maxWidth: 150, aspectRatio: "1", justifySelf: "center", borderRadius: "50%", background: breakdownGradient(overview) }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "70%", aspectRatio: "1", borderRadius: "50%", background: raTheme.surface.page, boxShadow: "0 0 12px rgba(0,0,0,0.24)" }}>
              <strong style={{ fontSize: 21, lineHeight: 1 }}>{count(systems?.attributedUnlocks)}</strong>
              <span style={{ color: raTheme.color.textSecondary, fontSize: 11 }}>unlocked</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, minWidth: 0 }}>
            {items.map((item, index) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "9px minmax(0, 1fr) auto", alignItems: "center", gap: 6, minWidth: 0, color: raTheme.color.textSecondary, fontSize: 11, lineHeight: 1.1 }}>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: chartColors[index % chartColors.length] }} />
                <span title={item.title} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                <strong style={{ color: raTheme.color.textPrimary, whiteSpace: "nowrap" }}>{count(item.unlocked)} ({item.sharePercent}%)</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", placeItems: "center", flex: "1 1 auto", color: raTheme.color.textSecondary, fontSize: 13, textAlign: "center" }}>
          {systems === undefined ? "System breakdown unavailable" : "No unlocked achievements by system yet"}
        </div>
      )}
    </section>
  );
}

function TopSystemsCard({ overview }: { readonly overview: Overview | undefined }): JSX.Element {
  const systems = overview?.systems;
  const system = systems?.topSystem;
  return (
    <section data-ra-systems-card="top" style={panelStyle}>
      <h2 style={{ ...headingStyle, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Top System</h2>
      {system !== undefined ? (
        <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", gridTemplateRows: "minmax(0, 1fr) 4px", alignItems: "center", columnGap: 10, rowGap: 5, flex: "1 1 auto", minWidth: 0, minHeight: 0, padding: "5px 8px", overflow: "hidden", border: `1px solid ${raTheme.color.borderSubtle}`, borderRadius: raTheme.radius.medium, background: raTheme.surface.contentStat, boxSizing: "border-box" }}>
          <div style={{ gridRow: "1 / 3", display: "grid", placeItems: "center", width: 40, height: 40 }}>
            {system.iconUrl !== undefined
              ? <DeckySystemIcon iconSize={35} iconUrl={system.iconUrl} />
              : <img alt="" src={gamepadIconUrl} style={{ width: 32, height: 32, filter: raTheme.iconFilter.primary }} />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
            <strong title={system.title} style={{ color: raTheme.color.textPrimary, fontSize: 14, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{system.title}</strong>
            <span style={{ color: raTheme.color.textSecondary, fontSize: 11, lineHeight: 1.1, whiteSpace: "nowrap" }}>{count(system.unlockedAchievements)} {overview?.mode === "both" ? "" : `${overview?.mode} `}unlocks</span>
          </div>
          {system.completionPercent !== undefined ? (
            <div role="progressbar" aria-label={`${system.title} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={system.completionPercent} style={{ ...raRecipes.progressTrack, gridColumn: 2, gridRow: 2, width: "100%", height: 4 }}>
              <div style={{ height: "100%", width: `${system.completionPercent}%`, background: raRecipes.progressFill.completion, borderRadius: 999 }} />
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "grid", placeItems: "center", flex: "1 1 auto", color: raTheme.color.textSecondary, fontSize: 13, textAlign: "center" }}>
          {systems === undefined ? "Top system unavailable" : "No systems with progress yet"}
        </div>
      )}
    </section>
  );
}

export function DeckyRetroAchievementsSystemsComingSoon({ isActive }: { readonly isActive: boolean }): JSX.Element {
  const mode = useDeckySettings().retroAchievementsAchievementMode;
  const focusRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ readonly profile: NormalizedProfile | undefined; readonly games: readonly NormalizedGame[] | undefined }>(() => ({
    profile: getDeckyDashboardStateForFullScreenEntryInitial(RETROACHIEVEMENTS_PROVIDER_ID).data?.profile,
    games: getDeckyCompletionProgressStateForFullScreenEntryInitial(RETROACHIEVEMENTS_PROVIDER_ID).data?.games
      ?? getDeckyDashboardStateForFullScreenEntryInitial(RETROACHIEVEMENTS_PROVIDER_ID).data?.featuredGames,
  }));

  useEffect(() => {
    let cancelled = false;
    void loadDeckyProviderFullScreenDataSession(RETROACHIEVEMENTS_PROVIDER_ID).then((session) => {
      if (!cancelled) setData({
        profile: session.dashboard.data?.profile,
        games: session.completionProgress.data?.games ?? session.dashboard.data?.featuredGames,
      });
    }).catch(() => {
      if (!cancelled) setData({ profile: undefined, games: undefined });
    });
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!isActive) return undefined;
    return requestDeckySteamGamepadFocusAfterMount(focusRef.current);
  }, [isActive]);

  const overview = data.profile === undefined ? undefined : buildRetroAchievementsSystemsOverview(data.profile, data.games, mode);
  return (
    <main data-ac-ra-theme="fullscreen" data-achievement-companion-ra-systems-coming-soon="true" style={pageStyle}>
      <div data-ra-systems-cards style={columnStyle}>
        <OverallProgressCard overview={overview} />
        <SystemBreakdownCard overview={overview} />
        <TopSystemsCard overview={overview} />
      </div>
      <Focusable
        ref={focusRef} autoFocus noFocusRing onActivate={() => undefined} preferredFocus role="status" tabIndex={0}
        aria-label="More Systems features coming soon" data-achievement-companion-focus-target="ra-systems-coming-soon"
        style={{ gridArea: "preview", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, minWidth: 0, minHeight: 0, outline: "none", textAlign: "center" }}
      >
        <DeckyLoadingBrandMark providerId="retroachievements" />
        <h1 style={{ margin: 0, color: raTheme.color.textPrimary, fontSize: 28, fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1.1, textShadow: qamTheme.decorative.accentTextGlow }}>MORE COMING SOON...</h1>
      </Focusable>
    </main>
  );
}
