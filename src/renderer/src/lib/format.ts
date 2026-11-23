import { stripUrlSecrets } from '@shared/validation'

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit] ?? 'B'}`
}

export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '—'
  const diff = Date.now() - timestamp
  if (diff < 45_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m ${pad2(totalSeconds % 60)}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${pad2(minutes % 60)}m`
}

/** Credential-stripped URL for anything persisted or displayed. */
export function displayUrl(url: string): string {
  return stripUrlSecrets(url) || url
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 22) return 'Good evening'
  return 'Good night'
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

/** Electron zoom level (−5..5, 0.5 steps) as a rounded percentage. */
export function zoomPercent(level: number): string {
  return `${Math.round(1.2 ** level * 100)}%`
}
