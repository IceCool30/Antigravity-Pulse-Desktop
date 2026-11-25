import { session, type Session, type WebPreferences } from 'electron'
import { join } from 'node:path'
import {
  DEFAULT_ACCEPT_LANGUAGE,
  applyBrowserRequestHeaders,
  buildBrowserUserAgent
} from '@shared/browser-identity'

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
  return buildBrowserUserAgent(process.platform, process.versions['chrome'])
}

export function browserCompatPreloadPath(): string {
  return join(__dirname, '../preload/browser-compat.js')
}

export function browserWebPreferences(partition: string): WebPreferences {
  return {
    partition,
    preload: browserCompatPreloadPath(),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
    backgroundThrottling: true
  }
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
    const identity = {
      platform: process.platform,
      arch: process.arch,
      chromeVersion: process.versions['chrome']
    }
    ses.setUserAgent(browserUserAgent(), DEFAULT_ACCEPT_LANGUAGE)
    ses.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
      callback({
        requestHeaders: applyBrowserRequestHeaders(details.requestHeaders, details.url, identity)
      })
    })
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
