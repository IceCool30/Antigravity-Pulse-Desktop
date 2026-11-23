# Antigravity Pulse Desktop — Agent Integration Contract

This document is the single source of truth for parallel implementation. Read it fully before
writing code. Two agents work in the **same checkout** with **disjoint file ownership**.

## 1. Product

Antigravity Pulse Desktop v1.0.0 — a Windows-first Electron cockpit that keeps nine workspaces
(Antigravity Remote, T3 Code Web, Google AI Studio, Gemini, GitHub, Vercel, Supabase, Pulse
Browser, Cloud Sync & Phone Companion) warm and pinned, plus Google sign-in, Firestore parity
with the Android app, and a local phone bridge.

Stack, already installed — **do not add dependencies**:

- Electron 45.4.1, electron-vite 6, Vite 7, React 19, TypeScript 5.9 (strict, `noUncheckedIndexedAccess`)
- Tailwind CSS 4 (`@tailwindcss/vite`), Zustand 5, lucide-react 1.78, Firebase 13.4
- `qrcode` + `ws` (main-process runtime deps), Vitest 4
- Electron binary is installed at `node_modules/electron/dist/electron.exe`

## 2. Commands and constraints

- Node/npm only, Windows PowerShell. Do **not** run `npm install`.
- Do **not** run `npm run dev`, `npm run build`, or `electron-builder` — they block or conflict.
  Verify with typecheck only:
  - renderer: `npm run typecheck:web`
  - main: `npm run typecheck:node`
- Do **not** run any `git` command. Do **not** commit, branch, stash, or reset.
- Do **not** edit `package.json`, `package-lock.json`, `tsconfig*.json`, `electron.vite.config.ts`,
  `electron-builder.yml`, `vitest.config.ts`, `.env*`, `src/shared/**`, `src/preload/**`, or any
  existing `src/main/*.ts` that is not in your ownership list.
- If you believe a shared type, config, or existing main module must change, **stop and report it**
  in your final message instead of editing it.
- No `any`, no non-null assertions to silence errors, no `@ts-ignore`, no `eslint-disable`.
  Prefer `unknown` + guards. Keep files focused and readable.
- Never log, display, or persist secrets (OAuth client secret, bearer token, session cookies,
  T3 `#token=` handshakes). Never echo `.env` contents.
- Everything is local-first. No remote fonts, no CDN scripts, no `<webview>`, no `BrowserView`.

## 3. Ownership

| Path | Owner |
| --- | --- |
| `src/renderer/index.html`, `src/renderer/src/**` | Renderer agent |
| `src/main/bridge.ts` | Main agent |
| `src/main/shortcuts.ts` | Main agent |
| `src/main/ipc-router.ts` | Main agent |
| `src/main/index.ts` | Main agent |
| `src/main/notifications.ts` (optional) | Main agent |
| everything else (tests, icons, docs, packaging) | Orchestrator |

`src/main/**` files that already exist and must be treated as read-only:
`events.ts`, `google-auth.ts`, `popups.ts`, `pulse-browser.ts`, `sessions.ts`, `settings-store.ts`,
`tray.ts`, `update-checker.ts`, `workspace-host.ts`, `env.d.ts`.

## 4. Shared contracts (read these files, do not edit)

- `src/shared/ipc.ts` — every IPC channel, payload, event, `BootstrapInfo`, `PreloadApi`
  (`window.pulse.invoke(channel, payload)` and `window.pulse.onEvent(listener)`).
- `src/shared/settings.ts` — `Settings`, `DEFAULT_SETTINGS`, `sanitizeSettings`, `applySettingsPatch`,
  `resolveWorkspaceFont`, `displayAccent`.
- `src/shared/workspaces.ts` — `WORKSPACES` (9), `WorkspaceId`, `WORKSPACE_ACTIONS`, `DEVELOPER`.
- `src/shared/layout.ts` — `TITLEBAR_HEIGHT = 36`, `RAIL_COLLAPSED_WIDTH = 56`,
  `RAIL_EXPANDED_WIDTH = 220`, `BROWSER_CHROME_HEIGHT = 72`, `SPLIT_GAP = 8`, `MIN_PANE_WIDTH = 360`,
  `computeWorkspaceLayout`, `clampSplitRatio`.
