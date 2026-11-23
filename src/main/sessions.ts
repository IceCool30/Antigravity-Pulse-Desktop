import { app, session, type Session } from 'electron'

const hardened = new Set<string>()

const PERMISSION_ALLOWLIST = new Set([
  'media',
  'audioCapture',
  'videoCapture',
  'clipboard-read',
  'clipboard-sanitized-write',
  'notifications',
  'fullscreen',
  'pointerLock'
])

/** Chrome desktop UA without Electron/app tokens (Google consoles reject raw Electron UAs). */
export function browserUserAgent(): string {
  return app.userAgentFallback
    .replace(/\sElectron\/[\d.]+/gi, '')
    .replace(/\sAntigravity[\s-]?Pulse(?:[\s-]?Desktop)?\/[\d.]+/gi, '')
    .replace(/\santigravity-pulse-desktop\/[\d.]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function partitionFor(workspaceId: string, isolated: readonly string[]): string {
  return isolated.includes(workspaceId)
    ? `persist:antigravity-ws-${workspaceId.replace(/[^a-z0-9-]/gi, '')}`
    : 'persist:antigravity-main'
}

/** Shared persistent session by default; per-workspace partitions are opt-in. */
export function workspaceSession(partition: string): Session {
  const ses = session.fromPartition(partition)
  if (!hardened.has(partition)) {
    hardened.add(partition)
    ses.setUserAgent(browserUserAgent())
    ses.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(PERMISSION_ALLOWLIST.has(permission))
    })
    ses.setPermissionCheckHandler((_contents, permission) => PERMISSION_ALLOWLIST.has(permission))
    ses.setSpellCheckerEnabled(true)
    ses.on('will-download', (_event, item) => {
      item.once('done', (_doneEvent, state) => {
        if (state === 'completed') {
          console.info('[download] completed', item.getFilename())
        }
      })
    })
  }
  return ses
}
