# SteamOS Dev Shell Runbook

This runbook documents the current standalone SteamOS dev-shell flow for local browser validation and future on-device Steam Deck validation.

The SteamOS shell is a separate development/runtime path from the Decky plugin:

- SteamOS shell: local browser shell + local backend + `dist-steamos/steamos-bootstrap.js`
- Decky plugin: Decky runtime + Decky release ZIP

The Decky release ZIP remains Decky-only and must not include the SteamOS-only dev-shell files or `dist-steamos`.

## What The SteamOS Shell Supports Today

Current confirmed behavior:

- same-origin runtime metadata from `/__achievement_companion__/runtime`
- bearer-authenticated local backend requests
- RetroAchievements setup save and clear
- Steam setup save and clear
- explicit RetroAchievements dashboard refresh
- explicit Steam dashboard refresh
- dashboard cache writes for both providers
- cached dashboard reload after restart
- sanitized diagnostics/status panel
- no Steam scan or library artifact creation during dashboard refresh

Current non-goals:

- no final SteamOS installer or package
- no Flatpak, AppImage, or systemd integration
- no Game Mode support claim
- no game detail pages
- no achievement detail pages
- no Steam scan controls

## Prerequisites

- repo path: `D:\projects\steamProject` on Windows, or a local checkout path on SteamOS/Linux
- Node.js and `pnpm`
- Python 3
- browser available on the local machine or Steam Deck desktop mode
- optional real RetroAchievements and Steam credentials if you want to validate live dashboard refresh

## Build The SteamOS Bootstrap

Build the SteamOS frontend asset before launching the shell:

```powershell
cd D:\projects\steamProject
pnpm run build:steamos
```

Expected result:

- `dist-steamos\steamos-bootstrap.js` exists

If the file is missing, the interactive SteamOS dev shell will now fail with a clear error telling you to run `pnpm run build:steamos`.

## Optional Automated Validation Before Manual Testing

Run the main project validation first if you want a clean baseline:

```powershell
cd D:\projects\steamProject
pnpm run typecheck
pnpm test
python -m unittest discover -s tests/python -p "test_*.py"
python -c "from pathlib import Path; source = Path('main.py').read_text(); compile(source, 'main.py', 'exec'); print('main.py syntax OK')"
pnpm run build
pnpm run build:steamos
```

## SteamOS Doctor Command

Run the SteamOS doctor command before first launch, before Steam Deck validation, or after cleaning temp roots:

```powershell
cd D:\projects\steamProject
npm run doctor:steamos
```

What it checks safely:

- backend modules import cleanly
- current working directory looks like the repo root
- `dist-steamos/steamos-bootstrap.js` exists or needs `npm run build:steamos`
- XDG environment state and whether `XDG_RUNTIME_DIR` is ready
- provider config and provider secrets presence as booleans only
- dashboard cache presence as booleans only
- repo-local `.tmp-steamos*` scratch roots
- reminder that the standalone SteamOS shell is not the Decky release ZIP

What it does not do:

- validate provider credentials
- contact RetroAchievements or Steam
- start the backend or dev shell
- start a Steam scan
- print tokens, API keys, usernames, Steam IDs, provider config values, or secret file contents

## Launch Commands

### Windows Dev Shell

The simplest interactive launch command is:

```powershell
cd D:\projects\steamProject
pnpm run start:steamos
```

Equivalent direct Python command:

```powershell
cd D:\projects\steamProject
python -m backend.dev_shell
```

Expected safe console output:

```text
Achievement Companion SteamOS dev shell listening on http://127.0.0.1:<shell-port>
Local backend listening on http://127.0.0.1:<backend-port>
Local backend health available at http://127.0.0.1:<backend-port>/health
```

The output must not include:

- bearer tokens
- API keys
- usernames
- Steam IDs
- provider-config contents
- provider-secrets contents

### SteamOS Or Linux Launch

From a Linux or SteamOS desktop shell, the flow is the same:

```bash
cd /path/to/steamProject
pnpm run build:steamos
pnpm run start:steamos
```

If you prefer invoking Python directly:

```bash
cd /path/to/steamProject
python -m backend.dev_shell
```

Notes:

- shell and backend bind to `127.0.0.1` only
- ports default to `0`, so the OS chooses free ephemeral ports
- runtime metadata stays backend-owned and is written under `XDG_RUNTIME_DIR`

## Steam Deck Desktop Mode Checklist

Use this checklist when validating on a real Steam Deck in Desktop Mode.

### Before You Launch

- work from a clean local checkout
- keep the standalone SteamOS shell flow separate from the Decky plugin flow
- use placeholders only in notes, screenshots, or issue reports
- do not paste:
  - real API keys
  - runtime metadata tokens
  - provider-config contents
  - provider-secrets contents
  - full provider request URLs with query values

### Steam Deck Launch Steps

```bash
cd /path/to/steamProject
pnpm install
pnpm run build:steamos
```

