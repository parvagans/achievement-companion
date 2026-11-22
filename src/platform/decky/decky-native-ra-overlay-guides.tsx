import { beforePatch, DialogButton, DialogControlsSection, findModuleExport, Navigation, type Patch } from "@decky/ui";
import { cloneElement, isValidElement, useLayoutEffect, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import { readPinnedAchievement } from "./decky-game-overview-preferences";
import { mapNativeChildren, wrapNativeRenderer } from "./decky-native-achievement-actions";
import type { NativeRetroAchievementsProjection } from "./decky-native-retroachievements-projection";
import { openDeckyStandardModal } from "./decky-standard-modal";
import { requestDeckySteamGamepadFocusAfterMount } from "./decky-steam-gamepad-focus";
import { readDeckyProviderConfigs } from "./providers/provider-config-store";

type NativeElement = ReactElement<Record<string, unknown>>;

interface RunningApp {
  readonly appid: number;
  BIsShortcut(): boolean;
}

interface NavigationRoot {
  render(props: Record<string, unknown>): ReactNode;
}

interface GuidesOptions {
  readProjection(appId: number): NativeRetroAchievementsProjection | undefined;
  subscribe(listener: () => void): () => void;
}

const GUIDES_KEY = "achievement-companion-ra-guides";
const RA_SITE = "https://retroachievements.org";
// The RA guides wiki lists this base-set guide even when GuideURL is absent from the API.
const COMMUNITY_GUIDE_BY_GAME_ID = new Map([
  ["10113", "https://github.com/RetroAchievements/guides/wiki/The-Legend-of-Zelda%3A-Ocarina-of-Time-%28Nintendo-64%29"],
]);

function isRunningShortcut(value: unknown): value is RunningApp {
  if (typeof value !== "object" || value === null) return false;
  const app = value as Partial<RunningApp>;
  return typeof app.appid === "number" && typeof app.BIsShortcut === "function" && app.BIsShortcut();
}

function isMenuNavigationRoot(value: unknown): value is NavigationRoot {
  if (typeof value !== "object" || value === null) return false;
  const render = Object.getOwnPropertyDescriptor(value, "render");
  if (render?.writable !== true || typeof render.value !== "function") return false;
  const source = String(render.value);
  return source.includes("navID") && source.includes("navTreeRef") && source.includes("parentEmbeddedNavTree");
}

function httpsGuideUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function getNativeRaGuideLinks(projection: NativeRetroAchievementsProjection): readonly { label: string; url: string }[] {
  const detail = projection.detailSnapshot;
  const guideUrl = httpsGuideUrl(detail?.game.metrics.find(metric => metric.key === "guide-url")?.value)
    ?? COMMUNITY_GUIDE_BY_GAME_ID.get(projection.raGameId);
  const forumId = detail?.game.metrics.find(metric => metric.key === "forum-topic-id")?.value;
  const accountId = readDeckyProviderConfigs().retroAchievements?.username.toLowerCase();
  const pin = accountId === undefined ? undefined : readPinnedAchievement({
    providerId: "retroachievements", gameId: projection.raGameId, accountId,
  });
  const pinned = projection.achievements.find(achievement => achievement.achievementId === pin?.achievementId);
  const links: { label: string; url: string }[] = [];
  if (pinned !== undefined && /^[1-9]\d*$/u.test(pinned.achievementId)) {
    links.push({ label: `Pinned Achievement · ${pinned.title}`, url: `${RA_SITE}/achievement/${pinned.achievementId}` });
  }
  if (guideUrl !== undefined) links.push({ label: "Mastery Guide", url: guideUrl });
  if (forumId !== undefined && /^[1-9]\d*$/u.test(forumId)) {
    links.push({ label: "Game Discussion", url: `${RA_SITE}/forums/topic/${forumId}` });
  } else {
    links.push({ label: "RetroAchievements Game Page", url: `${RA_SITE}/game/${projection.raGameId}` });
  }
  return links;
}

function RaGuidesLinks({ links, open }: {
  readonly links: ReturnType<typeof getNativeRaGuideLinks>;
  readonly open: (url: string) => void;
}) {
  const firstLink = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => requestDeckySteamGamepadFocusAfterMount(firstLink.current), []);

  return (
    <DialogControlsSection>
      {links.map(({ label, url }, index) => (
        <DialogButton key={label} ref={index === 0 ? firstLink : undefined} onClick={() => open(url)}>
          {label}
        </DialogButton>
      ))}
    </DialogControlsSection>
  );
}

