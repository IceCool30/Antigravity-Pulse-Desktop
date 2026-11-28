import { describe, expect, it } from 'vitest'
import { isAuthResumeUrl } from '../src/shared/validation'
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  migrateSettings,
  sanitizeSettings
} from '../src/shared/settings'

describe('workspace resume URLs', () => {
  it('recognizes identity-provider sign-in pages as non-resumable', () => {
    expect(
      isAuthResumeUrl(
        'https://accounts.google.com/v3/signin/identifier?continue=https://aistudio.google.com/&flowName=GlifWebSignIn'
      )
    ).toBe(true)
    expect(isAuthResumeUrl('https://accounts.google.com/signin/oauth/v3/consent?authuser=unknown')).toBe(true)
    expect(isAuthResumeUrl('https://clerk.t3.codes/v1/oauth_callback?code=abc&state=xyz')).toBe(true)
    expect(isAuthResumeUrl('https://accounts.google.com.hk/v3/signin/identifier')).toBe(true)

    expect(isAuthResumeUrl('https://app.t3.codes/')).toBe(false)
    expect(isAuthResumeUrl('https://aistudio.google.com/apps/f108d812')).toBe(false)
    expect(isAuthResumeUrl('https://github.com/')).toBe(false)
    expect(isAuthResumeUrl('https://www.google.com/?pli=1')).toBe(false)
    expect(isAuthResumeUrl('not a url')).toBe(false)
  })

  it('never persists a sign-in page as a workspace lastUrl', () => {
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      lastUrls: {
        t3: 'https://accounts.google.com/v3/signin/identifier?dsh=S-350512605',
        aistudio: 'https://accounts.google.com/v3/signin/identifier?ltmpl=aistudio',
        github: 'https://github.com/',
        vercel: 'https://vercel.com/icecool30s-projects'
      }
    })

    expect(settings.lastUrls.t3).toBeUndefined()
    expect(settings.lastUrls.aistudio).toBeUndefined()
    expect(settings.lastUrls.github).toBe('https://github.com/')
    expect(settings.lastUrls.vercel).toBe('https://vercel.com/icecool30s-projects')
  })
})

describe('v1 → v2 session migration', () => {
  it('resets isolated workspaces once and preserves the rest of the settings', () => {
    const legacy = {
      ...DEFAULT_SETTINGS,
      version: 1,
      themeMode: 'LIGHT' as const,
      isolatedWorkspaces: ['t3', 'aistudio', 'github'],
      lastUrls: {
        t3: 'https://accounts.google.com/v3/signin/identifier?dsh=stale',
        github: 'https://github.com/'
      }
    }

    const migrated = migrateSettings(legacy)
    expect(migrated.version).toBe(SETTINGS_VERSION)
    expect(migrated.isolatedWorkspaces).toEqual([])
    expect(migrated.themeMode).toBe('LIGHT')
    expect(migrated.lastUrls.t3).toBeUndefined()
    expect(migrated.lastUrls.github).toBe('https://github.com/')

    // A second load must not keep wiping an explicit later opt-in.
    const optedIn = { ...migrated, isolatedWorkspaces: ['t3'] }
    expect(migrateSettings(optedIn).isolatedWorkspaces).toEqual(['t3'])
  })
})
