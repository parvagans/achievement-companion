import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { components } from "./decky-component-declarations";
import { DeckyAchievementArtwork } from "../../src/platform/decky/decky-achievement-artwork";
import { DeckyAchievementTypeBadge } from "../../src/platform/decky/decky-achievement-type-badge";
import { DeckyUpNextPinIcon } from "../../src/platform/decky/decky-up-next-pin-icon";
import { createUpNextPinAction } from "../../src/platform/decky/decky-up-next-pin-action";
import { achievementCompanionQamTheme as theme, achievementCompanionAchievementRowRecipes, getQamCompactFocusControlStyle } from "../../src/platform/decky/decky-qam-theme";
import { steamRecipes, steamTheme } from "../../src/platform/decky/steam-theme";
import { getAchievementCompanionThemeVariables } from "../../src/platform/decky/decky-theme-palette";
import { formatDeckyOverviewDateTime } from "../../src/platform/decky/decky-overview-format";

export interface OverviewFixture {
  id: string; width: number; height: number; scale: number;
  descriptions: readonly string[]; theme?: string; pinned?: boolean; missingArt?: boolean; longTitle?: boolean;
  titles?: readonly string[]; firstClassification?: "win-condition";
}

export async function overviewFixtureRenderer(sourceOverride?: string) {
  const Focusable = ({ children, style, ...props }: any) => createElement("div", { style, ...Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith("data-") || key.startsWith("aria-"))) }, children);
  const deps = { createElement, Fragment, useState: () => [false, () => {}], Focusable, DeckyUpNextPinIcon, theme, getQamCompactFocusControlStyle };
  const { DeckyUpNextPinButton } = await components("decky-up-next-pin-button.tsx", ["DeckyUpNextPinButton"], deps);
  const content = await components("decky-full-screen-game-overview-content.tsx", ["overviewPanelStyle", "overviewMetadataStyle", "SuggestionRow", "DeckyOverviewCompanion", "DeckyOverviewProgress"], {
    ...deps, DeckyUpNextPinButton, createUpNextPinAction, DeckyAchievementArtwork, DeckyAchievementTypeBadge,
    NavEntryPositionPreferences: { FIRST: 1 }, achievementCompanionAchievementRowRecipes, steamTheme, steamRecipes,
    buildDeckyManageSuggestionsMenuItems: () => [], DeckyOverviewMenuButton: () => createElement("button", { style: { height: 28 } }, "Manage Suggestions"),
    formatDeckyOverviewDateTime,
    DeckyGameArtwork: ({ size }: any) => createElement("span", { style: { display: "block", width: size, height: size } }),
    DeckyCompletionProgressBar: () => createElement("div", { style: { height: 5, background: "#53d1ed" } }),
  }, sourceOverride);
  const layout = await components("decky-full-screen-game-overview-layout.tsx", ["getDeckyOverviewGridRows", "getOverviewGridStyle", "getDeckyOverviewDashboardColumns", "getDashboardStyle"], {});
  const artwork = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="#789ab0"/><path d="M2 2h8M2 2v8M34 34h-8M34 34v-8" fill="none" stroke="white" stroke-width="2"/></svg>');
  return { content, layout, render(fixture: OverviewFixture) {
    const suggestions = fixture.descriptions.map((description, index) => ({ achievement: { providerId: "steam", gameId: "1", achievementId: String(index), title: fixture.titles?.[index] ?? (fixture.longTitle ? "A much longer achievement title with several words" : ["First achievement", "Second achievement", "Third achievement"][index]), description, metrics: [], isUnlocked: false, ...(index === 0 && fixture.firstClassification ? { classification: fixture.firstClassification } : {}), ...(fixture.missingArt ? {} : { badgeImageUrl: artwork }) }, rarityPercent: 24 + index, pinned: fixture.pinned && index === 0 }));
    const actions = { suggestions, hiddenSuggestions: [], onTogglePin() {}, onFocusedSuggestionChange() {}, onFocusedPinChange() {}, onOpenAchievement() {}, onJumpToAchievement() {}, onDismissSuggestion() {} };
    const progress = createElement(content.DeckyOverviewProgress, { headline: "In Progress", unlocked: 10, total: 50, remaining: 40, percent: 20, lastUnlock: 1700000000, latestAchievement: suggestions[0]?.achievement });
    const companion = createElement(content.DeckyOverviewCompanion, { actions, completed: false, history: null });
    return renderToStaticMarkup(createElement("div", { "data-case": fixture.id, style: { width: fixture.width * fixture.scale, height: fixture.height * fixture.scale, marginBottom: 24 } },
      createElement("div", { style: { width: fixture.width, height: fixture.height, transform: `scale(${fixture.scale})`, transformOrigin: "top left", fontFamily: theme.type.fontFamily, ...getAchievementCompanionThemeVariables((fixture.theme ?? "ac-blue") as any) } },
        createElement("div", { "data-ac-game-overview-layout": true, style: layout.getOverviewGridStyle(fixture.height) },
          createElement("div", { style: { ...content.overviewPanelStyle, justifyContent: "center" } }, "Overview fixture — actual production panel/card styles"),
          createElement("div", { "data-dashboard": true, style: layout.getDashboardStyle(false) }, progress, companion),
          createElement("div", { style: content.overviewPanelStyle }, "Supporting statistics")))));
  } };
}

export function overviewMeasurementScript(): string {
  return `const reports = [...document.querySelectorAll('[data-case]')].map(root => {
    const panel = root.querySelector('section[aria-label="Up Next"]');
    const list = panel.children[1]; const cards = [...root.querySelectorAll('[data-ac-up-next-id]')];
    const rect = element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}; };
    return {id:root.dataset.case, panel:rect(panel), progress:rect(root.querySelector('section[aria-label="Your progress"]')),
      list:rect(list), scrollHeight:list.scrollHeight, clientHeight:list.clientHeight,
      cards:cards.map(card=>({rect:rect(card), title:rect(card.querySelector('strong')),
        art:card.querySelector('img') ? rect(card.querySelector('img')) : null,
        pin:rect(card.parentElement.querySelector('[data-ac-up-next-pin-action]')),
        text:rect(card.children[1]), description:card.querySelector('[data-ac-up-next-row-description]') ? {rect:rect(card.querySelector('[data-ac-up-next-row-description]')), scrollHeight:card.querySelector('[data-ac-up-next-row-description]').scrollHeight,clientHeight:card.querySelector('[data-ac-up-next-row-description]').clientHeight,lineClamp:getComputedStyle(card.querySelector('[data-ac-up-next-row-description]')).webkitLineClamp,lineHeight:parseFloat(getComputedStyle(card.querySelector('[data-ac-up-next-row-description]')).lineHeight)} : null})),
      gaps:cards.slice(1).map((card,index)=>rect(card).y-rect(cards[index]).bottom),
      rootOverflow:root.firstElementChild.scrollHeight-root.firstElementChild.clientHeight};
  }); document.getElementById('measurements').textContent=JSON.stringify(reports);`;
}
