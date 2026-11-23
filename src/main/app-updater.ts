import type { PulseEvent, UpdateStatus } from '@shared/ipc'
import type { AppUpdater, ProgressInfo, UpdateInfo } from 'electron-updater'

/**
 * Shared GitHub feed. Keeping this explicit means dev and packaged builds use
 * the same update source instead of relying on electron-builder's injected
 * `app-update.yml`.
 */
export const UPDATE_FEED = {
  provider: 'github' as const,
  owner: 'IceCool30',
  repo: 'Antigravity-Pulse-Desktop'
}

/* ── Pure helpers ──────────────────────────────────────────────────────────────
 * These are exported for unit tests and deliberately import no Electron
 * runtime. The electron-updater module is only loaded lazily (see below), so
 * importing this file in Vitest is safe.
 * ────────────────────────────────────────────────────────────────────────────── */

export function parseVersionParts(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))
}

/** Lexicographic numeric comparison of dotted version strings. */
export function isNewerVersion(latest: string, current: string): boolean {
  const left = parseVersionParts(latest)
  const right = parseVersionParts(current)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

/** electron-updater allows string, array, or null release notes. */
export function normalizeReleaseNotes(notes: unknown): string | undefined {
  if (typeof notes === 'string') {
    const trimmed = notes.trim()
    return trimmed ? trimmed : undefined
  }
  if (Array.isArray(notes)) {
    const lines = notes
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim()
        if (typeof entry === 'object' && entry !== null && 'note' in entry) {
          const note = (entry as { note?: unknown }).note
          return typeof note === 'string' ? note.trim() : ''
        }
        return ''
      })
      .filter((line) => line.trim().length > 0)
    return lines.length ? lines.join('\n') : undefined
  }
  return undefined
}

