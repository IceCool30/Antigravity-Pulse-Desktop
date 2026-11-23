import type { BrowserWindow } from 'electron'
import type { PulseEvent } from '@shared/ipc'
import { showNativeToast } from './toast-window'

let target: BrowserWindow | null = null
let overlayVisible = false
let nativeViewActive = false

export function setEventTarget(window: BrowserWindow | null): void {
  target = window
}

/** Main mirrors the renderer's overlay state so native toasts don't duplicate DOM ones. */
export function setOverlayVisibleForEvents(visible: boolean): void {
  overlayVisible = visible
}

/** True while a WebContentsView owns the stage and covers the renderer's DOM. */
export function setNativeViewActive(active: boolean): void {
  nativeViewActive = active
}

export function publish(event: PulseEvent): void {
  if (!target || target.isDestroyed()) return
  const contents = target.webContents
  if (contents.isDestroyed()) return
  contents.send('pulse:event', event)
}

export function toast(
  title: string,
  body?: string,
  kind: 'info' | 'success' | 'error' = 'info'
): void {
  publish({ type: 'toast', payload: { title, body, kind } })
  // DOM toasts sit above the shell but below native workspace views.
  if (nativeViewActive && !overlayVisible) showNativeToast({ title, body, kind })
}
