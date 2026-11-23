# Antigravity Pulse Desktop v1.0.1

A security-maintenance update to v1.0.0 — an all-in-one OLED developer workspace hub with shared
Firebase cloud sync and a QR-paired Android phone companion. All features are unchanged; dependency
advisories reported by GitHub are patched and `npm audit` is clean.

**Companion app:** [Antigravity Pulse for Android v1.2.1](https://github.com/IceCool30/Antigravity-Pulse-) —
both apps share one Firebase project and one design language.

## Highlights

- **9 RAM-pinned Chromium workspaces.** Antigravity Remote, T3 Code Web, Google AI Studio, Gemini,
  GitHub, Vercel, Supabase, Pulse Browser, and Cloud Sync & Phone Companion. Each is a real
  `WebContentsView` mounted once and kept warm — sessions, sign-ins, drafts, and scroll positions
  survive every switch. Live per-workspace RAM readouts and one-click unload to reclaim memory.
- **Split View.** Two web workspaces side by side with a draggable divider, independent bounds, and
  automatic collapse when the window gets too narrow. `Alt+click` a rail item to split.
- **Command Palette (`Ctrl+K`).** Fuzzy-jump to any workspace, fast action, or recent URL without
  leaving the keyboard.
- **Zen mode.** `Ctrl+\` or `F11` drops the titlebar and rail so the workspace owns the whole window.
- **12 OLED / Light themes.** Default Dark `#000000` / `#FFC799`, Legacy Dark, Catppuccin, Dracula,
  Everforest, Gruvbox Material, Monokai, Nord, One Dark Pro, Tokyo Night, Solarized Dark, and Vesper —
  plus adaptive light mode (`#EFF3F8` / `#FFFFFF` / `#0F172A`). Every accent is contrast-clamped to
  WCAG AA+ at ≥ 4.8:1.
- **System Tray Keep-Alive.** Closing the window keeps Pulse running in the tray with a live
  workspace tooltip and pinned count. The tray menu switches workspaces, toggles the bridge, and
  quits cleanly.
- **Shared Firebase Cloud Sync with Android v1.2.1.** Google sign-in plus real-time Firestore CRUD
  for server profiles and copilot prompts, using the exact schema and the same named database as the
  Android app.
- **QR Phone Companion Bridge.** Opt-in local HTTP + WebSocket bridge with a 256-bit bearer token,
  LAN / Tailscale discovery, and a QR code the Android app scans directly.
- **Pulse Browser.** A focused multi-tab browser sharing the same persistent sign-in session, with
  tab strip, address bar, and in-page find.
- **Crash isolation.** If one workspace renderer stops, only that workspace shows a recovery banner.
  Reload it in one click — the other eight keep running.

## Security fixes in 1.0.1

- `@grpc/grpc-js` pinned to `1.14.5` — fixes the high-severity `getAuthContext` authorization bypass
  and a low-severity error-message disclosure in the Firebase toolchain.
- `minimatch` pinned to `11.0.1` in the packaging toolchain — fixes a moderate denial-of-service
  issue with crafted glob patterns.
- `npm audit` now reports **0 vulnerabilities**.

## Install

| File | What it is |
| --- | --- |
| `Antigravity-Pulse-Desktop-v1.0.1-Setup.exe` | NSIS installer (per-user, Start Menu + desktop shortcut) |
| `Antigravity-Pulse-Desktop-v1.0.1-Portable.zip` | Portable build — extract and run, no install |
| `SHA256SUMS.txt` | SHA-256 manifest for both files above |

macOS and Linux packaging is configured; build from source with `npm run dist:mac` /
`npm run dist:linux`.

### Windows SmartScreen first-run note

v1.0.1 is an **independent, unsigned build** — it is not code-signed with a commercial certificate
yet. On first launch Windows SmartScreen may show **"Windows protected your PC"**. This is expected
for a new, unsigned publisher:

1. Click **More info**.
2. Click **Run anyway**.

To be certain the file you downloaded is the one that was published, verify it against
`SHA256SUMS.txt` before running:

```powershell
Get-FileHash .\Antigravity-Pulse-Desktop-v1.0.1-Setup.exe -Algorithm SHA256
Get-FileHash .\Antigravity-Pulse-Desktop-v1.0.1-Portable.zip -Algorithm SHA256
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
- Google authentication opens your **system browser** with PKCE and a loopback callback. The app
  never embeds the OAuth consent screen.
- T3 handshake tokens (`#token=…`) stay in memory and are stripped before anything is persisted.
- `contextIsolation`, `sandbox`, and `nodeIntegration: false` everywhere; the renderer only talks to
  a typed preload bridge.

## Known limitations

- The Google OAuth consent screen may still be in **Testing**. Publish it at
  **Google Auth Platform → Audience → Publish app** to allow accounts outside the test list.
- GitHub Actions release automation needs an active billing account; v1.0.1 artifacts were produced
  and uploaded manually with the GitHub CLI.
- The update checker reads GitHub Releases; it does not install updates automatically.
- The Google Desktop OAuth client secret is compiled into the installed app because Google's token
  endpoint requires it even with PKCE. Google treats installed-app client secrets as
  non-confidential; `.env` is never committed.

---

Developer **Solomon Bukie** · [@IceCool30](https://github.com/IceCool30) ·
[Antigravity Pulse for Android](https://github.com/IceCool30/Antigravity-Pulse-)