- `src/shared/theme.ts` — 12 presets, `resolveTheme`, `ensureReadableAccent`, light surfaces.
- `src/shared/validation.ts` — URL/ID/QR/payload validators and `stripUrlSecrets`.
- `src/main/workspace-host.ts`, `pulse-browser.ts`, `settings-store.ts`, `tray.ts`,
  `google-auth.ts`, `update-checker.ts`, `sessions.ts` — existing main behavior. Read them before
  wiring IPC or renderer state.

### 4.1 Geometry invariant

The main process positions native `WebContentsView`s at absolute window coordinates:

```
x = railWidth            (0 in zen)
y = 36 + (browser ? 72 : 0)
width = windowWidth - x
height = windowHeight - y
```

The renderer must reproduce exactly the same chrome:

- Titlebar `36px` full width (`display:none` in zen).
- Rail `56px` collapsed / `220px` expanded (`0`/hidden in zen). Width **snaps**, labels may animate.
- Browser chrome `72px` only when `runtime.activeId === 'browser'`:
  - row 1 tabs `40px`, row 2 address bar `32px`, 1px accent hairline.
- Stage starts directly below that. Never add extra outer padding/margins around the stage.

The renderer is the source of truth for `railWidth`, `zen`, `splitRatio` and must send
`layout:update` whenever they change (including once after bootstrap). It must send
`overlay:setVisible({visible:true})` while **any** modal/palette/settings/phone drawer is open, and
`false` when the last one closes. Native views are hidden while overlays are visible.

For divider/crash-card/fallback positioning, import `computeWorkspaceLayout` from `@shared/layout`
and use the returned `primary` / `secondary` / `divider` rects (do not hand-roll the math).

### 4.2 Security invariants

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — renderer uses only
  `window.pulse`, never `require`, `process`, `fs`, or Node.
- Every persisted/displayed URL goes through `stripUrlSecrets`. T3 links containing `#token=` may
  live only in memory and in the `workspace:openT3Pairing` payload.
- Firestore documents always carry `authToken: ""`. Profile tokens are stored only in the OS vault
  through `vault:*` IPC.
- Google OAuth happens in the system browser via main (`auth:google`); the renderer only receives
  `GoogleTokens.idToken` and calls `signInWithCredential`.

## 5. Renderer specification (Renderer agent)

Root: `src/renderer/index.html`; code root `src/renderer/src`.

### 5.1 Files (minimum)

```
src/renderer/index.html
src/renderer/src/main.tsx
src/renderer/src/App.tsx
src/renderer/src/styles.css
src/renderer/src/env.d.ts
src/renderer/src/lib/api.ts
src/renderer/src/lib/format.ts
src/renderer/src/lib/theme.ts
src/renderer/src/lib/firebase.ts
src/renderer/src/lib/cloud.ts
src/renderer/src/store/shell.ts
src/renderer/src/components/BrandIcons.tsx
src/renderer/src/components/TitleBar.tsx
src/renderer/src/components/Rail.tsx
src/renderer/src/components/Stage.tsx
src/renderer/src/components/BrowserChrome.tsx
src/renderer/src/components/SplitDivider.tsx
src/renderer/src/components/CrashCard.tsx
src/renderer/src/components/ToastStack.tsx
src/renderer/src/components/Home.tsx
src/renderer/src/components/CommandPalette.tsx
src/renderer/src/components/SettingsPanel.tsx
src/renderer/src/components/PhoneDrawer.tsx
src/renderer/src/components/FindBar.tsx
src/renderer/src/components/WelcomeCard.tsx
src/renderer/src/components/cloud/CloudSync.tsx
src/renderer/src/components/cloud/ProfilesTab.tsx
src/renderer/src/components/cloud/PromptsTab.tsx
src/renderer/src/components/cloud/BridgeTab.tsx
src/renderer/src/components/ui/*.tsx        (Button, Field, Select, Toggle, Modal, Badge, …)
```

You may add files, but keep these entry points and names stable.

### 5.2 Bootstrap and event flow

1. `main.tsx`: import fontsource variable fonts (Inter, Space Grotesk, JetBrains Mono, Fira Code,
   Roboto Mono), mount React, render `<App/>`. Google Sans is proprietary: keep it in the family
   list but fall back to Inter (no download).
2. `App.tsx`: single `useEffect` — `window.pulse.invoke('app:bootstrap', undefined)`, seed the
   Zustand store, subscribe to `window.pulse.onEvent`.
