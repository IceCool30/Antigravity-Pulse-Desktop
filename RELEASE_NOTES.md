# Antigravity Pulse Desktop v1.0.4

The newest desktop release — an all-in-one OLED developer workspace hub with shared Firebase cloud
sync and a QR-paired Android phone companion. This release resolves Google's *"This browser or app
may not be secure"* block across embedded workspaces, Pulse Browser, and OAuth popups so embedded
Google and third-party sign-ins complete cleanly.

**Companion app:** [Antigravity Pulse for Android](https://github.com/IceCool30/Antigravity-Pulse-) —
both apps share one Firebase project and one design language.

## What's new in 1.0.4

- **Signed-in sessions stay signed in.** If "Isolate session" was enabled, each web workspace was
  moved into a brand-new empty browser partition on the next launch, so Google, GitHub, T3 Code,
  Vercel and Supabase all appeared logged out even though the logins were still present in the
  shared session. This release migrates those settings back to the shared session on first launch.
  No manual settings changes are needed. If you want a separate session for a workspace, turn on
  **Settings → Workspaces → Isolate session** again — it now warns that the workspace starts fresh.
- **Stale sign-in URLs no longer become your resume page.** Google sign-in/consent pages and Clerk
  OAuth callback URLs are no longer saved as a workspace's last URL, and any already stored ones are
  discarded on load. Reopening T3 Code or AI Studio now opens the actual app instead of a Google
  sign-in screen with expired one-time state.

## What's new in 1.0.3

- **Embedded Google & OAuth sign-in fix across every view.**
  - Disables Blink's `AutomationControlled` marker and aligns Electron sessions, request headers
    (`User-Agent`, `Sec-CH-UA*`), and a sandboxed `browser-compat` preload (`navigator.userAgentData`,
    cleaned `navigator.webdriver`) with standard desktop Chrome identity matching the bundled Chromium
    version.
  - Strips `X-Requested-With` headers and normalizes Google identity requests in
    `onBeforeSendHeaders`.
  - Hardens nested OAuth popups (`bindAuthPopupWindow`) so secondary auth windows inherit the same
    sandboxed `browser-compat` preload and Chrome identity, and expands allowed auth popup hosts and
    provider domains (`login.live.com`, `.google.com`, `.googleapis.com`, `.googleusercontent.com`,
    `.supabase.com`, `.vercel.com`, `.github.com`, `.t3.codes`, `.clerk.accounts.dev`,
    `.firebaseapp.com`, `.web.app`, `.auth0.com`, `.workos.com`).

## Highlights

- **9 RAM-pinned Chromium workspaces.** Antigravity Remote, T3 Code Web, Google AI Studio, Gemini,
  GitHub, Vercel, Supabase, Pulse Browser, and Cloud Sync & Phone Companion. Each is a real
  `WebContentsView` mounted once and kept warm — sessions, sign-ins, drafts, and scroll positions
  survive every switch. Live per-workspace RAM readouts and one-click unload to reclaim memory.
- **In-app auto-update.** Check GitHub Releases, download the verified installer with progress, and
  install/restart in one click from **Settings → System**.
- **Split View & Zen mode.** Side-by-side workspace panes (`Alt+click` a rail item), Command Palette
  (`Ctrl+K`), Zen mode (`Ctrl+\` / `F11`) with an exit strip, back/forward arrows, and Crash isolation.
- **12 OLED / Light themes.** WCAG AA+ contrast-clamped accents across dark (`#000000` / `#FFC799`)
  and adaptive light modes.
- **Shared Firebase Cloud Sync & QR Phone Companion Bridge.** Paired real-time Firestore sync and local
  HTTP + WebSocket bridge with Android v1.2.1+.

## Install

| File | What it is |
| --- | --- |
| `Antigravity-Pulse-Desktop-v1.0.4-Setup.exe` | NSIS installer (per-user, Start Menu + desktop shortcut) |
| `Antigravity-Pulse-Desktop-v1.0.4-Portable.zip` | Portable build — extract and run, no install |
| `latest.yml` | Electron auto-updater release metadata |
| `SHA256SUMS.txt` | SHA-256 manifest for the release files above |

macOS and Linux packaging is configured; build from source with `npm run dist:mac` /
`npm run dist:linux`.

### Windows SmartScreen first-run note

v1.0.4 is an **independent, unsigned build** — it is not code-signed with a commercial certificate
yet. On first launch Windows SmartScreen may show **"Windows protected your PC"**. This is expected
for a new, unsigned publisher:

1. Click **More info**.
2. Click **Run anyway**.

To be certain the file you downloaded is the one that was published, verify it against
`SHA256SUMS.txt` before running:

```powershell
Get-FileHash .\Antigravity-Pulse-Desktop-v1.0.4-Setup.exe -Algorithm SHA256
Get-FileHash .\Antigravity-Pulse-Desktop-v1.0.4-Portable.zip -Algorithm SHA256
```

Compare each result with the matching line in `SHA256SUMS.txt`. If they differ, do not run the file.

## Phone Companion pairing

Open **Cloud Sync & Phone Companion** (`Ctrl+9`) → **Phone Companion**, start the bridge, and scan
the QR code with Antigravity Pulse for Android v1.2.1+.

- Deep link: `antigravity://pair?url=http://<ip>:<port>&token=<token>&name=<encoded-hostname>`
- Browser fallback: `http://<ip>:<port>/#token=<token>`
- Default port `3847`; allow Node/Electron on **private networks** if Windows Firewall prompts.

## Privacy and security

- The bridge is off by default and requires the bearer token on every API call.
- Firestore profile documents always store `authToken: ""`; real tokens live only in the OS secret
  store (Windows DPAPI via Electron `safeStorage`).
- Cloud Sync Google authentication opens your **system browser** with PKCE and a loopback callback.
- T3 handshake tokens (`#token=…`) stay in memory and are stripped before anything is persisted.
- `contextIsolation`, `sandbox`, and `nodeIntegration: false` everywhere; the renderer only talks to
  a typed preload bridge.

---

Developer **Solomon Bukie** · [@IceCool30](https://github.com/IceCool30) ·
[Antigravity Pulse for Android](https://github.com/IceCool30/Antigravity-Pulse-)
