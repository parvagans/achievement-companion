import type { NativeRetroAchievementsProjection } from "./decky-native-retroachievements-projection";

function formatReleaseDate(value: string, granularity: NativeRetroAchievementsProjection["releaseDateGranularity"]): string {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/u.exec(value.trim());
  if (match === null) return value;
  const [, year, month, day] = match;
  if (granularity === "year" || month === undefined) return year ?? value;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day ?? 1)));
  if (!Number.isFinite(date.getTime())) return value;
  if (granularity === "month" || day === undefined) {
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }
  if (granularity === "day") {
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  }
  return `${year}-${month}-${day}`;
}

function formatAvailabilityDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function renderDeckyNativeRetroAchievementsGameInfo(
  host: HTMLElement,
  projection: NativeRetroAchievementsProjection,
): void {
  const document = host.ownerDocument;
  const rows = [
    ["System", projection.platformLabel],
    ["Released", projection.releaseDate === undefined ? undefined : formatReleaseDate(projection.releaseDate, projection.releaseDateGranularity)],
    ["Developer", projection.developer],
    ["Publisher", projection.publisher],
    ["Genre", projection.genre],
    ["Achievements available since", projection.achievementsAvailableSince === undefined ? undefined : formatAvailabilityDate(projection.achievementsAvailableSince)],
  ].filter((row): row is [string, string] => row[1] !== undefined && row[1].trim().length > 0);
  const section = document.createElement("section");
  section.dataset["achievementCompanionNativeGameInfo"] = "true";
  section.style.cssText = "display:flex;gap:24px;align-items:flex-start;padding:20px 24px 24px;color:#dcdedf;background:rgba(10,14,18,.54);border-radius:4px";
  if (projection.boxArtImageUrl !== undefined) {
    const image = document.createElement("img");
    image.src = projection.boxArtImageUrl;
    image.alt = `${projection.title} original box art`;
    image.style.cssText = "width:188px;height:264px;flex-shrink:0;object-fit:contain;background:rgba(255,255,255,.035)";
    section.append(image);
  }
  const content = document.createElement("div");
  content.style.cssText = "min-width:0;flex:1";
  const eyebrow = document.createElement("div");
  eyebrow.textContent = "RetroAchievements game info";
  eyebrow.style.cssText = "font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#8b929a;margin-bottom:8px";
  content.append(eyebrow);
  const title = document.createElement("div");
  title.textContent = projection.title;
  title.style.cssText = "font-size:23px;font-weight:600;line-height:1.2;margin-bottom:18px";
  content.append(title);
  const facts = document.createElement("dl");
  facts.style.cssText = "display:grid;grid-template-columns:minmax(140px,36%) minmax(0,1fr);gap:9px 12px;margin:0;font-size:14px;line-height:1.3";
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    term.style.color = "#8b929a";
    const description = document.createElement("dd");
    description.textContent = value;
    description.style.cssText = "margin:0;overflow-wrap:anywhere";
    facts.append(term, description);
  }
  content.append(facts);
  section.append(content);
  host.replaceChildren(section);
}