3. After bootstrap, send `layout:update` once with `{ railWidth: expanded ? 220 : 56, zen, splitRatio }`.
4. Apply theme: `resolveTheme({ presetName, themeMode, contrastMode, systemPrefersDark, accentOverride })`
   → write CSS custom properties on `document.documentElement`; set `color-scheme` and
   `data-theme="light|dark"`; set font family/size; honor `smoothAnimations` (add `data-reduced-motion`).
5. Handle `PulseEvent`:
   - `runtime` → store; if split collapsed, reset local ratio only when `runtime.split === false`.
   - `settings` → replace store settings.
   - `browser`, `bridge`, `update`, `find` → store.
   - `toast` → push toast (max 4, auto-dismiss 5s).
   - `window` → maximized/focused.
   - `shell` → open palette / settings / phone / t3 pairing / find / address / shortcuts; `zen`
     toggles local zen + `layout:update`; `new-tab` invokes `browser:newTab` then activates browser;
     `cloud` activates cloud; `workspaces` toggles rail expansion.

Use `matchMedia('(prefers-color-scheme: dark)')` with a change listener for `SYSTEM` mode.

### 5.3 Visual language

- OLED dark: `#000000` background, `#FFC799` primary accent, white text, 1px translucent borders,
  layered "beveled glass" surfaces: top inset highlight, soft bottom shadow, 12–16px radii,
  occasional 1px inner ring. No neon gradients, no purple AI slop, no emoji icons.
- Light mode: `#EFF3F8` background, `#FFFFFF` surfaces, `#0F172A` text, accent contrast-clamped by
  `resolveTheme`.
- Typography: Space Grotesk for display/titles, Inter for UI body, JetBrains Mono for URLs, IDs,
  memory numbers, shortcuts. Scale: 11/12/13/14/16/20/28/40. Line-height 1.5 body, 1.15 display.
- Density: 32px controls, 36px titlebar, 8px grid. 4/8/12/16/24 spacing only.
- Motion: 140–220ms `cubic-bezier(.22,1,.36,1)`, translate ≤ 6px, opacity. Disable under
  `prefers-reduced-motion` and `settings.smoothAnimations === false`.
- Focus: `:focus-visible` 2px accent ring, 2px offset. Every icon-only button has `aria-label` and
  a title. Keyboard-complete: palette, modals, tabs, forms.
- Scrollbars: 8px, translucent thumb.
- Empty states are designed, not blank. Loading uses skeleton bars or an orbit spinner, never text
  "Loading…".
- No images besides inline SVG, the QR data URL, and the Google avatar. Icons: lucide-react, except
  brand marks (GitHub, Vercel, Gemini, Supabase, AI Studio, Antigravity orbit) which are inline SVGs
  in `BrandIcons.tsx` — lucide 1.78 no longer ships `Github`.

### 5.4 Titlebar (36px)

Left: orbit brand mark, "Antigravity Pulse" (Space Grotesk 12.5px, 0.02em), then a divider and the
active workspace name + cleaned host (muted, truncating). Draggable region; all controls `no-drag`.

Right, in order: live memory chip (`formatBytes(runtime.appMemoryBytes)` + tiny bar), split toggle
(`Columns2`, disabled unless eligible: active is a non-native web workspace and window is wide
enough; tooltip explains), zen toggle (`Maximize2`/`Minimize2`), palette chip showing `Ctrl K`,
phone (`MonitorSmartphone`, dot when bridge running), settings (`Settings2`), then window controls:
minimize / maximize-restore / close, each 46×36. Close hover `#E81123` white icon. Double-click on
the drag region toggles maximize. Use `app:window`.

Eligibility for split: `runtime.activeId` is a web workspace other than `browser`; offer "Open in
split" on rail Alt+click and in the titlebar split menu (`workspace:activate { id, secondary:true }`).
When `runtime.split`, show the secondary workspace name beside the primary with a small `×`
(`workspace:clearSplit`).

### 5.5 Rail (56 / 220)

Top: expand/collapse chevron + "Workspaces" label when expanded. Nine items in `WORKSPACES` order:

- 40px hit target, 36px icon tile, active = accent-soft tile + 3×18px accent indicator on the left
  edge, hover = `--surface-hover`, pressed scale 0.98.
- Pinned dot (4px accent) when `state.mounted`; loading shimmer when `state.loading`; red dot when
  `state.crashed || state.error`.
- Tooltip (collapsed) with name, shortcut, `formatBytes(state.memoryBytes)`, and pin status.
- Click = `workspace:activate`; Alt+click = secondary split; when mounted and not active, a small
  eject button (expanded rail, hover) = `workspace:unload` after `confirm()`.
