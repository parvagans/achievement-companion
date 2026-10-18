---
name: achievement-companion-whats-new
description: Maintain Achievement Companion's in-app Whats New notes across Git tag cycles, drafting changes since the latest tag and adding them only after the user's approval. Use when reviewing release-note candidates, updating Whats New, or handling a new tag.
---

# Achievement Companion Whats New

The QAM **Whats New** modal reads bundled notes from `src/platform/decky/decky-whats-new-content.ts`. Treat those notes as user-approved release copy, not an automatic dump of commits. This skill does not authorize creating tags, publishing releases, or changing update channels.

## Establish the cycle

- In this repository, find the latest tag reachable from the current commit with `git describe --tags --abbrev=0`, and inspect `git status --short`. The package version is not necessarily a tag.
- Compare commits and relevant source changes from that tag to the intended release state. Account for uncommitted work separately; do not call it part of a tagged release.
- When a new tag becomes the latest reachable tag, use it as the next baseline. Preserve the just-tagged notes in Git history, then start the next cycle; do not silently carry prior notes forward.

## Draft, approve, stash

1. Propose concise, user-facing changes grouped by meaningful area. Explain what is new or fixed, not implementation internals. Check claims against the diff and tests; avoid secrets, speculative features, and duplicates.
2. Present the exact proposed wording and baseline tag to the user. **Do not add, replace, or remove bundled Whats New notes until the user approves that wording.** Approval for a code change, commit, deployment, or tag is not approval for release-note wording.
3. After approval, save the approved entries in `src/platform/decky/decky-whats-new-content.ts`, retaining earlier approved entries for this tag cycle. That source file is the stash that survives later edits and is bundled into the next build. Keep the modal reading from it; do not create a second note list.
4. If an approved entry becomes inaccurate, show the proposed correction and seek approval before changing it. Remove an entry when the user explicitly asks for removal.
5. At the next tag, verify which approved entries shipped. Keep that tagged snapshot recoverable in Git. Draft the new cycle from the new tag; ask before clearing or replacing the modal's bundled copy.

When asked only for a draft or status, inspect and report without editing. After approval, update the source and verify the build in proportion to the change. Respect the repository navigation and versioning workflows; a notes-only edit does not require a version bump.
