# SteamOS Local Backend Contract

This document describes the current backend boundary for a future non-Decky SteamOS runtime. A test-backed local Python backend skeleton now exists, along with backend helper modules and TypeScript SteamOS adapters. No SteamOS UI, dev shell, launcher, or SteamOS-specific package exists yet.

## Scope and Non-Goals

Scope:

- A future non-Decky SteamOS runtime that reuses the existing core, provider, and backend helper code.
- A local Python backend boundary that keeps provider credentials out of frontend configuration and browser storage.
- A platform-specific storage/auth design that does not reuse Decky homebrew paths.

Non-goals:

- Changing Decky plugin behavior or release packaging.
- Adding a SteamOS UI or dev shell in this phase.
- Claiming Steam Deck Game Mode parity.
- Claiming strong encryption for the current local secret record scheme.
- Adding a production launcher or process manager in this phase.
- Adding SteamOS packaging in this phase.

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
  "capabilities": ["health", "diagnostics", "provider-config"]
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

Output: saved non-secret provider config on success.

Secret safety: store the key through `backend/secrets.py`; write only non-secret config fields to provider-config.json.
Invalid input behavior: return a safe `400` response with `{"ok": false, "error": "invalid_payload"}`.

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

Output: saved non-secret provider config on success.

Secret safety: store the Steam Web API key through `backend/secrets.py`; provider-config.json remains non-secret.
Invalid input behavior: return a safe `400` response with `{"ok": false, "error": "invalid_payload"}`.

### `POST /clear_provider_credentials`

Input:

```json
{
  "providerId": "steam"
}
```

Output:

```json
{
  "ok": true,
  "cleared": true
}
```

Behavior: clear the selected provider config and secret. Clear related backend-owned caches when a future cache module owns them.
Invalid provider behavior: return a safe `400` response with `{"ok": false, "error": "invalid_provider_id"}`.

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
{
  "ok": true,
  "recorded": true
}
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

SteamOS packaging should be a separate future artifact. It may reuse `backend/*.py`, but SteamOS server/runtime files must not silently appear in the Decky ZIP. Today, `backend/local_server.py` and `backend/paths.py` remain excluded from the Decky ZIP. Release checks should remain strict and explicit for each package.

## Implementation Sequence

Completed:

1. `SteamOS Prep Pass 9 - SteamOS path resolver module`
   - Added `backend/paths.py` and path tests.

2. `SteamOS Backend Pass 1 - Local backend skeleton`
   - Added localhost backend skeleton and health route.

3. `SteamOS Backend Pass 2 - Token auth and localhost policy`
   - Added bearer auth hardening, method policy, body validation, and CORS policy coverage.

4. `SteamOS Backend Pass 3 - Provider config and credential endpoints`
   - Added authenticated provider config load/save/clear endpoints.

5. `SteamOS Backend Pass 4 - Provider request endpoints`
   - Added authenticated RetroAchievements and Steam request endpoints backed by backend-owned secrets.

6. `SteamOS Adapter Pass 1 - Mock local backend TypeScript adapters`
   - Added in-memory SteamOS backend client/adapters and adapter tests.

7. `SteamOS Adapter Pass 2 - Runtime harness with local backend adapters`
   - Added `createAppRuntime` composition coverage using mocked backend responses.

8. `SteamOS Backend Pass 5 - Local backend HTTP smoke tests`
   - Added real localhost HTTP smoke coverage using fake provider requesters only.

Remaining:

1. `SteamOS Backend Pass 6 - Python launcher/CLI wrapper`
   - Start and own the local backend process, write runtime metadata, and support clean shutdown.

2. `SteamOS Backend Pass 7 - Runtime metadata handoff`
   - Define how the future shell passes `baseUrl` and bearer token to the frontend in memory.

3. `SteamOS Adapter Pass 3 - Real client to live local backend integration`
   - Exercise the TypeScript client against the real Python backend.

4. `SteamOS Backend Pass 8 - Cache endpoint or file-backed cache strategy`
   - Decide whether caches stay frontend-local, move to backend endpoints, or use a shell-owned bridge.

5. `SteamOS UI Pass 1 - Minimal dev shell`
   - Add the smallest SteamOS shell that can launch the backend and host the frontend.

6. `SteamOS Packaging Pass 1 - Separate SteamOS artifact`
   - Define a SteamOS packaging story that remains isolated from Decky release artifacts.

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
