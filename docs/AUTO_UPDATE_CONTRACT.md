# Desktop in-app auto-update — implementation contract

Goal: v1.0.2+ can check GitHub Releases, notify the user, download the signed/verified installer with
progress, and install+restart on one click — all inside the app.

## Ownership (do not edit other files)

- `package.json`, `package-lock.json`
- `electron-builder.yml`
- `src/shared/ipc.ts`
- `src/main/app-updater.ts` (new)
- `src/main/ipc-router.ts`
- `src/main/index.ts`
- `src/main/notifications.ts` (only if a dedicated update notification helper is needed)
- `src/renderer/src/components/settings/SystemSection.tsx`
- `src/renderer/src/components/UpdatePanel.tsx` (new, optional)
- `tests/update.test.ts` (new)

Everything else is read-only. Do not commit, push, tag, publish, or run `gh`. Do not run
`npm run dist:win` (the orchestrator packages/releases). Do not modify `.env` or echo secrets.

## Required behavior

1. Add `electron-updater` as a **dependency** (not devDependency). Choose a version compatible with
   Electron 45. Configure `electron-builder.yml` with a GitHub publish provider:

   ```yaml
   publish:
     provider: github
     owner: IceCool30
     repo: Antigravity-Pulse-Desktop
     releaseType: release
   ```

   Keep artifact names unchanged. This makes electron-builder emit `latest.yml` for NSIS builds —
   required by electron-updater. Do not set `--publish always`.

2. `src/main/app-updater.ts`: wrap `autoUpdater` from `electron-updater`.
   - Explicitly `setFeedURL({ provider: 'github', owner: 'IceCool30', repo: 'Antigravity-Pulse-Desktop' })`
     so dev and packaged builds share behavior.
   - `autoDownload = false`, `autoInstallOnAppQuit = false`; all actions are user-initiated via IPC.
   - Map updater events to a single `UpdateStatus` and publish via `publish({ type: 'update', ... })`:
     `checking-for-update` → `checking`, `update-available` → `available`,
     `update-not-available` → `current`, `download-progress` → `downloading` + `progress`,
     `update-downloaded` → `downloaded`, `error` → `error` with friendly message.
   - Expose `getStatus()`, `check(): Promise<UpdateStatus>`, `download(): Promise<void>`,
     `install(): void` (`quitAndInstall(false, true)`), and `dispose()`.
   - Include release version and notes when available. Never log tokens or paths containing secrets.
   - If `checkForUpdates()` rejects in dev (no packaged app), fall back to the existing
     `src/main/update-checker.ts` GitHub API check so the UI still reports current/available.

3. Extend `UpdateStatus` in `src/shared/ipc.ts` additively:
   - `state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'current' | 'error' | 'installing'`
   - optional `progress?: number` (0–100), `downloaded?: boolean`, `releaseNotes?: string`.
   Add channels:
   - `'app:downloadUpdate': { req: void; res: void }`
   - `'app:installUpdate': { req: void; res: void }`
   and register them in `COMMAND_CHANNELS`. Existing channels must remain.

4. `src/main/ipc-router.ts`: add handlers for the two new channels; route `app:checkUpdates` through
   the new updater instead of the old API checker. Validate inputs. Keep exhaustive
   `Record<CommandChannel, Handler>`.

5. `src/main/index.ts`: instantiate the updater after the window exists; pass a publish callback
   that sends `update` events and a toast on `available` and `downloaded`; keep startup check and the
   6-hour interval; dispose on `before-quit`. Update `buildBootstrap()` to include the current status.

6. Renderer `SystemSection.tsx`: in the existing Updates row add:
   - "Check now" button (already present) using `app:checkUpdates`.
   - When `available`: version, release notes (truncated) and **Download update** button.
   - When `downloading`: progress bar with percentage and disabled buttons.
   - When `downloaded`: **Install & restart** button.
   - When `error`: friendly message + Retry.
   No other settings sections need changes. Follow existing design tokens/components. Use
   `invoke('app:downloadUpdate', undefined)` / `invoke('app:installUpdate', undefined)`.

7. `tests/update.test.ts`: unit-test version comparison/status mapping logic you export from
   `app-updater.ts` (pure functions only — do not import Electron runtime into Vitest).

## Definition of done

- `npm run typecheck` → zero errors.
- `npm test` → all tests pass (existing 56 plus your new ones).
- `npm run build` succeeds; confirm `dist/latest.yml` is generated when packaging is run later
  (you do not need to run packaging).
- Final report: files changed, checks run, risks/deviations. State clearly that auto-update will
  first work in v1.0.2 because v1.0.1 was published without the updater.
