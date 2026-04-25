# SteamOS Local Backend Contract

This document sketches the intended backend boundary for a future non-Decky SteamOS runtime. It is design only. No SteamOS backend, loopback server, or UI exists yet.

## Scope and Non-Goals

Scope:

- A future non-Decky SteamOS runtime that reuses the existing core, provider, and backend helper code.
- A local Python backend boundary that keeps provider credentials out of frontend configuration and browser storage.
- A platform-specific storage/auth design that does not reuse Decky homebrew paths.

Non-goals:

- Changing Decky plugin behavior or release packaging.
- Claiming Steam Deck Game Mode parity.
- Claiming strong encryption for the current local secret record scheme.
- Implementing server code, SteamOS UI, package scripts, or provider behavior in this pass.

## Runtime Shape

The primary runtime should be a long-running local Python loopback service:

- Bind only to `127.0.0.1`.
- Use an OS-assigned ephemeral port.
- Be launched and owned by the future SteamOS app shell.
- Reuse backend helper modules for storage, secrets, diagnostics, HTTP, TLS, and redaction.

This avoids per-request Python process startup overhead during dashboard refreshes and Steam scans, while keeping raw provider credentials in the backend process.

Fallback: a stdio bridge child process. This removes the listening-port exposure but is harder to integrate with browser-based UI flows and concurrent scan/progress behavior.

Per-request CLI invocation is not preferred because it is slower, makes repeated provider requests more expensive, and increases the risk of leaking secrets through command-line arguments unless all request bodies use stdin.

## Auth and Exposure Model

The local backend should use defense-in-depth controls suitable for a single-user Steam Deck:

- Bind address: `127.0.0.1` only.
- Port: random OS-assigned port per backend start.
- Runtime file: `$XDG_RUNTIME_DIR/achievement-companion/backend.json` with `0600` permissions.
- Runtime file contents: port, backend process metadata, and a high-entropy per-session token. It must not contain provider API keys.
- Authorization: every non-health request requires `Authorization: Bearer <session-token>`.
- Token lifecycle: generated at backend start, kept in backend memory, and discarded on backend shutdown.
- Frontend token handling: the future app shell passes the token to the frontend runtime in memory. Do not persist it to localStorage/sessionStorage.
- CORS: default deny. If the UI runs in a browser context, allow only the exact local app origin. Do not use wildcard CORS.
- Origin checks: reject unexpected `Origin` values when present.

This does not protect against a fully compromised same-user local account. It is intended to prevent accidental exposure to arbitrary local web pages and to keep provider secrets out of frontend persistence.

## XDG Storage Layout

Use platform-specific XDG paths instead of Decky homebrew paths.

| Data | Primary path | Fallback |
| --- | --- | --- |
| Provider config | `$XDG_CONFIG_HOME/achievement-companion/provider-config.json` | `~/.config/achievement-companion/provider-config.json` |
| Provider secrets | `$XDG_DATA_HOME/achievement-companion/provider-secrets.json` | `~/.local/share/achievement-companion/provider-secrets.json` |
| Logs | `$XDG_STATE_HOME/achievement-companion/logs/` | `~/.local/state/achievement-companion/logs/` |
| Dashboard cache | `$XDG_CACHE_HOME/achievement-companion/dashboard/` | `~/.cache/achievement-companion/dashboard/` |
| Steam scan overview | `$XDG_CACHE_HOME/achievement-companion/steam/library-achievement-scan-overview.json` | `~/.cache/achievement-companion/steam/library-achievement-scan-overview.json` |
| Steam scan summary | `$XDG_CACHE_HOME/achievement-companion/steam/library-achievement-scan-summary.json` | `~/.cache/achievement-companion/steam/library-achievement-scan-summary.json` |

Config is backup-worthy non-secret state. Secrets are backend-owned app data. Logs are state. Large and rebuildable scan/dashboard data belongs in cache.

## Secret Handling

The first SteamOS prototype should reuse `backend/secrets.py`.

Requirements:

- Provider API keys stay backend-owned.
- Frontend-facing provider config includes only non-secret fields and `hasApiKey`.
- API keys are never stored in browser localStorage/sessionStorage.
- API keys are never written to provider-config.json.
- Logs and diagnostics are redacted before writing.

The current secret record scheme is local protection/obfuscation. It helps avoid plain-text secrets in ordinary files, but it is not strong encryption against a same-user local attacker. OS-backed storage can be designed later after the runtime and packaging shape are proven.

## Backend API Contract

All request and response bodies are JSON. Error responses must be sanitized and must not include raw provider secrets, secret-bearing URLs, or provider response bodies containing secrets.

### `GET /health`

Input: none.

Output:

```json
{
  "ok": true,
  "service": "achievement-companion",
  "capabilities": ["provider-config", "provider-secrets", "provider-requests", "diagnostics"]
}
```

Secret safety: no token required if it returns only non-sensitive health data. Any richer status should require authorization.

### `POST /get_provider_configs`

Input:

```json
{}
```

Output:

```json
{
  "version": 1,
  "retroAchievements": {
    "username": "user",
    "hasApiKey": true,
    "recentAchievementsCount": 10,
    "recentlyPlayedCount": 7
  },
  "steam": {
    "steamId64": "12345678901234567",
    "hasApiKey": true,
    "language": "english",
    "recentAchievementsCount": 5,
    "recentlyPlayedCount": 5,
    "includePlayedFreeGames": false
  }
}
```

