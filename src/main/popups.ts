import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { isAllowedAuthPopup } from '@shared/validation'
import { browserCompatPreloadPath, browserUserAgent } from './sessions'

export function authPopupOptions(
  partition: string,
  parent: BrowserWindow
): BrowserWindowConstructorOptions {
  return {
    width: 540,
    height: 760,
    minWidth: 420,
    minHeight: 560,
    parent,
    autoHideMenuBar: true,
    backgroundColor: '#0B0E14',
    title: 'Sign in · Antigravity Pulse',
    webPreferences: {
      partition,
      preload: browserCompatPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  }
}

export function isAuthPopupUrl(url: string): boolean {
  return isAllowedAuthPopup(url)
}

/**
 * Ensures OAuth popup windows (including nested redirects/popups) inherit the
 * clean Chrome identity, preload, and safe navigation restrictions.
 */
export function bindAuthPopupWindow(
  child: BrowserWindow,
  partition: string,
  parent: BrowserWindow,
  openExternalLink: (url: string) => void
): void {
  child.setMenuBarVisibility(false)
  child.webContents.userAgent = browserUserAgent()
  child.webContents.on('will-navigate', (event, targetUrl) => {
    try {
      const parsed = new URL(targetUrl)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        event.preventDefault()
      }
    } catch {
      event.preventDefault()
    }
  })
  child.webContents.setWindowOpenHandler(({ url: nestedUrl }) => {
    if (isAuthPopupUrl(nestedUrl)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: authPopupOptions(partition, parent)
      }
    }
    openExternalLink(nestedUrl)
    return { action: 'deny' }
  })
  child.webContents.on('did-create-window', (grandChild) => {
    bindAuthPopupWindow(grandChild, partition, parent, openExternalLink)
  })
}