function openRaGuides(projection: NativeRetroAchievementsProjection, event?: Event): void {
  const links = getNativeRaGuideLinks(projection);
  const trigger = event?.currentTarget as HTMLElement | undefined;
  let openingLink = false;
  openDeckyStandardModal({
    title: `${projection.title} Guides`,
    viewportSafe: true,
    parent: trigger?.ownerDocument?.defaultView ?? undefined,
    onClose: () => {
      if (!openingLink && trigger?.isConnected) requestDeckySteamGamepadFocusAfterMount(trigger);
    },
    renderContent: (close) => <RaGuidesLinks links={links} open={(url) => {
      if (openingLink) return;
      openingLink = true;
      close();
      // Let the native dialog release its window before Decky's navigation selects one.
      requestAnimationFrame(() => Navigation.NavigateToExternalWeb(url));
    }} />,
  });
}

/** Reuse the actual Steam row between Achievements and Notes, with Steam's normal focus behavior. */
export function insertNativeRaGuidesRow(box: NativeElement, makeRow: (nativeRow: NativeElement) => ReactNode): NativeElement {
  const children = box.props["children"];
  if (!Array.isArray(children) || !Array.isArray(children[0])) return box;
  const rows: ReactNode[] = children[0];
  const achievementIndex = rows.findIndex(row => isValidElement(row) && row.key === "achievements");
  const template = rows[achievementIndex];
  const notes = rows[achievementIndex + 1];
  if (!isValidElement<Record<string, unknown>>(template) || !isValidElement(notes) || notes.key !== "notes"
    || notes.type !== template.type || typeof template.props["onActivate"] !== "function") return box;
  const withGuides = [...rows.slice(0, achievementIndex + 1), makeRow(template), ...rows.slice(achievementIndex + 1)];
  return cloneElement(box, {}, withGuides, ...children.slice(1));
}

export function installNativeRaOverlayGuides(options: GuidesOptions): Patch | undefined {
  const root = findModuleExport(isMenuNavigationRoot);
  if (!isMenuNavigationRoot(root)) return undefined;

  function GuidesRow({ appId, template }: { readonly appId: number; readonly template: NativeElement }) {
    const projection = useSyncExternalStore(options.subscribe, () => options.readProjection(appId));
    if (projection === undefined) return null;
    return cloneElement(template, {
      text: "Guides", disabled: false, active: false,
      onActivate: (event?: Event) => {
        const current = options.readProjection(appId);
        if (current !== undefined) openRaGuides(current, event);
      },
    });
  }

  const wrapColumn = wrapNativeRenderer((rendered, props) => {
    const app = props["app"];
    if (!isRunningShortcut(app)) return rendered;
    return mapNativeChildren(rendered, node => {
      if (typeof node.type !== "function" || !String(node.type).includes(".NavigationBox")) return node;
      return insertNativeRaGuidesRow(node, template => <GuidesRow key={GUIDES_KEY} appId={app.appid} template={template} />);
    });
  });
  const wrapRunningControls = wrapNativeRenderer((rendered, props) => mapNativeChildren(rendered, node => (
    node.props["app"] === props["app"] && node.props["navRef"] !== undefined
      && typeof node.props["collapsible"] === "boolean" ? wrapColumn(node) : node
  )));
  const wrapMenuItem = wrapNativeRenderer((rendered, props) => (
    isValidElement<Record<string, unknown>>(rendered) && rendered.props["app"] === props["app"]
      && rendered.props["collapsible"] === true && rendered.props["instance"] !== undefined
      ? wrapRunningControls(rendered) : rendered
  ));

  return beforePatch(root, "render", (args: Record<string, unknown>[]) => {
    const [props] = args;
    if (props?.["navID"] !== "MainNavMenuContainer") return;
    const original = props["children"] as ReactNode;
    args[0] = {
      ...props,
      children: mapNativeChildren(original, node => (
        isRunningShortcut(node.props["app"]) && typeof node.props["visible"] === "boolean"
          && node.props["ownerWindow"] !== undefined ? wrapMenuItem(node) : node
      )),
    };
  });
}