Set an isolated XDG validation root:

```bash
root="$PWD/.tmp-steamos-deck-validation"
export XDG_CONFIG_HOME="$root/config"
export XDG_DATA_HOME="$root/data"
export XDG_STATE_HOME="$root/state"
export XDG_CACHE_HOME="$root/cache"
export XDG_RUNTIME_DIR="$root/runtime"

mkdir -p "$XDG_RUNTIME_DIR"
pnpm run start:steamos
```

Expected safe console output:

- printed shell URL
- printed backend URL
- printed backend health URL

The launch output must not include:

- bearer tokens
- API keys
- usernames
- Steam IDs
- provider-config contents
- provider-secrets contents

Open the printed shell URL in a Desktop Mode browser.

Important:

- do not open protected backend routes directly
- the only backend route that is safe to open directly is `/health`
- do not paste runtime metadata JSON into notes, issues, or chat

## Safe XDG Validation Root

For repeatable validation, especially on Windows or Steam Deck desktop mode, use explicit XDG directories.

### Windows PowerShell Example

```powershell
cd D:\projects\steamProject

$root = Join-Path $PWD ".tmp-steamos-real-dashboard"
$env:XDG_CONFIG_HOME = Join-Path $root "config"
$env:XDG_DATA_HOME = Join-Path $root "data"
$env:XDG_STATE_HOME = Join-Path $root "state"
$env:XDG_CACHE_HOME = Join-Path $root "cache"
$env:XDG_RUNTIME_DIR = Join-Path $root "runtime"

New-Item -ItemType Directory -Force $env:XDG_RUNTIME_DIR | Out-Null

pnpm run build:steamos
pnpm run start:steamos
```

### SteamOS Or Linux Example

```bash
cd /path/to/steamProject

root="$PWD/.tmp-steamos-real-dashboard"
export XDG_CONFIG_HOME="$root/config"
export XDG_DATA_HOME="$root/data"
export XDG_STATE_HOME="$root/state"
export XDG_CACHE_HOME="$root/cache"
export XDG_RUNTIME_DIR="$root/runtime"

mkdir -p "$XDG_RUNTIME_DIR"

pnpm run build:steamos
pnpm run start:steamos
```

These XDG directories are safe for local validation because they isolate:

- provider config
- provider secrets
- logs
- dashboard cache
- runtime metadata

## Manual Validation Checklist

### Steam Deck Quick Pass

Run this checklist in order on the Deck:

1. Fresh setup-required state
   - start with a fresh XDG temp root
   - confirm both providers show setup-required or not-configured state
   - confirm diagnostics is visible and sanitized

2. Setup save and clear
   - save RetroAchievements setup
   - save Steam setup
   - clear one provider once to confirm the UI returns to setup-required
   - confirm no saved raw API key is rendered back into the UI

3. Dashboard refresh
   - refresh RetroAchievements dashboard
   - refresh Steam dashboard
   - confirm each provider reaches a cached-dashboard state
   - confirm refresh does not happen automatically on page load

4. Cache validation
   - confirm dashboard cache files are created
   - restart with the same XDG root
   - confirm cached dashboard data loads before clicking `Refresh`

5. Recovery validation
   - while the browser remains open, stop the shell
   - try `Refresh status` or `Refresh dashboard`
   - confirm backend-unavailable guidance is clear and secret-free

6. Input and readability validation
   - use a `1280x800`-sized browser window if possible
   - use Tab and Shift+Tab through:
     - provider card actions
     - setup fields
     - save and clear buttons
     - dashboard chooser buttons
     - dashboard refresh and open actions
     - diagnostics refresh
   - confirm focus stays visible on the dark background
   - confirm controls feel comfortable for touch/click use

7. Boundary validation
   - confirm no Steam scan or library artifacts are created by dashboard refresh
   - confirm no secrets, tokens, usernames, or Steam IDs are visible in the UI
   - confirm diagnostics remains sanitized and secondary

### 1. Missing-State Shell

Start from a fresh XDG temp root and open the printed shell URL.

Confirm:

- app shell loads
- diagnostics/status panel loads
- both providers show setup-required or not-configured state
- dashboard cache is missing for both providers
- no secrets or tokens appear in the UI

### 2. Save RetroAchievements And Steam Setup

Enter real or test credentials manually in the browser UI.

Confirm:

- RetroAchievements save succeeds
- Steam save succeeds
- app shell updates to configured state
- no raw saved API key is shown
- diagnostics/status remains sanitized

### 3. Refresh RetroAchievements And Steam Dashboards

Use the explicit `Refresh dashboard` actions.

Confirm:

- RetroAchievements refresh succeeds
- Steam refresh succeeds
- no refresh happens automatically on page load
- dashboard cache files are created
- no Steam scan or library artifacts are created by dashboard refresh

Expected cache paths:

