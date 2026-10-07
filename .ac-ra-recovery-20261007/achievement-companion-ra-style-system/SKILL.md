---
name: achievement-companion-ra-style-system
description: Build or review RetroAchievements QAM and full-screen styling in Achievement Companion while preserving its shared Steam-shaped interaction system and RA semantic data.
metadata:
  short-description: Maintain Achievement Companion RA styling
---

# Achievement Companion RA Style System

Use this skill for RA profile, game, achievement list, achievement detail, or full-screen visual changes. Read the existing Steam style skill when a request explicitly calls for parity with a Steam surface. For physical controller work, also read the `achievement-companion-steam-deck` skill and its complete runbook.

## Source of truth

Read `src/platform/decky/ra-theme.ts` and `src/platform/decky/decky-qam-theme.ts` before editing. Shared navy surfaces, blue/cyan accents, typography, radii, spacing, interactive rows, and focus treatment come from the QAM foundation. RA theme recipes add meaning for Hardcore, Softcore, Points, RetroPoints, Beaten, Mastered, rarity, and unlock state. The code owns exact values; this skill does not duplicate a token catalog.

For QAM game/list/detail work, read [references/compact.md](references/compact.md). For RA semantics and data provenance, read [references/semantics.md](references/semantics.md). Before claiming completion, follow [references/self-test.md](references/self-test.md).

## Durable boundaries

- Use the corresponding Steam QAM game, View Achievements, or detail surface as the structural, type, density, action, focus, scrolling, and Back reference. Let RA data differ without inventing additional sections or tiny text.
- Keep semantic borders visible before and during focus. On the compact achievement list and detail heading, `data-ac-ra-achievement-tone` lets RA scoped CSS preserve the left border color against Decky focus rules. The focus ring remains a separate visual layer.
- Put reusable RA styles in `ra-theme.ts`; keep only content-specific layout in components. Avoid provider-wide purple/red themes and avoid copying the Steam theme wholesale.
- Use Decky `Focusable` and existing navigation helpers. Passive information cards are controller stops; buttons use native activation and B/Back. Center focused content in the QAM viewport and preserve list filter, row identity, and scroll offset on detail return.
- Keep production Steam output stable unless the user explicitly requests a Steam change or a provider-neutral extraction is necessary. Verify both providers after touching shared components.
- Do not substitute source-pattern assertions for behavior checks. Model tests should exercise actual mode projection, metadata, filter counts, and return state; Deck checks should inspect `.gpfocus`, route, scroll position, computed semantic border, and screenshots when visual claims are made.