- Bottom: RAM card — app memory, pinned count, a thin meter of app memory against 2 GB, "Pinned N".
  Then phone button (bridge status dot), settings button, and a tiny "v1.0.0" mono label.

`Ctrl+1..9` are handled by main; the rail only reflects state.

### 5.6 Stage and native holes

`Stage` renders only chrome, never a webview:

- If `activeId === null` → `<Home/>` fills the stage.
- If `activeId === 'cloud'` → `<CloudSync/>` fills the stage.
- If `activeId` is a web workspace → render a `StageFallback` layer (subtle radial accent glow,
  workspace icon watermark, cleaned URL, "warm" pill). Native views cover it when healthy; it is
  what the user sees when the view is hidden by an overlay, crash, or error.
- When any overlay is open → `StageVeil` above the fallback (gradient + focused workspace chip +
  "Workspace paused behind overlay" microcopy), so the hidden native view never leaves a black hole.
- crash/error card per pane: use computed `primary`/`secondary` rects. Title `${workspace.name}
  stopped`, reason, buttons: **Reload workspace** (`workspace:reload`), **Open URL in Pulse Browser**
  (`browser:newTab`), **Copy URL** (`app:copy`). Include "Other workspaces are unaffected."
- Split divider: 8px invisible hit area at `divider.x`, visible 2px line, accent on hover/drag,
  `col-resize`, `role="separator"`, `aria-orientation="vertical"`, arrow-key resize ±0.02,
  double-click reset 0.5. On drag use rAF-throttled `layout:update`; on release persist
  `settings:update { splitRatio }`.

### 5.7 Browser chrome (72px)

Row 1 (40px): tab strip (max 20). Tab: 150–220px, favicon fallback = `Compass`, title, loading
spinner, close on hover/middle-click. `+` new tab. Right side: tab overflow count, "Pulse Browser"
label, session-isolated badge when the browser is isolated.

Row 2 (32px): back, forward, reload/stop (spinner when loading), address input (mono, select-all on
focus, Enter = `browser:navigate`, Esc = restore), shield/lock chip showing `https`, find button,
"open in system browser" (`app:openExternal`), overflow menu with zoom reset, devtools, clear tabs.

FindBar: floats at the right of the chrome row, 280px, input + match count `3/12` + prev/next/close,
calls `browser:find` / `browser:findStop`, listens for `find` events, `Ctrl+F` focus via shell event,
Esc closes. The find bar lives inside the 72px chrome area so it never covers the native page.

### 5.8 Home

Full-stage, scrollable, max-width 1180 centered:

- Greeting by local hour + host name + date; right: "All systems warm" status and memory chip.
- Resume strip: up to 3 `settings.lastUrls` entries with cleaned host and "Resume" action.
- Launchpad: 9 cards (3×3 on wide, 2×3, 1 column). Each: brand icon tile, name, description,
  shortcut kbd, mounted/loading/crashed pill, memory, "Open" affordance. Alt+click = split.
  Cloud card shows bridge running state.
- T3 pairing card: paste a T3 link → `workspace:openT3Pairing`; inline validation; microcopy
  "Handshake tokens stay in memory and are stripped before anything is saved."
