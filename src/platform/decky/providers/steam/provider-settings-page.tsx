import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { PanelSection, PanelSectionRow, ScrollPanel } from "@decky/ui";
import { DeckyActionButtonItem } from "../../decky-action-button-item";
import { DECKY_FOCUS_ACTION_ROW_CLASS } from "../../decky-focus-styles";
import {
  DeckyFullscreenActionButton,
  DeckyFullscreenActionRow,
} from "../../decky-full-screen-action-controls";
import { TopAlignedScrollViewport } from "../../decky-scroll-viewport";
import {
  clearDeckySteamAccountState,
  useDeckySteamLibraryAchievementScanSummary,
  useDeckySteamProviderConfig,
  writeDeckySteamProviderConfig,
} from "./config";
import { DeckySteamProviderCredentialsForm } from "./credentials-form";
import {
  createDeckySteamLibraryScanDependencies,
  runAndCacheDeckySteamLibraryAchievementScan,
} from "./library-scan";

export interface DeckySteamProviderSettingsPageProps {
  readonly providerId: string;
  readonly onBack: () => void;
}

type ScanState =
  | { readonly status: "idle" }
  | { readonly status: "scanning" }
  | { readonly status: "success"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

function getPageFrameStyle(): CSSProperties {
  return {
    padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px)",
    boxSizing: "border-box",
  };
}

function getHeroCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))",
  };
}

function getHeroKickerStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: "0.72em",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getHeroTitleStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.45em",
    fontWeight: 800,
    lineHeight: 1.08,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function getHeroSupportStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: "0.92em",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };
}

function getSectionNoteStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: "0.86em",
    lineHeight: 1.4,
  };
}

function getScanGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
    width: "100%",
  };
}

function getScanStatCardStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    minWidth: 0,
  };
}

function getScanStatLabelStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.64)",
    fontSize: "0.76em",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  };
}

function getScanStatValueStyle(): CSSProperties {
  return {
    color: "rgba(255, 255, 255, 0.98)",
    fontSize: "1.06em",
    fontWeight: 750,
    lineHeight: 1.2,
  };
}

function formatTimestamp(value: string | undefined): string {
  if (value === undefined) {
    return "Never";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString();
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function ScanStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div style={getScanStatCardStyle()}>
      <div style={getScanStatLabelStyle()}>{label}</div>
      <div style={getScanStatValueStyle()}>{value}</div>
    </div>
  );
}

