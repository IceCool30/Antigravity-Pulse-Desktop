import { session, type Session } from 'electron'

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

/**
 * A genuine desktop Chrome UA matching the bundled Chromium version. Embedded
 * sign-in pages (notably Google) reject UAs containing `Electron`, and some
 * reject the raw Electron fallback even after token stripping.
 */
export function browserUserAgent(): string {
  const platform =
    process.platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10_15_7'
      : process.platform === 'linux'
        ? 'X11; Linux x86_64'
        : 'Windows NT 10.0; Win64; x64'
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`
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