- Keyboard strip: `Ctrl K` palette, `Ctrl 1–9` workspaces, `Ctrl \` zen, `Alt+click` split.
- Footer: "Developer Solomon Bukie" + GitHub link (`app:openExternal`) + `v1.0.0` + Electron
  version.

### 5.9 Command palette

Centered 620px glass panel, top 14vh, backdrop blur + 32% black scrim, `role="dialog"
aria-modal="true"`. Search input 16px. Groups: Workspaces (9), Actions (Home, Settings, Phone
Companion, Cloud Sync, New browser tab, Toggle zen, Reload workspace, Check for updates, Keyboard
shortcuts, Reset split), plus up to 3 resume URLs. Fuzzy scoring on label + keywords; selected row
accent-soft with 2px left indicator; arrow keys/Home/End, Enter, Esc, click. Footer: `↑↓ navigate`,
`↵ open`, `esc close`. Empty query shows recents-worthy actions. Opening sets overlay true; closing
false.

### 5.10 Settings panel

Centered 960×680 (min 720×520) two-column: left section nav (Appearance, Workspaces, Browser,
Phone & Cloud, System, About), right scroll content. Header with close; footer note "Changes save
automatically."

- Appearance: 12 preset swatches (name + 3 color chips, selected ring), mode segmented
  (System/Light/Dark), contrast segmented (Default/Strong), accent override color input + hex text +
  reset (show the resolved accent swatch), font family select (6), font size segmented
  (12/13/14/15/16/18), smooth animations toggle, frosted glass toggle.
- Workspaces: per-workspace row — brand icon, name, shortcut; URL override input with inline
  validation via `normalizeHttpUrl` (`@shared/validation`) and "Reset"; isolate-session toggle;
  zoom value + reset (`workspace:zoom`). Cloud shows "Native surface" and no URL field.
- Browser: external link behavior segmented (System browser / Pulse Browser), open-tab count, hint
  that the persistent session is shared.
- Phone & Cloud: bridge enable toggle, port field (1024–65535) + apply (`bridge:restart`), start/stop,
  "Open Phone Companion", notifications toggle, Google connection status (signed in email or
  "Not connected") with a link to Cloud Sync.
- System: close to tray, launch minimized, notifications, update checks, "Check now" showing
  `update.state` and latest version, open data folder / downloads (`app:openPath`), quit
  (`app:quit`), reset all settings with confirm.
- About: brand mark, name, version, Electron/Chrome versions, developer name + email + GitHub,
  MIT license, "Report an issue" link, and the line "Firestore database: shared with Antigravity
  Pulse Android" (mono id).
- Shortcuts cheat sheet at the bottom of Settings (also reachable via palette/shell `shortcuts`):
  table of every accelerator from section 6.

Persist every change with a 200 ms debounce: `settings:update(patch)` (optimistic local state, the
returned/broadcast `settings` wins). Never send `version`.

### 5.11 Phone drawer

Right sheet 440px, full height below titlebar, slide-in 180ms, scrim 24%, overlay true.

- Header: "Phone Companion", bridge pill (Running / Starting / Off), close.
- Primary toggle start/stop; port input + "Apply & restart".
- QR card: 220px QR on white padding, deep-link caption; if not running, dashed placeholder with
  "Start the bridge to generate a QR".
- "Scan with Antigravity Pulse on Android" + 3 numbered steps (same Wi-Fi or Tailscale; scan;
  approve the token).
- Addresses list: label (LAN/Tailscale/Interface), mono IP, copy button.
- Pairing payload card: fingerprint, token preview, "Copy deep link", "Copy fallback URL",
  "Regenerate token" (confirm dialog, warns it disconnects phones). Show the full token nowhere.
- Devices list: label, address, ping, connected duration, live dot; empty state "No phones yet".
- Test notification button (`app:notify`), firewall hint, "Bridge listens only on your local
  network; every API call requires the 256-bit bearer token."

### 5.12 Cloud Sync

Full stage surface, max-width 1080, scrollable.

- Signed out: hero card — cloud icon, "Sync with Antigravity Pulse for Android", explanation of
  Google sign-in + the exact named Firestore database, "Sign in with Google" (calls `auth:google`,
  then `signInWithCredential(auth, GoogleAuthProvider.credential(tokens.idToken))`), error card
  with retry, privacy bullets (tokens stay local; `authToken` always empty; revoked by sign-out),
  and a "Not configured" state when Firebase env is missing.
- Signed in: account row (avatar 36px, name, email, sign out), Firestore connection chip
  (`live` / `cached` / `offline` from snapshot metadata), project + database id in mono, test-mode
  note.
- Tabs: Server profiles · Copilot prompts · Phone bridge.
- Profiles: toolbar search + New profile; list rows with name, endpoint (mono, truncated), mode
  badge, pinned star, latency, updated relative time; actions copy endpoint, edit, delete,
  "Device token" (opens vault dialog: set/clear token via `vault:setProfileToken` /
  `vault:deleteProfileToken`, never shown after save, shield copy "Stored in Windows DPAPI via
  Electron safeStorage. Never written to Firestore."). Create/edit modal validates with
  `validateServerProfileInput`; on create use `doc(collection(db,'users',uid,'serverProfiles'))`
  to pre-generate the id, `setDoc(..., serverProfileCreatePayload(uid, value) + {createdAt:
  serverTimestamp(), updatedAt: serverTimestamp()})`; on update `updateDoc` with
  `serverProfileUpdatePayload(value) + {updatedAt: serverTimestamp()}` (never `userId`/`createdAt`).
- Prompts: responsive 2-col cards (1-col narrow): title, persona + model badges, 4-line clamped
  body, updated time, copy body, edit, delete. Modal with title (120), prompt body (5000, counter),
  role persona (80), preferred model (80). Same create/update rules with `promptCreatePayload`,
  `promptUpdatePayload`, `serverTimestamp()`.
- Realtime: `onSnapshot` on `collection(db,'users',uid,'serverProfiles')` and `.../copilotPrompts`,
  sorted client-side by `updatedAt` desc. Unsubscribe on sign-out/unmount. Surface
  `permission-denied`, `unavailable`, `failed-precondition` with actionable copy.
- Bridge tab: status card, addresses, device count, open drawer, start/stop.
- Delete confirmations are inline modals, never `window.confirm` for cloud data.

### 5.13 Firebase module

`lib/firebase.ts`:

```ts
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID
```

- Lazily initialize so a missing `.env` renders a friendly "not configured" card instead of throwing.
- `getFirestore(app, databaseId)` — the **named** database, never `(default)`.
- `getAuth(app)`, `setPersistence(auth, browserLocalPersistence)` best-effort.
- Never import `firebase/firestore` in main; the SDK runs in the renderer.
- Declare `ImportMetaEnv` in `src/renderer/src/env.d.ts`.

### 5.14 Accessibility & quality bar

- All dialogs: focus trap, Esc close, restore focus, `aria-modal`, labelled title.
- Tooltips also have accessible names. Toggles are `role="switch"` with `aria-checked`.
- Tabs implement `role="tablist"` + arrow keys.
- No layout shift when toasts appear; no horizontal scroll at 1024×700.
- Renderer must typecheck cleanly with `noUncheckedIndexedAccess`; guard array access.

## 6. Keyboard map (main owns the menu accelerators)

| Keys | Action |
| --- | --- |
| `Ctrl+1..9` | Activate workspace 1..9 |
| `Ctrl+\` / `F11` | Toggle Zen (publish shell `zen`) |
| `Ctrl+K` | Command palette |
| `Ctrl+,` | Settings |
| `Ctrl+Shift+P` | Phone Companion |
| `Ctrl+Shift+O/T/A/G/H/V/S` | Workspace fast actions (`WORKSPACE_ACTIONS`) |
| `Ctrl+T` | New Pulse Browser tab |
| `Ctrl+W` | Close active browser tab (browser active only) |
| `Ctrl+F` | Find in browser page |
| `Ctrl+L` | Focus address bar |
| `Ctrl+R` / `F5` | Reload active workspace |
| `Alt+Left` / `Alt+Right` | Back / forward |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `Ctrl+Shift+I` | DevTools for active workspace |
| `Ctrl+Shift+W` | Close split (if any) |

## 7. Main-process specification (Main agent)

Implement exactly these four files (plus optional `notifications.ts`).

### 7.1 `src/main/bridge.ts`

`export interface PhoneBridgeOptions` and `export class PhoneBridge`:

- `status(): BridgeStatus`
- `start(port?: number): Promise<BridgeStatus>`
- `stop(): Promise<BridgeStatus>`
- `restart(port?: number): Promise<BridgeStatus>`
- `regenerateToken(): Promise<BridgeStatus>`
- `shareActive(): Promise<void>`
- `broadcast(payload: unknown): void`
- `destroy(): void`

Behavior:

- Node `http` server bound `0.0.0.0` on `settings.bridgePort` (default 3847). `ws` `WebSocketServer`
  with `noServer: true`, upgrade only on `/ws`, `maxPayload` 16 KiB.
- Token comes from `SettingsStore.ensureBridgeToken()` (64 hex chars = 256 bits). Compare with
  `crypto.timingSafeEqual`; accept `Authorization: Bearer <token>` or `?token=` for WS/landing.
  Never log tokens. Rate-limit failed auth (20/min/IP → 429).
- Address discovery via `os.networkInterfaces()`: IPv4, non-internal; classify `100.64.0.0/10` or
  interface name containing `tailscale` → `Tailscale`, RFC1918 → `LAN`, else `Interface`; dedupe;
  order LAN, Tailscale, Interface. QR uses the first address; expose all in `addresses`.
- Pairing URIs and QR: use `buildPairingUris` from `@shared/validation`; `qrcode.toDataURL(deepLink,
  { errorCorrectionLevel: 'M', margin: 1, width: 512, color: { dark: '#000000', light: '#FFFFFF' } })`.
  `tokenPreview` = `••••••••` + last 4; `fingerprint` = uppercase hex of the first 4 SHA-256 bytes
  grouped `XXXX-XXXX`.
- `BridgeStatus.error`: `null` when healthy; friendly messages for `EADDRINUSE`
  ("Port 3847 is already in use. Choose another port."), permission errors, and unexpected failures.
- HTTP routes (all JSON, `no-store`, `nosniff`, `Referrer-Policy: no-referrer`, 16 KiB body cap,
  method checks):
  - `GET /` — OLED-styled landing page, escaped strings, CSP header, reads `#token=` client-side
    into `sessionStorage` and renders a small dashboard (host, version, active workspace, nine
    workspace buttons, bridge status, device count). Works without a token as an instructions page.
  - `GET /api/health` — no auth: `{ ok: true, app, version, host }`.
  - `GET /api/status` — auth: host, version, startedAt, active workspace + title + cleaned url,
    nine workspaces with mounted/loading/crashed/memory, bridge devices, app memory.
  - `GET /api/workspaces` — auth: nine `{ id, name, shortName, shortcut, url (stripped), kind }`.
  - `POST /api/activate` — auth, `{ id }`: validate `isWorkspaceId`, activate via the callback,
    return the status payload.
  - `POST /api/share` — auth, `{ title?, text }`: clipboard write + toast, return `{ ok: true }`.
  - 401 JSON `{ error: 'unauthorized' }` + `WWW-Authenticate: Bearer`; 404 JSON.
