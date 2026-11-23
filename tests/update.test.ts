import { describe, expect, it } from 'vitest'
import {
  clampProgress,
  friendlyUpdateError,
  isNewerVersion,
  mapUpdaterEvent,
  normalizeReleaseNotes,
  parseVersionParts,
  type UpdaterEventName
} from '../src/main/app-updater'

const NOW = 1_700_000_000_000

describe('version comparison', () => {
  it('parses dotted versions, ignoring a v prefix and non-numeric parts', () => {
    expect(parseVersionParts('v1.2.3')).toEqual([1, 2, 3])
    expect(parseVersionParts('1.0.1')).toEqual([1, 0, 1])
    expect(parseVersionParts('v2.0.0-beta.1')).toEqual([2, 0, 0, 0, 1])
    expect(parseVersionParts('1.x')).toEqual([1, 0])
  })

  it('detects newer releases across patch, minor, and major bumps', () => {
    expect(isNewerVersion('1.0.2', '1.0.1')).toBe(true)
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true)
    expect(isNewerVersion('v2.0.0', '1.9.9')).toBe(true)
    expect(isNewerVersion('1.0.10', '1.0.9')).toBe(true)
  })

  it('treats equal or older releases as not newer', () => {
    expect(isNewerVersion('1.0.1', '1.0.1')).toBe(false)
    expect(isNewerVersion('1.0.1', '1.0.2')).toBe(false)
    expect(isNewerVersion('1.0', '1.0.0')).toBe(false)
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false)
  })
})

describe('release notes normalization', () => {
  it('accepts trimmed strings', () => {
    expect(normalizeReleaseNotes('  Bug fixes  ')).toBe('Bug fixes')
    expect(normalizeReleaseNotes('   ')).toBeUndefined()
  })

  it('accepts arrays of strings and note objects', () => {
    expect(normalizeReleaseNotes(['Added dark mode', 'Fixed crash'])).toBe(
      'Added dark mode\nFixed crash'
    )
    expect(normalizeReleaseNotes([{ version: '1.0.2', note: 'Faster startup' }])).toBe(
      'Faster startup'
    )
    expect(normalizeReleaseNotes([{ version: '1.0.2' }, ''])).toBeUndefined()
  })

  it('returns undefined for nullish or unexpected values', () => {
    expect(normalizeReleaseNotes(null)).toBeUndefined()
    expect(normalizeReleaseNotes(undefined)).toBeUndefined()
    expect(normalizeReleaseNotes(42)).toBeUndefined()
  })
})

describe('progress clamping', () => {
  it('rounds and clamps percentages into 0–100', () => {
    expect(clampProgress(55.4)).toBe(55)
    expect(clampProgress(55.6)).toBe(56)
    expect(clampProgress(-5)).toBe(0)
    expect(clampProgress(150)).toBe(100)
  })

  it('falls back to 0 for invalid values', () => {
    expect(clampProgress(Number.NaN)).toBe(0)
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampProgress('50')).toBe(0)
    expect(clampProgress(undefined)).toBe(0)
  })
})

describe('friendly update errors', () => {
  it('maps known failure classes to actionable messages', () => {
    expect(friendlyUpdateError(new Error('404 Not Found'))).toBe('No published update was found yet.')
    expect(friendlyUpdateError('ENOTFOUND github.com')).toContain('Could not reach the update server')
    expect(friendlyUpdateError('sha512 checksum mismatch')).toContain('could not be verified')
  })

  it('strips file paths and does not leak secrets', () => {
    const message = friendlyUpdateError('C:\\secret\\token=abc failed')
    expect(message).not.toContain('C:')
    expect(message).not.toContain('token=')
  })

  it('uses a generic fallback for blank errors', () => {
    expect(friendlyUpdateError('')).toContain('could not be completed')
    expect(friendlyUpdateError(null)).toContain('could not be completed')
  })
})

describe('updater event → status mapping', () => {
  it('maps lifecycle events to their matching states', () => {
    expect(mapUpdaterEvent('checking-for-update', { checkedAt: NOW })).toEqual({
      state: 'checking',
      checkedAt: NOW
    })
    expect(mapUpdaterEvent('update-not-available', { version: '1.0.1', checkedAt: NOW })).toEqual({
      state: 'current',
      latestVersion: '1.0.1',
      checkedAt: NOW
    })
  })

  it('includes version, notes, and URL when an update is available', () => {
    expect(
      mapUpdaterEvent('update-available', {
        version: '1.0.2',
        releaseNotes: ['  Faster startup  '],
        url: 'https://github.com/IceCool30/Antigravity-Pulse-Desktop/releases/tag/v1.0.2',
        checkedAt: NOW
      })
    ).toEqual({
      state: 'available',
      latestVersion: '1.0.2',
      releaseNotes: 'Faster startup',
      url: 'https://github.com/IceCool30/Antigravity-Pulse-Desktop/releases/tag/v1.0.2',
      checkedAt: NOW
    })
  })

  it('omits optional fields when no release metadata is present', () => {
    expect(mapUpdaterEvent('update-available', { checkedAt: NOW })).toEqual({
      state: 'available',
      checkedAt: NOW
    })
  })

  it('maps download progress with a clamped percentage', () => {
    expect(
      mapUpdaterEvent('download-progress', {
        progress: 250,
        version: '1.0.2',
        checkedAt: NOW
      })
    ).toEqual({
      state: 'downloading',
      progress: 100,
      latestVersion: '1.0.2',
      checkedAt: NOW
    })
  })

  it('marks the installer as downloaded at 100%', () => {
    expect(
      mapUpdaterEvent('update-downloaded', { version: '1.0.2', releaseNotes: 'Fixes', checkedAt: NOW })
    ).toEqual({
      state: 'downloaded',
      downloaded: true,
      progress: 100,
      latestVersion: '1.0.2',
      releaseNotes: 'Fixes',
      checkedAt: NOW
    })
  })

  it('uses a friendly message for error events', () => {
    expect(mapUpdaterEvent('error', { message: 'ENOTFOUND github.com', checkedAt: NOW })).toEqual({
      state: 'error',
      message: 'Could not reach the update server. Check your connection and try again.',
      checkedAt: NOW
    })
  })

  it('defaults to idle for an unrecognized event', () => {
    expect(mapUpdaterEvent('unknown' as UpdaterEventName, { checkedAt: NOW })).toEqual({
      state: 'idle',
      checkedAt: NOW
    })
  })

  it('is deterministic and does not invent a checkedAt value', () => {
    const first = mapUpdaterEvent('checking-for-update')
    const second = mapUpdaterEvent('checking-for-update')
    expect(first).toEqual(second)
    expect(first).toEqual({ state: 'checking' })
  })
})
