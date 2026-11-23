# Manual QA checklist — v1.0.0

Run after `npm run build` (and again against the packaged NSIS build). Replace anything marked
`FAIL` in the release log with an issue entry.

## Boot and shell

- [ ] Cold start shows the frameless shell, then the Home dashboard (first run) or the last
      workspace (returning user). No white flash, no console errors.
- [ ] 36px titlebar drag works; double-click maximizes; minimize/maximize/close buttons work.
- [ ] `Ctrl+K` opens the palette while a web workspace has focus; typing filters; `Enter` opens.
- [ ] `Ctrl+,` opens Settings; every control persists after restart.
- [ ] `Ctrl+\` and `F11` both toggle Zen; layout math matches (no gap, no clipped view).
- [ ] `Ctrl+1…9` activate all nine workspaces in order.
- [ ] Memory readout changes; pinned dots appear only for mounted workspaces.

## Workspaces and layout

- [ ] Each web workspace mounts once. Switch away and back: no reload, scroll position and sign-in
      preserved.
- [ ] `Alt+click` a web workspace in the rail opens split view. Drag the divider; both panes resize
      cleanly. `Ctrl+Shift+W` clears it.
- [ ] Narrow the window below 2×360px + 8px: split collapses without overlapping panes.
- [ ] Opening any palette/modal/sheet hides the native views; closing it restores them and returns
      keyboard focus.
- [ ] Trigger a toast while Home is active (DOM toast, bottom-right), then while a web workspace is
      active (native overlay toast, bottom-right, auto-hides after ~4s). No duplicates.
- [ ] Kill one workspace renderer (Task Manager or DevTools): only that pane shows the recovery
      banner. **Reload workspace** recovers it; other panes are untouched.
- [ ] Unload an idle workspace from the rail; pinned dot clears; RAM drops.

## Pulse Browser

- [ ] `Ctrl+8` then `Ctrl+T` opens several tabs; switching tabs keeps each page's state.
- [ ] `Ctrl+W` closes a tab but never the window.
- [ ] Address bar navigates bare hosts via `https://`; `Ctrl+F` find shows match counts.
- [ ] `Ctrl+L` focuses the address bar. Back/forward/reload/stop work.
- [ ] External-link behavior setting routes links correctly (system vs Pulse Browser).
- [ ] Paste a T3 `https://app.t3.codes/…#token=…` link into pairing: the page gets the live token,
      but `settings.json` and the rail tooltip contain no `token=` or `#`.

## Google and Firestore

- [ ] `auth:google` opens the **system browser**, not an embedded window. Callback page says
      "Signed in with Google". Renderer shows the account name/email.
- [ ] Create, edit, copy, and delete a server profile; reload the window: state matches Firestore.
- [ ] Create, edit, copy, and delete a copilot prompt; two open windows update in real time.
- [ ] In Firestore console, profile documents contain exactly the shared fields and
      `authToken: ""`. A token entered in the vault dialog is not present in any document.
- [ ] Offline: the connection chip says cached/offline; editing queues and reconciles.
- [ ] Sign out clears account data and stops snapshots.

## Phone bridge

- [ ] Bridge starts on 3847 with a generated token; QR renders and `antigravity://pair?...`
      matches `buildPairingUris` format.
- [ ] Android v1.2.1+ scans the QR and connects; device appears with hostname and ping.
- [ ] `GET /api/health` works anonymously; `GET /api/status` without a token returns 401.
- [ ] Phone activate/share actions reach the desktop; clipboard contains shared text.
- [ ] Regenerate token disconnects the phone; new QR works.
- [ ] Port conflict shows a friendly error, and changing the port restarts the bridge.
- [ ] Native notification appears; clicking it restores the window.

## Tray and updates

- [ ] Close button hides to tray (default). Tray tooltip shows active workspace + pinned count.
- [ ] Tray menu activates workspaces, toggles bridge, opens Cloud/Phone, checks updates, quits.
- [ ] Update checker reports current/available/error without blocking the UI.

## Packaging

- [ ] `npm test` — 56 tests pass (including live bridge HTTP/WS integration).
- [ ] `npm run typecheck` — zero errors.
- [ ] `npm run build` — clean electron-vite output.
- [ ] `npm run dist:win` — NSIS installer + portable ZIP, branded icon, no `.env` inside.
- [ ] `SHA256SUMS.txt` matches `Get-FileHash` of both artifacts.
- [ ] Installer runs, app launches from Start Menu, portable ZIP launches standalone.
- [ ] No bridge token or Firestore profile token in any packaged text file. The Google Desktop OAuth
      client secret is expected in `out/main/index.js` — the token endpoint requires it; Google
      treats installed-app client secrets as non-confidential. `.env` itself is not committed.