- WS protocol: `{ type: 'hello', host, version, workspaces, status }` on connect; accept
  `{ type:'ping', t }` → `{ type:'pong', t }` (track `pingMs`), `{ type:'activate', id }`,
  `{ type:'share', text }`; server broadcasts `{ type:'status', status }` every 3 s on change and
  `{ type:'shared', … }` after share. Heartbeat every 15 s (`isAlive`/terminate). Cap 12 devices;
  `BridgeDevice.id`, `label` (from `?name=` or `Phone`), `address`, `connectedAt`, `lastSeenAt`,
  `pingMs`. Publish status via `onStatus` (throttle ≤ 4/s).
- `stop()` closes all WS clients, then the HTTP server, clears timers, resets status but keeps
  `enabled`/`port`/addresses; `destroy()` is `stop()` + permanent.
- Start is idempotent; changing port restarts. Auto-start is orchestrated by `index.ts`.

### 7.2 `src/main/shortcuts.ts`

- `export function installApplicationMenu(options: ShortcutOptions): void` — `Menu.buildFromTemplate`
  with hidden menu bar behavior (frameless window), accelerators exactly as section 6.
  `Ctrl+W` closes a browser tab only when the browser is active, otherwise no-op (never closes the
  window). `Ctrl+Shift+W` clears split. All actions call callbacks, not the host directly.
