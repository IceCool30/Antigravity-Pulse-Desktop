import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ACCEPT_LANGUAGE,
  applyBrowserRequestHeaders,
  buildBrowserCompatScript,
  buildBrowserUserAgent,
  buildClientHintHeaders,
  buildHighEntropyClientHintHeaders,
  isGoogleIdentityUrl,
  resolveChromeVersion
} from '../src/shared/browser-identity'
import { isAllowedAuthPopup } from '../src/shared/validation'

describe('browser identity & Client Hints hardening', () => {
  it('builds genuine desktop Chrome User-Agents without Electron tokens', () => {
    const winUa = buildBrowserUserAgent('win32', '156.0.8078.100')
    expect(winUa).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.100 Safari/537.36'
    )
    expect(winUa).not.toContain('Electron')
    expect(buildBrowserUserAgent('darwin', '156.0.8078.100')).toContain('Macintosh; Intel Mac OS X 10_15_7')
    expect(buildBrowserUserAgent('linux', '156.0.8078.100')).toContain('X11; Linux x86_64')
    expect(resolveChromeVersion('bad-version')).toBe('156.0.0.0')
  })

  it('produces Chrome-branded Sec-CH-UA headers matching the Chrome version', () => {
    const low = buildClientHintHeaders({ platform: 'win32', chromeVersion: '156.0.8078.100' })
    expect(low['Sec-CH-UA']).toBe('"Not_A Brand";v="24", "Chromium";v="156", "Google Chrome";v="156"')
    expect(low['Sec-CH-UA-Mobile']).toBe('?0')
    expect(low['Sec-CH-UA-Platform']).toBe('"Windows"')

    const high = buildHighEntropyClientHintHeaders({ platform: 'win32', arch: 'x64', chromeVersion: '156.0.8078.100' })
    expect(high['Sec-CH-UA-Full-Version-List']).toContain('"Google Chrome";v="156.0.8078.100"')
    expect(high['Sec-CH-UA-Arch']).toBe('"x86"')
    expect(high['Sec-CH-UA-Bitness']).toBe('"64"')
  })

  it('detects Google identity hosts and applies high-entropy hints without leaking Electron headers', () => {
    expect(isGoogleIdentityUrl('https://accounts.google.com/v3/signin')).toBe(true)
    expect(isGoogleIdentityUrl('https://aistudio.google.com/')).toBe(true)
    expect(isGoogleIdentityUrl('https://oauth2.googleapis.com/token')).toBe(true)
    expect(isGoogleIdentityUrl('https://github.com/login')).toBe(false)

    const googleHeaders = applyBrowserRequestHeaders(
      {
        'user-agent': 'Electron/45.4.1',
        'sec-ch-ua': '"Electron";v="45"',
        'Accept-Language': 'en-US'
      },
      'https://accounts.google.com/ServiceLogin',
      { platform: 'win32', arch: 'x64', chromeVersion: '156.0.8078.100' }
    )
    expect(googleHeaders['user-agent']).toBeUndefined()
    expect(googleHeaders['sec-ch-ua']).toBeUndefined()
    expect(googleHeaders['User-Agent']).toContain('Chrome/156.0.8078.100')
    expect(googleHeaders['Accept-Language']).toBe(DEFAULT_ACCEPT_LANGUAGE)
    expect(googleHeaders['Sec-CH-UA']).toContain('"Google Chrome";v="156"')
    expect(googleHeaders['Sec-CH-UA-Full-Version-List']).toContain('"Google Chrome";v="156.0.8078.100"')

    const thirdPartyHeaders = applyBrowserRequestHeaders(
      { 'Accept-Language': 'en-GB,en;q=0.8' },
      'https://api.github.com/user',
      { platform: 'win32', arch: 'x64', chromeVersion: '156.0.8078.100' }
    )
    expect(thirdPartyHeaders['Accept-Language']).toBe('en-GB,en;q=0.8')
    expect(thirdPartyHeaders['Sec-CH-UA']).toContain('"Google Chrome";v="156"')
    expect(thirdPartyHeaders['Sec-CH-UA-Full-Version-List']).toBeUndefined()
  })

  it('generates an idempotent page-world compat script with Google Chrome navigator.userAgentData', () => {
    const script = buildBrowserCompatScript({ platform: 'win32', arch: 'x64', chromeVersion: '156.0.8078.100' })
    expect(script).toContain('__pulseBrowserCompatApplied')
    expect(script).toContain('Google Chrome')
    expect(script).toContain('156.0.8078.100')
    expect(script).toContain('userAgentData')
    expect(script).toContain('getHighEntropyValues')
    expect(() => new Function(script)).not.toThrow()
  })

  it('permits Google and workspace OAuth popup hosts while rejecting untrusted popups', () => {
    expect(isAllowedAuthPopup('https://accounts.google.com/o/oauth2/v2/auth')).toBe(true)
    expect(isAllowedAuthPopup('https://accounts.google.co.uk/')).toBe(true)
    expect(isAllowedAuthPopup('https://clerk.t3.codes/v1/oauth_callback')).toBe(true)
    expect(isAllowedAuthPopup('https://my-app.firebaseapp.com/__/auth/handler')).toBe(true)
    expect(isAllowedAuthPopup('https://evil.example.com/phish')).toBe(false)
    expect(isAllowedAuthPopup('javascript:alert(1)')).toBe(false)
  })
})
