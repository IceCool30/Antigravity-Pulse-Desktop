import { describe, expect, it } from 'vitest'
import { buildPairingUris } from '../src/shared/validation'

const token = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'

describe('phone pairing QR payload', () => {
  it('matches the Android scanner URI contract exactly', () => {
    const result = buildPairingUris({
      ip: '192.168.1.24',
      port: 3847,
      token,
      hostName: 'DESKTOP-APOLLO'
    })
    expect(result).toEqual({
      ok: true,
      value: {
        deepLink:
          'antigravity://pair?url=http://192.168.1.24:3847' +
          `&token=${token}&name=DESKTOP-APOLLO`,
        fallbackUrl: `http://192.168.1.24:3847/#token=${token}`
      }
    })
  })

  it('percent-encodes host names with spaces, ampersands, and unicode', () => {
    const result = buildPairingUris({
      ip: '10.0.0.12',
      port: 4000,
      token,
      hostName: 'Solomon’s Desk & Studio'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.deepLink).toContain(`&token=${token}&name=`)
    expect(result.value.deepLink).toContain(encodeURIComponent('Solomon’s Desk & Studio'))
    expect(result.value.fallbackUrl).toBe(`http://10.0.0.12:4000/#token=${token}`)
  })

  it('accepts Tailscale addresses', () => {
    const result = buildPairingUris({ ip: '100.101.12.5', port: 3847, token, hostName: 'Pulse' })
    expect(result.ok).toBe(true)
  })

  it('rejects invalid addresses, ports, tokens, and empty names', () => {
    const base = { ip: '192.168.1.24', port: 3847, token, hostName: 'Pulse' }
    expect(buildPairingUris({ ...base, ip: '999.1.1.1' }).ok).toBe(false)
    expect(buildPairingUris({ ...base, ip: 'example.com' }).ok).toBe(false)
    expect(buildPairingUris({ ...base, port: 80 }).ok).toBe(false)
    expect(buildPairingUris({ ...base, port: 70_000 }).ok).toBe(false)
    expect(buildPairingUris({ ...base, token: 'short' }).ok).toBe(false)
    expect(buildPairingUris({ ...base, token: `${token}!` }).ok).toBe(false)
    expect(buildPairingUris({ ...base, hostName: '   ' }).ok).toBe(false)
  })

  it('strips control characters and caps the advertised host name', () => {
    const result = buildPairingUris({
      ip: '172.16.4.9',
      port: 3847,
      token,
      hostName: `A\u0000B"C${'x'.repeat(120)}`
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.deepLink).not.toContain('"')
    const encodedName = result.value.deepLink.split('&name=')[1] ?? ''
    expect(decodeURIComponent(encodedName)).toHaveLength(80)
  })
})
