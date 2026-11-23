# Antigravity Pulse Desktop

**An OLED workspace cockpit for AI and engineering consoles — with a secure phone companion bridge.**

| | |
| --- | --- |
| Version | 1.0.1 |
| Platform | Windows 10/11 (x64) first — macOS and Linux packaging configured |
| Author | Solomon Ogar Bukie · [solomonogarbukie@gmail.com](mailto:solomonogarbukie@gmail.com) · [@IceCool30](https://github.com/IceCool30) |
| License | MIT |
| Companion | [Antigravity Pulse for Android](https://github.com/IceCool30/Antigravity-Pulse-) v1.2.1+ |
| Firebase project | `gen-lang-client-0437586304` (shared with Android) |

---

## What it is

Antigravity Pulse Desktop keeps nine consoles warm in a single frameless window. Workspaces are
real Chromium `WebContentsView`s managed by the main process — they are mounted once, kept pinned,
and never destroyed when you switch. Sign-ins, drafts, scroll positions, and local state survive
every workspace change.

1. **Antigravity Remote** — `Ctrl+1` · `Ctrl+Shift+O`
2. **T3 Code Web** — `Ctrl+2` · `Ctrl+Shift+T`
3. **Google AI Studio** — `Ctrl+3` · `Ctrl+Shift+A`
4. **Gemini** — `Ctrl+4` · `Ctrl+Shift+G`
5. **GitHub** — `Ctrl+5` · `Ctrl+Shift+H`
6. **Vercel** — `Ctrl+6` · `Ctrl+Shift+V`
7. **Supabase** — `Ctrl+7` · `Ctrl+Shift+S`
8. **Pulse Browser** — `Ctrl+8` · `Ctrl+T`
9. **Cloud Sync & Phone Companion** — `Ctrl+9` · `Ctrl+Shift+P`

### Highlights

- **Persistent cockpit.** Lazy-mount, then pin. Per-workspace renderer crash recovery with an
  isolated one-click reload banner — one crashed workspace never takes down the others.
- **Split view.** Two web workspaces side by side with a draggable 8px divider, independent
  bounds, and automatic collapse when the window is too narrow.
- **Zen mode.** `Ctrl+\` or `F11` drops the titlebar and rail so the workspace owns the whole
  window.
- **Command palette.** `Ctrl+K` searches every workspace, action, and resume URL.
- **Pulse Browser.** A focused multi-tab browser using the same authenticated session, with tab
  strip, address bar, and in-page find.
- **Adaptive themes.** All 12 Antigravity presets, OLED dark and adaptive light
  (`#EFF3F8` / `#FFFFFF` / `#0F172A`), with WCAG AA+ accent adjustment at **≥ 4.8:1**.
- **Cloud parity.** Google sign-in and real-time Firestore CRUD for server profiles and copilot
  prompts, using the exact schema shared with the Android app.
- **Phone bridge.** Opt-in local HTTP + WebSocket service with a 256-bit bearer token, LAN /
  Tailscale discovery, QR pairing, and native desktop notifications.
- **Tray keep-alive.** Close to tray by default, live tooltip with the active workspace and pinned
  count, tray menu for every workspace, and update checks.
- **Real RAM accounting.** Live `app.getAppMetrics()` readout, per-workspace memory dots, and
  one-click unload/hibernate for idle workspaces.

---

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer can only call a
  typed preload bridge (`window.pulse`) — no Node access, no arbitrary IPC.
- No `<webview>` and no `BrowserView`; all embedded pages use main-process `WebContentsView`s with a
  shared `persist:antigravity-main` session and optional per-workspace partitions.
- OAuth popups open as restricted child windows in the same session. External links go to the
  system browser or Pulse Browser according to your setting.
- Google sign-in uses the **system browser** with PKCE and an ephemeral `127.0.0.1` loopback port.
  Tokens are exchanged in the main process and handed to Firebase Auth in the renderer.
- Secrets never enter source control. `.env` is gitignored. Profile tokens are encrypted with
  Electron `safeStorage` (Windows DPAPI) and are **never** written to Firestore — every profile
  document carries `authToken: ""`.
- T3 handshake tokens (`#token=…`) live only in memory. Persisted and displayed URLs are passed
  through `stripUrlSecrets()`.
- The phone bridge is off until you enable it. Every API call requires the bearer token; failed
  authentication is rate-limited.

---

## Getting started

### Prerequisites

- Node.js 22+ and npm 10+
- Windows 10/11 x64 (recommended) or macOS / Linux for development
- The Firebase Web config and Google Desktop OAuth client from
  `C:\Users\john.bisong\Keys\antigravity-pulse\desktop-firebase-config.json`

### Install and run

```powershell
git clone https://github.com/IceCool30/Antigravity-Pulse-Desktop.git
cd Antigravity-Pulse-Desktop
npm install
Copy-Item .env.example .env
# Fill in the seven VITE_FIREBASE_* values, VITE_FIREBASE_DATABASE_ID,
# MAIN_VITE_GOOGLE_CLIENT_ID and MAIN_VITE_GOOGLE_CLIENT_SECRET.
npm run dev
```

`.env` is read at build time by electron-vite and is never committed. The Firebase Web API key is a
public client identifier. Google requires the client secret at the token endpoint even for Desktop
clients using PKCE, so the configured secret is compiled into the installed app — Google explicitly
treats installed-app client secrets as non-confidential. Keep `.env` out of git, rotate the OAuth
client if a build is shared with an untrusted party, and never reuse this client as a Web
application credential. The bridge token and Firestore profile tokens are never compiled in: they
are generated at runtime and stored by the operating system.

### Firebase / Google configuration

| Setting | Value |
| --- | --- |
| Project | `gen-lang-client-0437586304` |
| Firestore database | `ai-studio-android-antigrav-ea683b89-609d-444d-bd8a-e4b9283b0e34` (named, not `(default)`) |
| Region | `europe-west1` |
| OAuth client type | Desktop |
| OAuth flow | System-browser loopback + PKCE, dynamic `http://127.0.0.1:<port>/callback` |

Do **not** hard-code a redirect URI for a Desktop client — Google allows ephemeral loopback ports
automatically. Before release, publish the OAuth consent screen at
**Google Auth Platform → Audience → Publish app**. It is intentionally left in *Testing* until the
desktop app is feature-complete; in Testing, refresh tokens expire after 7 days and access is
limited to added test users.

### npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | electron-vite development server + app |
| `npm run typecheck` | Strict TypeScript for main, preload, renderer, and tests |
| `npm test` | Vitest suites for payloads, QR URIs, contrast, and layout math |
| `npm run build` | Typecheck + production bundles |
| `npm run dist:win` | NSIS installer + portable ZIP |
| `npm run dist:mac` | DMG (needs macOS + signing identity for distribution) |
| `npm run dist:linux` | AppImage |
| `npm run icon` | Regenerate the brand PNG/ICO/tray assets |

---

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl+1` … `Ctrl+9` | Activate workspace 1–9 |
| `Alt+click` workspace | Open that workspace in the split pane |
| `Ctrl+\` / `F11` | Toggle Zen mode |
| `Ctrl+K` | Command palette |
| `Ctrl+,` | Settings |
| `Ctrl+Shift+P` | Phone Companion |
| `Ctrl+Shift+O/T/A/G/H/V/S` | Workspace fast actions |
| `Ctrl+T` / `Ctrl+W` | New / close Pulse Browser tab |
| `Ctrl+F` / `Ctrl+L` | Find in page / focus address bar |
| `Ctrl+R` / `F5` | Reload active workspace |
| `Alt+←` / `Alt+→` | Back / forward |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `Ctrl+Shift+I` | DevTools for the active workspace |
| `Ctrl+Shift+W` | Close split view |

---

## Phone Companion

Open **Cloud Sync & Phone Companion** (`Ctrl+9`) → **Phone Companion**, enable the bridge, and
scan the QR code with the Android app.

- Reads `http://<ip>:<port>` where `<ip>` is a private LAN or Tailscale IPv4 address and the default
  port is `3847`.
- Deep link: `antigravity://pair?url=http://<ip>:<port>&token=<token>&name=<encoded-hostname>`
- Browser fallback: `http://<ip>:<port>/#token=<token>`
- The token is 256 bits of cryptographically random hex, stored only in the OS secret vault.
  **Regenerate** immediately if a phone is lost; connected devices are dropped.

HTTP API (all authenticated with `Authorization: Bearer <token>` unless noted):

| Route | Purpose |
| --- | --- |
| `GET /` | Pairing / status landing page |
| `GET /api/health` | Unauthenticated health probe |
| `GET /api/status` | Active workspace, memory, devices |
| `GET /api/workspaces` | Nine workspaces with credential-stripped URLs |
| `POST /api/activate` | `{ "id": "t3" }` — activate a workspace |
| `POST /api/share` | `{ "title": "", "text": "" }` — send to desktop clipboard/toast |
| `WS /ws?token=…` | Real-time status, ping, activate, share |

Windows Firewall may prompt the first time; allow **private networks** only.

---

## Firestore schema

`users/{uid}/serverProfiles/{profileId}`

```
userId, name, endpointUrl, connectionMode, authToken ("")
keepAlivePinned, lastLatencyMs, createdAt, updatedAt
```

`users/{uid}/copilotPrompts/{promptId}`

```
userId, title, promptText, rolePersona, preferredModel, createdAt, updatedAt
```

Updates never resend `userId` or `createdAt`. Endpoint URLs are canonicalized to safe `http(s)`
paths with no query, fragment, userinfo, or metadata addresses, matching the Android
`firestore.rules`. Profile IDs match `^[a-zA-Z0-9_-]{1,128}$`.

---

## Releases

Installers are published from `gh release create v1.0.1` with:

- `Antigravity-Pulse-Desktop-v1.0.1-Setup.exe` — NSIS installer
- `Antigravity-Pulse-Desktop-v1.0.1-Portable.zip` — portable build
- `SHA256SUMS.txt` — checksum manifest

v1.0.1 is an independent **unsigned** build. Windows SmartScreen may show *"Windows protected your
PC"* on first run — click **More info → Run anyway**, and verify the download against
`SHA256SUMS.txt` first:

```powershell
Get-FileHash .\Antigravity-Pulse-Desktop-v1.0.1-Setup.exe -Algorithm SHA256
Get-FileHash .\Antigravity-Pulse-Desktop-v1.0.1-Portable.zip -Algorithm SHA256
```

To produce a signed follow-up build, see [docs/CODE_SIGNING.md](docs/CODE_SIGNING.md) for Azure
Trusted Signing and local PFX setup, plus `scripts/dist-signed.ps1` and
`scripts/verify-signatures.ps1`.

`.github/workflows/release-desktop.yml` reproduces the same flow when GitHub Actions billing is
available. Until then, releases are produced and uploaded manually with the GitHub CLI.

```powershell
npm run dist:win
# verify artifacts, then (with maintainer approval):
gh release create v1.0.1 dist/Antigravity-Pulse-Desktop-v1.0.1-* dist/SHA256SUMS.txt `
  --title "Antigravity Pulse Desktop v1.0.1" --notes-file RELEASE_NOTES.md
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Google sign-in is not configured" | Fill both `MAIN_VITE_GOOGLE_CLIENT_*` values in `.env`, then rebuild. |
| OAuth error `403: access_blocked` | Publish the consent screen, or add the account as a test user. |
| Workspace shows a crash banner | Only that renderer stopped. Click **Reload workspace**; the others are untouched. |
| Bridge QR is empty | Port conflict — set another port (1024–65535) or stop the conflicting app. |
| Phone cannot find the bridge | Use the same Wi-Fi or Tailscale, allow Node/Electron on private networks, and verify the LAN address. |
| Firestore `permission-denied` | Confirm you are signed in as a listed test user and the named database rules are deployed. |
| App lives in the tray after closing | Expected with **Close to tray**. Use the tray menu → Quit, or disable it in Settings. |

---

Built with care by **Solomon Ogar Bukie**. The desktop app and Android companion share one Firebase
project and one design language: obsidian surfaces, warm-peach `#FFC799` accents, and calm,
purposeful motion.