- `$XDG_CACHE_HOME/achievement-companion/dashboard/retroachievements.json`
- `$XDG_CACHE_HOME/achievement-companion/dashboard/steam.json`

### 4. Restart With The Same XDG Root

Stop the shell and launch it again with the same XDG environment.

Confirm:

- provider setup still reads as configured
- cached dashboard data appears before clicking `Refresh`
- diagnostics/status still shows cache present
- no secrets or tokens are visible

### 5. Optional File Inspection

Confirm backend-owned storage safety:

- config: `$XDG_CONFIG_HOME/achievement-companion/provider-config.json`
- secrets: `$XDG_DATA_HOME/achievement-companion/provider-secrets.json`
- runtime metadata: `$XDG_RUNTIME_DIR/achievement-companion/backend.json`

What to confirm:

- provider config contains only safe frontend-visible fields
- provider secrets do not contain plaintext API keys
- runtime metadata file is removed on clean shutdown

### 6. Optional Browser Storage Check

If you want an extra manual check, open browser devtools and confirm there is no credential or token state in:

- `localStorage`
- `sessionStorage`

## Issue Capture Template

When recording a Steam Deck validation issue, capture only sanitized information:

- environment:
  - Steam Deck model if relevant
  - SteamOS version if known
  - Desktop Mode browser used
- command used:
  - `pnpm run build:steamos`
  - `pnpm run start:steamos`
  - or the exact sanitized command variant you used
- browser/window mode:
  - Desktop Mode browser windowed or fullscreen
  - whether the test was done around `1280x800`
- provider affected:
  - RetroAchievements
  - Steam
  - both
  - shell/runtime only
- expected result
- actual result
- sanitized browser console output
- sanitized backend console output
- dashboard cache file present:
  - yes / no
- Steam scan or library artifacts appeared:
  - yes / no
- screenshot:
  - allowed only if no secrets, tokens, usernames, or Steam IDs are visible

Do not include:

- API keys
- runtime metadata tokens
- provider-config contents
- provider-secrets contents
- full request URLs with provider query values
- raw backend Authorization headers

## Runtime And Health Endpoints

While the shell is running:

- runtime metadata endpoint: `http://127.0.0.1:<shell-port>/__achievement_companion__/runtime`
- backend health endpoint: `http://127.0.0.1:<backend-port>/health`

Important:

- the runtime token should only appear in the runtime metadata JSON body
- the token should not appear in page HTML, bootstrap asset output, or console output

## Troubleshooting

### Missing `dist-steamos/steamos-bootstrap.js`

Run:

```powershell
pnpm run build:steamos
```

If you start the SteamOS shell without the asset, the shell now fails with a safe error that tells you to build first.

### Missing Or Invalid `XDG_RUNTIME_DIR`

The local backend requires a runtime metadata location. Set `XDG_RUNTIME_DIR` explicitly for manual validation if the environment does not already provide one.

Windows example:

```powershell
$env:XDG_RUNTIME_DIR = Join-Path $PWD ".tmp-steamos-real-dashboard\\runtime"
New-Item -ItemType Directory -Force $env:XDG_RUNTIME_DIR | Out-Null
pnpm run start:steamos
```

### Port Binding Failure

Both shell and backend default to port `0`, which asks the OS for free ports. If you see a bind error, retry without forcing ports or stop the conflicting local process.

### Backend Startup Failure

Check:

- `pnpm run build:steamos` completed
- `XDG_RUNTIME_DIR` exists and is writable
- no local antivirus or policy is blocking loopback localhost sockets

The launch output should remain sanitized even on failure.

### Browser Open Failure

This runbook assumes you open the printed URL manually. The shell does not auto-open a browser in this pass.

### Stale Temp State

If an interrupted run leaves stale files behind, remove the XDG temp root and restart from the build step:

```powershell
Remove-Item -Recurse -Force .\.tmp-steamos-real-dashboard
```

## Shutdown And Cleanup

Stop the shell with `Ctrl+C`.

After shutdown, verify:

- the browser page is no longer reachable
- `$XDG_RUNTIME_DIR/achievement-companion/backend.json` has been removed

Optional cleanup:

```powershell
Remove-Item -Recurse -Force .\dist-steamos
Remove-Item -Recurse -Force .\.tmp-steamos-real-dashboard
git status --short
```

## Decky Release Boundary

The Decky plugin release remains separate from the SteamOS shell flow.

The Decky release ZIP must stay Decky-only and exclude:

- `dist-steamos`
- `backend/dev_shell.py`
- `backend/local_launcher.py`
- `backend/local_server.py`
- `backend/paths.py`
- `backend/cache.py`
- SteamOS TypeScript source files
- tests and fixtures
- provider config or provider secrets files
- temporary XDG validation directories

Do not attach or paste any of these into GitHub issues or chat:

- `provider-config.json`
- `provider-secrets.json`
- runtime metadata JSON
- screenshots that show usernames, Steam IDs, tokens, or secrets
