# Changelog

All notable changes to Antigravity Pulse Desktop are documented here.

## [1.0.2] — 2026-11-23

### Added

- In-app self-update: check GitHub Releases, download the verified installer with progress, and
  install/restart from Settings → System. `latest.yml` is published with every NSIS release.
- Back and forward arrows in the title bar for web workspaces.
- A small always-visible exit control in Zen mode.

### Fixed

- Embedded sign-in now sends a genuine Chrome user agent matching the bundled Chromium, resolving
  Google's "browser or app may not be secure" message in most cases; system-browser fallback remains.
- Removed Firebase project/database identifiers from in-app UI and public docs.
- Display name shortened to Solomon Bukie and "Built by" changed to "Developer".

[1.0.2]: https://github.com/IceCool30/Antigravity-Pulse-Desktop/releases/tag/v1.0.2

## [1.0.1] — 2026-11-23

### Security

- Patched transitive dependencies flagged by GitHub Dependabot: `@grpc/grpc-js` is pinned to
  `1.14.5` (fixes the high-severity `getAuthContext` authorization bypass and the low-severity
  error-message disclosure) and `minimatch` is pinned to `11.0.1` in the packaging toolchain
  (fixes the moderate globparts denial of service). `npm audit` now reports zero vulnerabilities.
- The rail version label now reads the actual app version instead of a hard-coded `v1.0.0`.

### Changed

- No feature changes from 1.0.0. All nine workspaces, split view, command palette, phone bridge,
  and Firestore parity behave identically.

[1.0.1]: https://github.com/IceCool30/Antigravity-Pulse-Desktop/releases/tag/v1.0.1

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
