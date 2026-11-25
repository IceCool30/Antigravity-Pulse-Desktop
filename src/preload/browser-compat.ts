import { webFrame } from 'electron'
import { buildBrowserCompatScript } from '@shared/browser-identity'

/**
 * Sandboxed preload for embedded web workspaces and auth popups. Exposes zero
 * Node or IPC bridges; only normalizes Chrome client hints in the page world so
 * embedded sign-in flows (Google, OAuth providers) are accepted reliably.
 */
const script = buildBrowserCompatScript({
  platform: process.platform,
  arch: process.arch,
  chromeVersion: process.versions['chrome']
})

try {
  void webFrame.executeJavaScript(script, true).catch(() => {
    /* ignore navigation-race frames */
  })
} catch {
  /* ignore restricted origins */
}