- `export function bindShortcuts(contents: WebContents, options: ShortcutOptions): void` — attach
  a `before-input-event` guard that swallows `Ctrl+W` when the page is not the browser (so a site
  cannot close the window) and lets everything else through. Keep it minimal; menu accelerators are
  authoritative.
- macOS: include the app menu (`About`, `Hide`, `Quit`) and an Edit menu with standard roles so
  copy/paste works; Windows/Linux: View/Workspace/Help menus are optional but accelerators must
  work. Hide the menu bar on the window in `index.ts`.

### 7.3 `src/main/ipc-router.ts`

`export interface RouterDeps` + `export function installIpcRouter(deps: RouterDeps): void`.

- `ipcMain.handle` for **every** channel in `COMMAND_CHANNELS`; validate payloads defensively
  (unknown input, `isWorkspaceId`, `isSafeId`, `normalizePairingUrl`, `normalizeHttpUrl`,
  `isAllowedExternalUrl`, number ranges). Throw `Error` with human messages on invalid input;
  never expose stack traces to the renderer.
- Side effects:
  - `settings:update` / `settings:reset` → persist, publish `settings`, and reconcile bridge
    auto-start/stop + port when `bridgeEnabled`/`bridgePort` changed.
  - `app:openExternal` → `isAllowedExternalUrl` then `shell.openExternal`.
  - `app:openPath` → `shell.openPath(app.getPath(target))` (`userData` | `downloads`).
  - `app:notify` → native `Notification` if supported + toast event.
  - `app:toast` → route local renderer toasts through `toast()` so main can choose the DOM stack
    (Home/Cloud/overlay open) or the native overlay window (WebContentsView covering the stage).
  - `app:quit` → set quitting flag and `app.quit()`.
  - `vault:*` → `profileSecretKey` + `isSafeId`; tokens never returned except explicit
    `vault:getProfileToken`.
  - `auth:google` / `auth:cancel` → `GoogleAuthBroker`.
  - `bridge:*` → `PhoneBridge`; `bridge:alert` → toast (+ native notification); `bridge:shareActive`
    → `bridge.shareActive()`.
  - browser/workspace/layout/overlay → `WorkspaceHost`.