export function DeckySteamProviderSettingsPage({
  providerId,
  onBack,
}: DeckySteamProviderSettingsPageProps): JSX.Element {
  const providerConfig = useDeckySteamProviderConfig(providerId);
  const cachedScanSummary = useDeckySteamLibraryAchievementScanSummary(providerId);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const scanButtonDisabled = providerConfig === undefined || scanState.status === "scanning";
  const scanButtonLabel = scanState.status === "scanning" ? "Scanning library..." : "Scan library achievements";
  const cachedScanNeedsIconRefresh =
    cachedScanSummary?.unlockedAchievementsList?.some((unlock) => unlock.iconUrl === undefined) ?? false;

  const scanSummaryStats = useMemo(() => {
    if (cachedScanSummary === undefined) {
      return [];
    }

    return [
      { label: "Owned Games", value: formatCount(cachedScanSummary.ownedGameCount ?? cachedScanSummary.scannedGameCount) },
      { label: "Last scan", value: formatTimestamp(cachedScanSummary.scannedAt) },
      { label: "Scanned games", value: formatCount(cachedScanSummary.scannedGameCount) },
      { label: "Games with achievements", value: formatCount(cachedScanSummary.gamesWithAchievements) },
      {
        label: "Skipped / failed",
        value: `${formatCount(cachedScanSummary.skippedGameCount)} / ${formatCount(cachedScanSummary.failedGameCount)}`,
      },
      { label: "Achievements unlocked", value: formatCount(cachedScanSummary.unlockedAchievements) },
      { label: "Total achievements", value: formatCount(cachedScanSummary.totalAchievements) },
      { label: "Perfect games", value: formatCount(cachedScanSummary.perfectGames) },
      { label: "Completion", value: `${formatCount(cachedScanSummary.completionPercent)}%` },
    ];
  }, [cachedScanSummary]);

  const handleScanLibraryAchievements = useCallback(async () => {
    if (providerConfig === undefined) {
      return;
    }

    setScanState({ status: "scanning" });
    try {
      const summary = await runAndCacheDeckySteamLibraryAchievementScan(
        providerConfig,
        createDeckySteamLibraryScanDependencies(),
      );
      setScanState({
        status: "success",
        message: `Scan complete: ${summary.scannedGameCount} games checked.`,
      });
    } catch (cause) {
      const message = cause instanceof Error && cause.message.trim().length > 0 ? cause.message : "Steam library scan failed.";
      setScanState({
        status: "error",
        message,
      });
    }
  }, [providerConfig]);

  return (
    <ScrollPanel>
      <TopAlignedScrollViewport scrollKey={`full-screen-provider-settings:${providerId}`}>
        <div style={getPageFrameStyle()}>
          <PanelSection title="Navigation">
            <DeckyFullscreenActionRow>
              <DeckyFullscreenActionButton
                label="Back"
                isFullscreenBackAction
                onClick={() => {
                  onBack();
                }}
              />
            </DeckyFullscreenActionRow>
          </PanelSection>

          <PanelSection title="Provider">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <div style={getHeroKickerStyle()}>Achievement Companion</div>
                <div style={getHeroTitleStyle()}>Steam</div>
                <div style={getHeroSupportStyle()}>
                  Manage Steam account settings and provider-specific preferences on this device.
                </div>
              </div>
            </PanelSectionRow>
          </PanelSection>

          <PanelSection title="Account">
            <DeckySteamProviderCredentialsForm
              config={providerConfig}
              statusLabel="Account status"
              saveLabel="Save provider settings"
              clearLabel="Sign out"
              onSave={(nextConfig, apiKeyDraft) => writeDeckySteamProviderConfig(nextConfig, apiKeyDraft)}
              onClear={() => clearDeckySteamAccountState()}
            />
          </PanelSection>

          <PanelSection title="Library achievement scan">
            <PanelSectionRow>
              <div style={getHeroCardStyle()}>
                <div style={getHeroSupportStyle()}>
                  Run a manual Steam library scan to cache full-library achievement totals and owned game count for the overview cards.
                  The dashboard will keep using loaded-game data until a scan is saved here.
                </div>
                <DeckyActionButtonItem
                  className={DECKY_FOCUS_ACTION_ROW_CLASS}
                  focusClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                  focusWithinClassName={DECKY_FOCUS_ACTION_ROW_CLASS}
                  highlightOnFocus
                  disabled={scanButtonDisabled}
                  label={scanButtonLabel}
                  description="Run a manual Steam library scan."
                  onClick={() => {
                    void handleScanLibraryAchievements();
                  }}
                />

                {scanState.status === "success" || scanState.status === "error" ? (
                  <div style={getSectionNoteStyle()}>{scanState.message}</div>
                ) : null}

                <div style={getSectionNoteStyle()}>
                  {providerConfig === undefined
                    ? "Connect Steam first to scan the library."
                    : cachedScanSummary === undefined
                      ? "No cached Steam library scan yet."
                      : "Cached Steam library totals are ready for the overview card."}
                </div>
                {cachedScanNeedsIconRefresh ? (
                  <div style={getSectionNoteStyle()}>
                    Run library scan again to refresh icons and library history.
                  </div>
                ) : null}
              </div>
            </PanelSectionRow>

            {cachedScanSummary !== undefined ? (
              <PanelSectionRow>
                <div style={getScanGridStyle()}>
                  {scanSummaryStats.map((stat) => (
                    <ScanStat key={stat.label} label={stat.label} value={stat.value} />
                  ))}
                </div>
              </PanelSectionRow>
            ) : null}
          </PanelSection>
        </div>
      </TopAlignedScrollViewport>
    </ScrollPanel>
  );
}
