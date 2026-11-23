import { Notification } from 'electron'

let enabled = true

/** Bound to the persisted preference during boot and on every settings change. */
export function setNotificationsEnabled(value: boolean): void {
  enabled = value
}

/** True when the platform exposes Electron's native notification center. */
export function notificationsSupported(): boolean {
  return typeof Notification === 'function' && Notification.isSupported()
}

/**
 * Best-effort native notification. Never throws: a blocked or unsupported
 * notification center must not interrupt the action that triggered it.
 */
export function showNotification(title: string, body?: string, onClick?: () => void): boolean {
  if (!enabled || !notificationsSupported()) return false
  try {
    const notification = new Notification({ title, body: body ?? '', silent: true })
    if (onClick) notification.on('click', onClick)
    notification.show()
    return true
  } catch {
    return false
  }
}
