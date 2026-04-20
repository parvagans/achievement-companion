# Third-Party Notices

This repository depends on third-party packages whose licenses were checked with `pnpm licenses list`.

## Branding / Trademark Notices

- RetroAchievements is used for identification of the supported provider only. Achievement Companion is not affiliated with, endorsed by, sponsored by, or approved by RetroAchievements.
- © 2026 Valve Corporation. Steam and the Steam logo are trademarks and/or registered trademarks of Valve Corporation in the U.S. and/or other countries.
- Achievement Companion is not affiliated with, endorsed by, sponsored by, or approved by Valve Corporation.
- Achievement Companion does not provide ROMs, BIOS files, game files, or copyrighted game content.

## Runtime Dependencies

| Package | Version | License | Notes |
| --- | ---: | --- | --- |
| `@decky/api` | `1.1.3` | `LGPL-2.1` | Decky runtime API package. |
| `@decky/ui` | `4.11.1` | `LGPL-2.1` | Decky UI package used for Steam Deck/Game Mode surfaces. |
| `react` | `18.3.1` | `MIT` | React runtime. |
| `react-dom` | `18.3.1` | `MIT` | React DOM runtime. |
| `react-router` | `5.3.4` | `MIT` | Routing library. |

## Development Tooling

| Package | Version | License | Notes |
| --- | ---: | --- | --- |
| `@decky/rollup` | `1.0.2` | `BSD-3-Clause` | Decky Rollup tooling. |
| `rollup` | `4.60.1` | `MIT` | Bundler. |
| `tsx` | `4.21.0` | `MIT` | TypeScript execution helper for tests. |
| `typescript` | `5.9.3` | `Apache-2.0` | TypeScript compiler. |

## Audit Note

The direct dependency scan did not surface unknown licenses. The Decky packages are LGPL-2.1 and should be reviewed against your intended distribution requirements before release. This file is a repository hygiene note, not legal advice.