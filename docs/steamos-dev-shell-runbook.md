# SteamOS Dev Shell Runbook

This runbook documents the current manual validation flow for the SteamOS dev shell before any dashboard UI work begins.

## Prerequisites

- Repo path: `D:\projects\steamProject`
- `pnpm` and Node.js available in PowerShell
- Python available in PowerShell
- Basic shell validation does not require any real RetroAchievements or Steam API calls
- Real RetroAchievements and Steam credentials are optional and only needed if you want to test local save and clear behavior yourself

## Build And Test

Run the basic validation steps first:

```powershell
cd D:\projects\steamProject
pnpm run typecheck
pnpm test
pnpm run build:steamos
```

Expected result:

- TypeScript checks pass
- automated tests pass
- `dist-steamos\steamos-bootstrap.js` is created

## Start The Dev Shell

The current interactive command is:

```powershell
python -m backend.dev_shell
```

Expected safe console output:

```text
Achievement Companion SteamOS dev shell listening on http://127.0.0.1:<shell-port>
Local backend listening on http://127.0.0.1:<backend-port>
```

Notes:

- The shell binds to `127.0.0.1` only.
- The shell port and backend port are OS-assigned ephemeral ports by default.
- `python -m backend.dev_shell --once` is only a smoke mode. It prints safe status and shuts down immediately, so it is not suitable for interactive browser testing.

## Open The Shell In A Browser

Open the shell URL printed by `python -m backend.dev_shell`, for example:

- `http://127.0.0.1:54321`

Expected page content:

- `SteamOS dev shell`
- `Connected to SteamOS backend`
- `RetroAchievements: configured` or `RetroAchievements: not configured`
- `Steam: configured` or `Steam: not configured`
- RetroAchievements credential form
- Steam credential form

Expected not to appear in the page:

- raw API keys
- bearer token
- `provider-secrets`
- runtime metadata JSON

## Validate Credential Save And Clear

Important:

- This pass only validates backend-owned credential save and clear behavior.
- It does not validate real RetroAchievements or Steam connectivity.
- It does not trigger dashboard refreshes or Steam scans.

### RetroAchievements

1. Enter a username.
2. Enter an API key.
3. Select `Save`.
4. Verify the status becomes `configured`.
5. Verify the API key field clears after save.
6. Select `Clear`.
7. Verify the status becomes `not configured`.

### Steam

1. Enter a numeric-looking `SteamID64`.
2. Enter a Steam Web API key.
3. Select `Save`.
4. Verify the status becomes `configured`.
5. Verify the API key field clears after save.
6. Select `Clear`.
7. Verify the status becomes `not configured`.

## Verify Storage Safety

### XDG-backed paths

The backend uses these XDG locations:

- config: `$XDG_CONFIG_HOME/achievement-companion/provider-config.json`
- secrets: `$XDG_DATA_HOME/achievement-companion/provider-secrets.json`
- logs: `$XDG_STATE_HOME/achievement-companion/logs/`
- runtime metadata: `$XDG_RUNTIME_DIR/achievement-companion/backend.json`
- cache root: `$XDG_CACHE_HOME/achievement-companion/`

If the XDG variables are not set, config, data, state, and cache fall back to standard user-home locations. Runtime metadata does not fall back; `XDG_RUNTIME_DIR` is required unless a test passes an explicit metadata path.

### Optional isolated XDG test directories

If you want to validate with temporary local paths, start PowerShell with explicit XDG variables:

```powershell
cd D:\projects\steamProject
$root = Join-Path $PWD ".tmp-steamos-runbook"
$env:XDG_CONFIG_HOME = Join-Path $root "config"
$env:XDG_DATA_HOME = Join-Path $root "data"
$env:XDG_STATE_HOME = Join-Path $root "state"
$env:XDG_CACHE_HOME = Join-Path $root "cache"
$env:XDG_RUNTIME_DIR = Join-Path $root "runtime"
python -m backend.dev_shell
```

### Inspect provider config

