# Achievement Companion

![Steam Deck](https://img.shields.io/badge/Steam%20Deck-Game%20Mode-blue)
![Decky Loader](https://img.shields.io/badge/Decky%20Loader-Plugin-blueviolet)
![Provider](https://img.shields.io/badge/Provider-RetroAchievements-orange)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

Achievement Companion is a Decky plugin for Steam Deck Game Mode that brings achievement progress, unlock history, and provider-specific stats into a controller-friendly interface.

It is structured as a provider shell. The compact Decky panel starts with a provider chooser, then opens the selected provider's dashboard and settings. RetroAchievements is the first supported provider.

## Features

- Provider-first compact Decky flow
- RetroAchievements sign-in, setup, and sign-out
- Provider-specific settings for credentials and display preferences
- Overview, recent achievements, recently played games, and completion progress
- Achievement history, game detail, and achievement spotlight pages
- Refresh and settings controls designed for Game Mode
- Touch- and controller-friendly UI

## Current Provider Support

- RetroAchievements

## Project Status

Achievement Companion is currently focused on RetroAchievements support and the provider-first Decky shell. The app is structured for additional providers, but RetroAchievements is the only live provider today.

## Roadmap

Achievement Companion is being built as a provider-first achievement aggregator for Steam Deck Game Mode.

Planned direction:

- Add support for additional achievement providers
- Expand the provider chooser into a true multi-provider hub
- Keep provider account setup and settings isolated per provider
- Improve cross-provider dashboard summaries
- Add richer filtering and sorting for achievement history and completion progress
- Continue polishing controller, touch, and Game Mode navigation behavior

RetroAchievements is the first supported provider. Future providers should plug into the existing provider shell without requiring a redesign of the Decky UI.

## Installation

Build the plugin with `pnpm run build`, then copy the generated plugin files into Decky Loader's plugins directory using your normal Decky development workflow.

## Development

- `pnpm install`
- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`

## Credential storage and privacy

Achievement Companion stores RetroAchievements credentials locally on the Steam Deck using the Steam/Decky Chromium frontend storage.

On a tested Steam Deck, the saved provider config was found under Steam’s `htmlcache` Local Storage LevelDB profile, for example:

`/home/deck/.local/share/Steam/config/htmlcache/Default/Local Storage/leveldb/`

The stored provider config contains the RetroAchievements username and API key entered in the plugin setup screen.

Credentials are not stored in this repository, are not included in the release package, and are only used locally by the plugin to call RetroAchievements API endpoints.

RetroAchievements API requests include the API key as required by the RetroAchievements API. Achievement Companion requests those API responses with the fetch `no-store` cache mode to reduce retention of authenticated request data in Steam/CEF HTTP cache without adding custom request headers.

## Legal / Third-Party Notices

- RetroAchievements is a third-party service. Achievement Companion is not affiliated with, endorsed by, or sponsored by RetroAchievements unless the maintainers state otherwise.
- RetroAchievements names and logos belong to their respective owners.
- Steam Deck, Steam, and Valve are trademarks of Valve Corporation. Achievement Companion is not affiliated with or endorsed by Valve.
- Third-party dependency notes are recorded in `THIRD_PARTY_NOTICES.md`.

## License

MIT. See `LICENSE`.