/** Coerce any reported progress value into a 0–100 integer. */
export function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Turn raw updater exceptions into short, non-secret user-facing messages. */
export function friendlyUpdateError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  if (!raw.trim()) return 'The update could not be completed. Please try again.'
  const text = raw.toLowerCase()
  if (
    text.includes('no update') ||
    text.includes('not found') ||
    text.includes('404') ||
    text.includes('no published')
  ) {
    return 'No published update was found yet.'
  }
  if (
    text.includes('enotfound') ||
    text.includes('econn') ||
    text.includes('network') ||
    text.includes('timeout') ||
    text.includes('offline') ||
    text.includes('failed to fetch') ||
    text.includes('getaddrinfo')
  ) {
    return 'Could not reach the update server. Check your connection and try again.'
  }
  if (
    text.includes('sha512') ||
    text.includes('hash') ||
    text.includes('signature') ||
    text.includes('verification') ||
    text.includes('integrity')
  ) {
    return 'The update file could not be verified. Please try again later.'
  }
  // Never forward absolute paths or token-bearing URLs to the renderer.
  const safe = raw.replace(/(?:[A-Za-z]:)?[\\/][^\s"']+/g, '').trim()
  return (safe || 'The update could not be completed.').slice(0, 240)
}

export type UpdaterEventName =
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'error'

export interface UpdateEventContext {
  version?: string
  releaseNotes?: unknown
  url?: string
  message?: unknown
  progress?: unknown
  checkedAt?: number
}

/** Map a single electron-updater event onto the shared UpdateStatus shape. */
export function mapUpdaterEvent(
  event: UpdaterEventName,
  context: UpdateEventContext = {}
): UpdateStatus {
  const withChecked = <T extends UpdateStatus>(status: T): T =>
    context.checkedAt === undefined ? status : { ...status, checkedAt: context.checkedAt }

  switch (event) {
    case 'checking-for-update':
      return withChecked({ state: 'checking' })

    case 'update-available': {
      const notes = normalizeReleaseNotes(context.releaseNotes)
      return withChecked({
        state: 'available',
        ...(context.version ? { latestVersion: context.version } : {}),
        ...(notes ? { releaseNotes: notes } : {}),
        ...(context.url ? { url: context.url } : {})
      })
    }

    case 'update-not-available':
      return withChecked({
        state: 'current',
        ...(context.version ? { latestVersion: context.version } : {}),
        ...(context.url ? { url: context.url } : {})
      })

    case 'download-progress':
      return withChecked({
        state: 'downloading',
        progress: clampProgress(context.progress),
        ...(context.version ? { latestVersion: context.version } : {})
      })

    case 'update-downloaded': {
      const notes = normalizeReleaseNotes(context.releaseNotes)
      return withChecked({
        state: 'downloaded',
        downloaded: true,
        progress: 100,
        ...(context.version ? { latestVersion: context.version } : {}),
        ...(notes ? { releaseNotes: notes } : {})
      })
    }

    case 'error':
      return withChecked({ state: 'error', message: friendlyUpdateError(context.message) })

    default:
      return withChecked({ state: 'idle' })
  }
}

/* ── Runtime wrapper ─────────────────────────────────────────────────────────── */

export interface AppUpdaterHandle {
  getStatus(): UpdateStatus
  check(): Promise<UpdateStatus>
  download(): Promise<void>
  install(): void
  dispose(): void
}

export interface AppUpdaterOptions {
  currentVersion: string
  publish: (event: PulseEvent) => void
}

/** Create the in-app updater. electron-updater is imported only on demand. */
export function createAppUpdater(options: AppUpdaterOptions): AppUpdaterHandle {
  let status: UpdateStatus = { state: 'idle' }
  let instance: AppUpdater | null = null
  let disposed = false

  function setStatus(next: UpdateStatus): void {
    if (disposed) return
    status = next
    options.publish({ type: 'update', payload: next })
  }

  function infoContext(info?: UpdateInfo | null): UpdateEventContext {
    return {
      version: info?.version,
      releaseNotes: info?.releaseNotes,
      checkedAt: Date.now()
    }
  }

  async function ensureInstance(): Promise<AppUpdater | null> {
    if (disposed) return null
    if (instance) return instance
    try {
      const { autoUpdater } = await import('electron-updater')
      if (disposed) return null
      autoUpdater.setFeedURL(UPDATE_FEED)
      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = false

      autoUpdater.on('checking-for-update', () => {
        setStatus(mapUpdaterEvent('checking-for-update', { checkedAt: Date.now() }))
      })
      autoUpdater.on('update-available', (info: UpdateInfo) => {
        setStatus(mapUpdaterEvent('update-available', infoContext(info)))
      })
      autoUpdater.on('update-not-available', (info: UpdateInfo) => {
        setStatus(mapUpdaterEvent('update-not-available', infoContext(info)))
      })
      autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        setStatus(
          mapUpdaterEvent('download-progress', {
            progress: progress.percent,
            version: status.latestVersion,
            checkedAt: Date.now()
          })
        )
      })
      autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        setStatus(mapUpdaterEvent('update-downloaded', infoContext(info)))
      })
      autoUpdater.on('error', (error: Error) => {
        setStatus(mapUpdaterEvent('error', { message: error?.message, checkedAt: Date.now() }))
      })

      instance = autoUpdater
      return instance
    } catch {
      // electron-updater is unavailable (e.g. plain browser/dev harness).
      return null
    }
  }

  async function legacyCheck(): Promise<UpdateStatus> {
    try {
      const { checkForUpdates } = await import('./update-checker')
      const result = await checkForUpdates(options.currentVersion)
      setStatus(result)
      return result
    } catch {
      const result: UpdateStatus = {
        state: 'error',
        message: 'Could not check for updates.',
        checkedAt: Date.now()
      }
      setStatus(result)
      return result
    }
  }

  async function check(): Promise<UpdateStatus> {
    if (disposed) return status
    setStatus(mapUpdaterEvent('checking-for-update', { checkedAt: Date.now() }))
    const updater = await ensureInstance()
    if (!updater) return legacyCheck()
    try {
      await updater.checkForUpdates()
      // Events normally settle the status; derive a terminal state if they did not.
      if (status.state === 'checking') {
        const result: UpdateStatus = {
          state: 'current',
          checkedAt: Date.now()
        }
        setStatus(result)
      }
      return status
    } catch (error) {
      // Dev builds have no packaged app/update manifest; use the GitHub API.
      return legacyCheck().catch(() => {
        const result: UpdateStatus = {
          state: 'error',
          message: friendlyUpdateError(error),
          checkedAt: Date.now()
        }
        setStatus(result)
        return result
      })
    }
  }

  async function download(): Promise<void> {
    if (disposed) return
    const updater = await ensureInstance()
    if (!updater) throw new Error('Automatic updates are unavailable in this build.')
    setStatus(
      mapUpdaterEvent('download-progress', {
        progress: 0,
        version: status.latestVersion,
        checkedAt: Date.now()
      })
    )
    await updater.downloadUpdate()
  }

  function install(): void {
    if (disposed || !instance) return
    setStatus({ state: 'installing', checkedAt: Date.now() })
    instance.quitAndInstall(false, true)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    instance?.removeAllListeners()
    instance = null
  }

  return {
    getStatus: () => status,
    check,
    download,
    install,
    dispose
  }
}
