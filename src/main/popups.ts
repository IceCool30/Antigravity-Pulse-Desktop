import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { isAllowedAuthPopup } from '@shared/validation'

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  }
}

export function isAuthPopupUrl(url: string): boolean {
  return isAllowedAuthPopup(url)
}