`provider-config.json` is the frontend-safe config file. It should not contain raw API keys.

Example path:

```text
$XDG_CONFIG_HOME\achievement-companion\provider-config.json
```

Things to confirm:

- `hasApiKey` may be reflected indirectly through UI behavior, but raw API keys are not stored here
- usernames, `steamId64`, and safe settings may be present

### Inspect provider secrets

`provider-secrets.json` is backend-owned. It should not contain the raw API key in plain text. The current scheme stores a local protected record using fields such as:

- `version`
- `scheme`
- `salt`
- `nonce`
- `ciphertext`
- `tag`

Example path:

```text
$XDG_DATA_HOME\achievement-companion\provider-secrets.json
```

Important:

- this is local protection/obfuscation, not a strong encryption claim
- the frontend still never receives the raw saved API key back

### Optional browser storage check

If you want an extra manual check, open browser devtools and confirm there is no credential or token state in:

- `localStorage`
- `sessionStorage`

## Runtime Metadata Check

While the dev shell is running, the same-origin runtime metadata endpoint is:

- `http://127.0.0.1:<shell-port>/__achievement_companion__/runtime`

This endpoint is for bootstrap/runtime handoff. The token should only appear in that JSON response and should not appear in the page HTML or the built bootstrap asset.

The runtime metadata file on disk should be:

- `$XDG_RUNTIME_DIR/achievement-companion/backend.json`

On clean shutdown it should be removed automatically.

## Shutdown And Cleanup

Stop the dev shell with:

- `Ctrl+C`

After shutdown, verify:

- the browser page is no longer reachable
- `$XDG_RUNTIME_DIR/achievement-companion/backend.json` has been removed

Remove the built SteamOS asset if you do not want to keep local generated output:

```powershell
Remove-Item -Recurse -Force .\dist-steamos
```

Confirm the working tree state:

```powershell
git status --short
```

## Release Boundary Check

If you want to re-confirm the Decky packaging boundary after local SteamOS shell testing:

```powershell
pnpm run package:release
pnpm run check:release
```

Confirm the Decky ZIP excludes:

- `dist-steamos`
- `backend/dev_shell.py`
- `backend/local_launcher.py`
- `backend/local_server.py`
- `backend/paths.py`
- `backend/cache.py`
- SteamOS TypeScript source files

## Known Limitations

- dev shell only
- no Game Mode support claim
- no production SteamOS packaging
- no dashboard UI
- no game detail UI
- no achievement detail UI
- no provider API validation or ping from the shell
- no Steam scan from the shell UI
- no advanced settings UI yet

## Troubleshooting

### `dist-steamos/steamos-bootstrap.js` is missing

Run:

```powershell
pnpm run build:steamos
```

If the file is still missing, stop and fix the SteamOS build before validating the shell UI.

### The shell page says the backend is unavailable

Check:

- `python -m backend.dev_shell` is still running
- the terminal did not exit early
- the shell URL matches the printed shell port exactly

You can also confirm the shell printed both:

- `Achievement Companion SteamOS dev shell listening on ...`
- `Local backend listening on ...`

### `XDG_RUNTIME_DIR` is missing

The local backend launcher requires a runtime metadata location. For manual validation, set `XDG_RUNTIME_DIR` explicitly if your environment does not provide one:

```powershell
$env:XDG_RUNTIME_DIR = Join-Path $PWD ".tmp-steamos-runbook\\runtime"
python -m backend.dev_shell
```

### Port already in use

The current shell and backend default to port `0`, so the OS should choose free ports automatically. If you passed explicit ports, remove them and retry with the default command.

### `pnpm` or `tsx` is not on PATH

If `pnpm test` or related validation commands fail because `tsx` is not found, reopen the shell after installing project prerequisites and confirm `pnpm` works from the same PowerShell session.

### Stale local files after an interrupted run

If the shell or backend was interrupted uncleanly, remove the temporary or XDG test directories you created and restart the flow from the build step. A stale runtime metadata file should not be treated as a valid live session.
