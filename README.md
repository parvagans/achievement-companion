# Achievement Companion

![Steam Deck](https://img.shields.io/badge/Steam%20Deck-Game%20Mode-blue)
![Decky Loader](https://img.shields.io/badge/Decky%20Loader-Plugin-blueviolet)
![Version 0.3.1](https://img.shields.io/badge/Version-0.3.1-informational)
![Provider RetroAchievements](https://img.shields.io/badge/Provider-RetroAchievements-orange)
![Provider Steam](https://img.shields.io/badge/Provider-Steam-171a21)

Achievement Companion is a Decky Loader plugin for Steam Deck Game Mode. It brings RetroAchievements and Steam achievement progress into the Decky quick-access menu and adds game-page achievement badges that can open fullscreen achievement details. 

## What Is New In v0.3.1

- Steam provider artwork and fullscreen game overview/detail pages were polished for a cleaner Deck UI.
- RetroAchievements ROM hash fallback now helps supported non-Steam, Steam ROM Manager, and EmuDeck shortcut pages when a readable launched ROM path is available.
- Hash fallback fails closed and falls back to the existing platform-scoped title matcher when hashing is not possible or does not produce a match.
- Runtime diagnostics were expanded for non-Steam game-page and hash fallback troubleshooting.

## Core Features

- Provider-first Decky dashboard for RetroAchievements and Steam.
- Compact quick views plus fullscreen browsing screens.
- RetroAchievements profile, recent unlocks, recently played games, and completion progress.
- Steam profile details, recent games, recent unlocks, full-library achievement totals, and cached scan summaries.
- Backend-owned credential handling with secret-safe logs and frontend-safe config.
- Manual Steam full-library scanning for cached account-wide totals.
- Game-page achievement badges for supported Steam games and supported RetroAchievements-backed non-Steam shortcuts.

## Supported Providers

### RetroAchievements

Connect your RetroAchievements account to browse your profile, recent unlocks, recently played games, and completion progress from the Decky quick-access menu.

- View your RetroAchievements profile and avatar.
- See recent unlocks with game and achievement details.
- Browse recently played games.
- Check completion and progress information where RetroAchievements provides it.
- Configure how many recent achievements and recently played games appear for the provider.

### Steam

Connect your Steam Web API key and SteamID64 to view Steam achievement activity, recent games, profile progression, and full-library achievement totals from the Decky quick-access menu.

- View Steam profile details, level, badges, and account progression where available.
- See recently played Steam games.
- Surface recent achievement unlocks from loaded or recent games.
- Run a manual full-library scan for broader achievement totals.
- Show cached full-library totals such as owned games, unlocked achievements, total achievements, perfect games, and completion percentage.
- Configure Steam display options such as recent counts, language, and played free games.

## Non-Steam / SRM / EmuDeck Badge Support

Steam game-page badge support uses Steam achievement data. For non-Steam shortcuts, v0.3.1 adds a RetroAchievements resolver path that can use a readable launched ROM path to help match supported Steam ROM Manager and EmuDeck shortcuts to RetroAchievements games.

- The badge only appears when a shortcut can be matched safely.
- Matching is scoped to the detected shortcut platform first.
- Steam ROM Manager and EmuDeck platform labels are normalized to RetroAchievements canonical system names where the mapping is unambiguous.
- Title matching is deterministic and platform-scoped.
- Diacritic and Punctuation differences are handled safely.
- If a readable launched ROM path is available, the resolver can hash it and use RetroAchievements hash data before falling back to title matching.
- Platform suffix handling is conservative and only applies when it is safe for the detected platform.
- If hashing is not possible, the hash lookup fails closed, or a shortcut is ambiguous or unsupported, the badge intentionally stays hidden rather than risk showing the wrong game.
- Clicking the badge opens the fullscreen achievement detail view for that game.
- Back behavior returns to the original Steam game page.

## Privacy And Credential Handling

Achievement Companion is designed so provider API keys do not live in the browser frontend. After you save a provider account, the frontend-facing config only receives non-secret settings such as username, SteamID64, display counts, language, and whether a key exists. Secret-bearing provider requests are handled by the backend.

- Provider config: `/home/deck/homebrew/settings/achievement-companion/provider-config.json`
- Provider secrets: `/home/deck/homebrew/settings/achievement-companion/provider-secrets.json`
- Backend logs: `/home/deck/homebrew/logs/achievement-companion/`

Additional notes:

- API keys are not stored in browser `localStorage` or `sessionStorage`.
- API keys are stored separately from non-secret provider settings.
- Backend logs redact secret-like fields and provider URLs containing key or `y` parameters.
- Provider config is saved separately from provider secrets.
- Secret storage uses local protected or obfuscated records; that is not a guarantee against a compromised local device.

If you need to rotate or revoke an API key, do that from the provider website and then update the plugin settings on the Deck.

## Steam Library Scan

Steam library scanning is manual because larger Steam libraries can take several minutes to check.

- The scan updates the Steam overview with the latest full-library totals.
- Cached totals include owned games, unlocked achievements, total achievements, perfect games, and completion percentage.
- Some games may be skipped or fail if Steam reports no stats, private data, or unavailable achievement data.
- Skipped or failed games are normal for some Steam libraries and do not necessarily mean the scan failed.

## Requirements

- Steam Deck or compatible SteamOS device running Game Mode
- Decky Loader
- RetroAchievements account and API key for RetroAchievements features
- Steam Web API key and SteamID64 for Steam provider features
- Non-Steam shortcut support depends on shortcut metadata created by tools such as Steam ROM Manager or EmuDeck

## Installation

Download the latest release ZIP from the project’s GitHub Releases page:

[Download the latest release](https://github.com/CodeNode-Automation/achievement-companion/releases/latest)

On your Steam Deck:

1. Open Decky Loader.
2. Click the settings button.
3. In the **General** tab, find **Other**.
4. Turn on **Developer Mode**.
5. Open the **Developer** tab.
6. Choose either:
   - **Browse for ZIP file**, then select the downloaded release ZIP.
   - **Install from URL**, then paste the release ZIP URL.
7. Install the plugin.
8. Restart your Steam Deck.
9. Open Achievement Companion from Decky and enter your RetroAchievements and/or Steam provider credentials.

## License And Notices

- Achievement Companion is not affiliated with, endorsed by, sponsored by, or approved by RetroAchievements or Valve Corporation.
- This project is released under the BSD-3-Clause License. See [`LICENSE`](LICENSE).
- Third-party dependency notes are recorded in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Contact / Support

Email: [`nullbit5@protonmail.com`](mailto:nullbit5@protonmail.com)

If you prefer repository-based support, use the project issue tracker on GitHub.

## Release Layout

The release zip is packaged as:

```text
achievement-companion/
  backend/
    __init__.py
    diagnostics.py
    http.py
    provider_config.py
    redaction.py
    secrets.py
    steam_shortcuts.py
    storage.py
    tls.py
  dist/
    index.js
  INSTALL_DIAGNOSTIC.txt
  LICENSE
  main.py
  package.json
  plugin.json
  README.md
  THIRD_PARTY_NOTICES.md