- `app:bootstrap` returns every `BootstrapInfo` field, including `maximized`, host name, and
  `googleConfigured`.

### 7.4 `src/main/index.ts`

- Single-instance lock; second launch shows/focuses the window and handles deep-link argv.
- `app.setAppUserModelId('com.antigravitypulse.desktop')`, `app.setName('Antigravity Pulse')`.
- Protocol `antigravity-pulse://` (packaged `setAsDefaultProtocolClient`, dev argv); handle
  `antigravity-pulse://open?url=…` / `antigravity-pulse://pair?url=…` → `host.openT3Pairing`.
  `open-url` on macOS.
- Load `SettingsStore` before the window; host name via `os.hostname()`.
- `BrowserWindow`: 1440×920, min 1080×700, `frame: false`, `show: false`, background `#000000`,
  `roundedCorners`, `autoHideMenuBar`, `webPreferences` = preload (`join(__dirname,
  '../preload/index.js')`), `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`,
  `webviewTag: false`, `spellcheck: true`. Hide the menu bar. Show on `ready-to-show` unless
  `launchMinimized && closeToTray`.
- Load `process.env['ELECTRON_RENDERER_URL']` in dev, else `join(__dirname, '../renderer/index.html')`.
- Hardening: deny all shell-window permission requests and window.open (open external instead);
  block `will-navigate` away from the app; block `will-attach-webview`; `setWindowOpenHandler`
  deny.
- Close behavior: if `closeToTray` and not quitting → `preventDefault()`, hide, show a one-time
  "Still running in the tray" notification. Tray click/double-click shows. `before-quit` sets
  quitting, flushes settings, stops bridge, destroys host/tray.
- Wire `WorkspaceHost` callbacks: settings patch persistence (no layout recursion), runtime →
  event + tray, browser → event, crash → notification + toast, external link → system vs Pulse
  Browser per `settings.externalLinkBehavior`.
- Restore `lastWorkspaceId` / `lastSecondaryId` after `did-finish-load` (skip when
  `seenWelcome === false` — show Home and the welcome card).
- `PhoneBridge` with callbacks: activate workspace (and show/focus window), share, toast, status →
  event + tray. Auto-start when `settings.bridgeEnabled`. Tray menu toggles it.
- Tray icon: `app.isPackaged ? join(process.resourcesPath, 'tray.png') : join(__dirname,
  '../../build/tray.png')`; update tooltip/menu from runtime + bridge (existing `PulseTray`).
- Update checker: on ready when `settings.updateChecks`, then every 6 h (unref); publish `update`;
  `app:checkUpdates` manual.
- Window events `maximize`/`unmaximize`/`focus`/`blur` → publish `window` event.
- `render-process-gone` on the shell → reload the shell once; other views are handled by the host.
- `window-all-closed` → quit except macOS; `activate` → show/focus.
- Log boot phases with `[pulse]` prefix; never log secrets.

## 8. Definition of done

Renderer agent:

- `npm run typecheck:web` passes with zero errors.
- Every channel used exists in `COMMAND_CHANNELS`; no `window.pulse` misuse.
- Overlay true/false is balanced; layout:update fires on rail/zen/ratio changes and after bootstrap.
- Click-through audit: palette, settings, phone, cloud create/edit, split divider, browser tabs.
- Final report: files created, commands run, remaining risks.

Main agent:

- `npm run typecheck:node` passes with zero errors.
- All `COMMAND_CHANNELS` have handlers; no unhandled channel.
- `index.ts` boots a window, tray, bridge (when enabled), and reacts to settings changes.
- Bridge has no token logging and every API route is authenticated except `/` and `/api/health`.
- Final report: files created, commands run, remaining risks.

Both: if you must deviate from this contract, say so explicitly in the final report with the
reason and the exact integration impact.
