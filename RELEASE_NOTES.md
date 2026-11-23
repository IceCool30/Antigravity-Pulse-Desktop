# Antigravity Pulse Desktop — v1.0.0

The first stable desktop release of Antigravity Pulse.

## Highlights

- **Nine warm workspaces.** Switch instantly between Antigravity Remote, T3 Code Web, Google AI
  Studio, Gemini, GitHub, Vercel, Supabase, Pulse Browser, and Cloud Sync. Every page keeps its
  session, scroll position, and sign-in.
- **Split view and Zen mode.** Work in two web workspaces at once with a draggable divider, or
  press `Ctrl+\` to let the workspace fill the window.
- **Command palette.** Press `Ctrl+K` to jump anywhere, launch a fast action, or resume a recent
  URL.
- **Pulse Browser.** A focused multi-tab browser with the same persistent sign-in session.
- **Crash isolation.** If one workspace renderer stops, only that workspace shows a recovery
  banner. Reload it in one click without losing the others.
- **Cloud parity.** Sign in with Google and sync server profiles and copilot prompts with the
  Android app in real time. Tokens stay on this device.
- **Phone Companion.** An opt-in local bridge with a 256-bit pairing token, QR code, LAN /
  Tailscale discovery, and live device list.
- **Tray keep-alive.** Closing the window keeps Pulse running in the tray with a live workspace
  tooltip. Quit from the tray menu when you are done.
- **Twelve themes.** From Default Dark `#000000` / `#FFC799` to adaptive light mode, all with
  WCAG AA+ readable accents.

## Install

- **Windows:** run `Antigravity-Pulse-Desktop-v1.0.0-Setup.exe` (NSIS) or extract the portable ZIP.
- **macOS / Linux:** build from source with `npm run dist:mac` / `npm run dist:linux`.

Verify any downloaded artifact against `SHA256SUMS.txt`:

```powershell
Get-FileHash .\Antigravity-Pulse-Desktop-v1.0.0-Setup.exe -Algorithm SHA256
```

## Privacy and security

- The bridge is off by default and requires a bearer token on every API call.
- Firebase profile documents always store `authToken: ""`; real tokens are held by the operating
  system's secret store (DPAPI via Electron `safeStorage` on Windows).
- Google authentication opens your system browser. The app never embeds the OAuth consent screen.
- Handshake tokens in T3 links are kept in memory only and removed before persistence.

## Known limitations

- The OAuth consent screen may still be in **Testing**. Publish it at
  **Google Auth Platform → Audience → Publish app** if you want accounts outside the test list.
- GitHub Actions release automation requires an active billing account; v1.0.0 artifacts were
  produced and uploaded manually with the GitHub CLI.
- The built-in update checker reads GitHub Releases; it does not install updates automatically.

---

Built by **Solomon Ogar Bukie** · [@IceCool30](https://github.com/IceCool30)
