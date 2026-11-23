# Changelog

All notable changes to Antigravity Pulse Desktop are documented here.

## [1.0.0] — 2026-11-23

### Added

- Nine pinned workspaces backed by main-process `WebContentsView`s: Antigravity Remote, T3 Code
  Web, Google AI Studio, Gemini, GitHub, Vercel, Supabase, Pulse Browser, and Cloud Sync & Phone
  Companion. Views mount lazily, then stay warm across switches.
- Single-pane and side-by-side split layout with a draggable divider, independent bounds, and
  automatic collapse below the minimum pane width.
- Zen mode (`Ctrl+\` / `F11`), command palette (`Ctrl+K`), settings center, and a 36px frameless
  titlebar with live memory readout and native window controls.
- 56/220px workspace rail with brand icons, shortcuts, pinned/crashed indicators, per-workspace
  memory, and one-click unload to reclaim RAM.
- Pulse Browser: multi-tab strip, address bar, back/forward/reload/stop, find-in-page, zoom, and
  external-link policy. T3 `#token=` handshakes are stripped before any URL is persisted.
- Per-workspace `render-process-gone` recovery with an isolated reload banner; other workspaces
  and the shell remain alive.
- Google sign-in through the system browser with PKCE and a loopback callback; tokens exchanged in
  main and applied via `signInWithCredential` in the renderer.
- Real-time Firestore parity for `users/{uid}/serverProfiles` and `users/{uid}/copilotPrompts` with
  exact shared field sets, canonical URL validation, clipboard copy, and safeStorage-only profile
  tokens (`authToken` is always empty in Firestore).
- Opt-in phone bridge with a 256-bit bearer token, LAN/Tailscale discovery, QR deep link and
  fallback URL, authenticated HTTP API, WebSocket device channel, and native notifications.
- Tray keep-alive with close-to-tray, live tooltip and context menu, plus periodic GitHub Releases
  update checks.
- Twelve Antigravity theme presets, adaptive light mode, and HSL-based WCAG AA+ accent adjustment
  at a minimum contrast ratio of 4.8:1.
- Vitest coverage for Firestore payload rules, QR URIs, contrast math, and split layout geometry.
- Windows NSIS installer and portable ZIP, with macOS DMG and Linux AppImage packaging configs.

[1.0.0]: https://github.com/IceCool30/Antigravity-Pulse-Desktop/releases/tag/v1.0.0