Secret safety: never return `apiKey`, `apiKeyDraft`, `key`, `y`, `token`, `password`, `secret`, or `Authorization`.

### `POST /save_retroachievements_credentials`

Input:

```json
{
  "username": "user",
  "apiKeyDraft": "raw key from setup form",
  "recentAchievementsCount": 10,
  "recentlyPlayedCount": 7
}
```

Output: saved non-secret provider config or `null` if required values are missing.

Secret safety: store the key through `backend/secrets.py`; write only non-secret config fields to provider-config.json.

### `POST /save_steam_credentials`

Input:

```json
{
  "steamId64": "12345678901234567",
  "apiKeyDraft": "raw key from setup form",
  "language": "english",
  "recentAchievementsCount": 5,
  "recentlyPlayedCount": 5,
  "includePlayedFreeGames": false
}
```

Output: saved non-secret provider config or `null` if required values are missing.

Secret safety: store the Steam Web API key through `backend/secrets.py`; provider-config.json remains non-secret.

### `POST /clear_provider_credentials`

Input:

```json
{
  "providerId": "steam"
}
```

Output:

```json
true
```

Behavior: clear the selected provider config and secret. Clear related backend-owned caches when a future cache module owns them.

### `POST /request_retroachievements_json`

Input:

```json
{
  "path": "API/API_GetUserProfile.php",
  "query": {
    "u": "user"
  }
}
```

Output: provider JSON response.

Secret safety: backend loads the RetroAchievements key and adds `y` internally. Logs must include only safe path/status/duration fields.

### `POST /request_steam_json`

Input:

```json
{
  "path": "IPlayerService/GetOwnedGames/v1/",
  "query": {
    "steamid": "12345678901234567"
  },
  "handledHttpStatuses": [400, 403]
}
```

Output: provider JSON response or a handled HTTP envelope:

```json
{
  "handledHttpError": true,
  "status": 403,
  "statusText": "Forbidden",
  "message": "HTTP 403",
  "durationMs": 120
}
```

Secret safety: backend loads the Steam key and adds `key` internally. Expected Steam scan 400/403 responses remain scan outcomes, not fatal backend warnings.

### `POST /record_diagnostic_event`

Input: existing diagnostic event payloads.

Output:

```json
true
```

Behavior: use `backend/diagnostics.py` to keep only known events and safe fields, then write through redacted backend logging.

## TypeScript Adapter Mapping

Future SteamOS adapters should implement existing platform contracts:

- `AuthenticatedProviderTransportFactory`: calls `/request_retroachievements_json` and `/request_steam_json` with the in-memory bearer token.
- `ProviderConfigStore`: calls provider config endpoints; never stores raw keys in frontend storage.
- `DiagnosticLogger`: sends safe diagnostic payloads to `/record_diagnostic_event`; frontend redaction remains defense in depth.
- `DashboardSnapshotStore`: stores dashboard snapshots through backend file/cache APIs or a trusted app-shell storage API.
- `SteamLibraryScanStore`: stores overview and full summary separately, with the full summary file-backed.
- `PlatformCapabilities`: describes only the SteamOS runtime features that actually exist.

## Packaging Separation

Decky packaging remains unchanged in purpose: the Decky release ZIP contains Decky assets, `main.py`, and the reusable `backend/*.py` helper modules needed by `main.py`.

SteamOS packaging should be a separate future artifact. It may reuse `backend/*.py`, but SteamOS server/runtime files must not silently appear in the Decky ZIP. Release checks should remain strict and explicit for each package.

## Implementation Sequence

1. `SteamOS Prep Pass 9 - SteamOS path resolver module`
   - Likely files: `backend/paths.py`, Python tests.
   - Non-goals: changing Decky paths or storage behavior.

2. `SteamOS Backend Pass 1 - Local backend skeleton`
   - Likely files: new backend runtime module and tests.
   - Non-goals: provider API calls, token auth, UI.

3. `SteamOS Backend Pass 2 - Token auth and localhost policy`
   - Likely files: backend runtime/auth tests.
   - Non-goals: provider behavior or packaging polish.

4. `SteamOS Adapter Pass 1 - Mock TypeScript local backend adapters`
   - Likely files: TS adapter tests and mock transport.
   - Non-goals: real SteamOS UI or real secrets.

5. `SteamOS Backend Pass 3 - Real provider request bridge`
   - Likely files: backend API handlers and request tests.
   - Non-goals: Game Mode claims or UI parity.

6. `SteamOS UI Pass 1 - Minimal dev shell`
   - Likely files: future platform shell files.
   - Non-goals: Decky UI changes or release packaging merge.

## Risks and Mitigations

- Local backend exposure: bind to `127.0.0.1`, require bearer token, deny wildcard CORS.
- Token leakage: keep token in memory and a `0600` runtime file; never write to browser storage.
- Command-line secret leakage: never pass provider keys as CLI arguments.
- Logs: reuse backend redaction and diagnostics filtering.
- Stale or corrupt state: reuse storage quarantine helpers.
- Package/update story: keep Decky and SteamOS artifacts separate.
- Game Mode vs Desktop Mode expectations: first prototype should be described as a SteamOS local/dev runtime, not Game Mode parity.
- Performance: use a long-running backend rather than per-request process startup.
- Cache size: keep large Steam scan summaries file-backed under XDG cache.
