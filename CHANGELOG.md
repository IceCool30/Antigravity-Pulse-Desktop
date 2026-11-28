# Changelog

All notable changes to Antigravity Pulse Desktop are documented here.

## [1.0.4] - 2026-11-28

### Fixed

- **Workspace sign-ins no longer disappear after leaving and returning.** A one-time settings
  migration resets `isolatedWorkspaces` to the shared session (`persist:antigravity-main`), so the
  existing Google, GitHub, T3, Vercel and Supabase logins are used again. Users who deliberately
  want a separate session can still enable "Isolate session" afterwards.
- **OAuth sign-in pages are no longer saved as workspace resume URLs.** Google
  (`accounts.google.com`) sign-in/consent pages and Clerk/OAuth callback URLs are filtered out of
  `lastUrls` both when settings are loaded and when navigation is persisted, so reopening a
  workspace starts at its real home page instead of a stale sign-in URL with one-time state.
- Settings → Workspaces now warns that isolating a workspace starts with a fresh session and that
  existing site sign-ins will not carry over.

[1.0.4]: https://github.com/IceCool30/Antigravity-Pulse-Desktop/releases/tag/v1.0.4

## [1.0.3] - 2026-11-25

### Fixed

- Embedded Google and OAuth sign-in flows across all web workspaces, Pulse Browser, and nested auth
  popups no longer trigger Google's *"This browser or app may not be secure"* block:
  - Disabled Blink's `AutomationControlled` feature flag (`app.commandLine`) and shared genuine
    desktop Chrome UA / Client Hints (`Sec-CH-UA`, `Sec-CH-UA-Full-Version-List`,
    `Sec-CH-UA-Platform`, `navigator.userAgentData`, stripped `navigator.webdriver`) across
    requests and the page world via a sandboxed `browser-compat` preload.
  - Normalized outbound Google identity request headers and stripped Electron `X-Requested-With`
    markers via `session.webRequest.onBeforeSendHeaders`.
  - Applied consistent hardened `browserWebPreferences` (`nodeIntegrationInSubFrames: true`,
    `sandbox: true`, `contextIsolation: true`) and nested popup inheritance (`bindAuthPopupWindow`),
    while expanding allowed OAuth popup hosts/suffixes (`login.live.com`, `.google.com`,
    `.googleapis.com`, `.googleusercontent.com`, `.supabase.com`, `.vercel.com`, `.github.com`,
    `.t3.codes`, `.clerk.accounts.dev`, `.firebaseapp.com`, `.web.app`, `.auth0.com`, `.workos.com`).
  - Added automated unit coverage in `tests/browser-identity.test.ts`.

[1.0.3]: https://github.com/IceCool30/Antigravity-Pulse-Desktop/releases/tag/v1.0.3

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
