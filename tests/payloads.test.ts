import { describe, expect, it } from 'vitest'
import {
  coerceAddressInput,
  isSafeId,
  normalizeHttpUrl,
  normalizePairingUrl,
  promptCreatePayload,
  promptUpdatePayload,
  serverProfileCreatePayload,
  serverProfileUpdatePayload,
  stripUrlSecrets,
  validatePromptInput,
  validateServerProfileInput,
  type NormalizedPrompt,
  type NormalizedServerProfile
} from '../src/shared/validation'

const profile: NormalizedServerProfile = {
  name: 'Studio Relay',
  endpointUrl: 'http://192.168.1.24:3847/status',
  connectionMode: 'HYBRID_BRIDGE',
  keepAlivePinned: true,
  lastLatencyMs: 42
}

const prompt: NormalizedPrompt = {
  title: 'Release triage',
  promptText: 'Summarize failing checks and propose a fix.',
  rolePersona: 'Release engineer',
  preferredModel: 'Gemini 3 Pro'
}

const sortedKeys = (value: object): string[] => Object.keys(value).sort()

describe('Firestore serverProfile payloads', () => {
  it('creates exactly the Android-compatible field set', () => {
    const payload = serverProfileCreatePayload('user_ABC123', profile)
    expect(sortedKeys(payload)).toEqual([
      'authToken',
      'connectionMode',
      'endpointUrl',
      'keepAlivePinned',
      'lastLatencyMs',
      'name',
      'userId'
    ])
    expect(payload.userId).toBe('user_ABC123')
    expect(payload.authToken).toBe('')
    expect(payload.endpointUrl).toBe(profile.endpointUrl)
    expect(payload.connectionMode).toBe('HYBRID_BRIDGE')
    expect(payload.keepAlivePinned).toBe(true)
    expect(payload.lastLatencyMs).toBe(42)
  })

  it('never resends immutable identity or timestamps on update', () => {
    const payload = serverProfileUpdatePayload(profile)
    expect(sortedKeys(payload)).toEqual([
      'authToken',
      'connectionMode',
      'endpointUrl',
      'keepAlivePinned',
      'lastLatencyMs',
      'name'
    ])
    expect(payload).not.toHaveProperty('userId')
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload.authToken).toBe('')
  })

  it('rejects ids that are not Firestore-safe', () => {
    expect(() => serverProfileCreatePayload('bad id!', profile)).toThrow('Invalid user id.')
    expect(isSafeId('abc_ABC-123')).toBe(true)
    expect(isSafeId('a'.repeat(129))).toBe(false)
    expect(isSafeId('../etc/passwd')).toBe(false)
  })

  it('normalizes and validates profile inputs', () => {
    expect(validateServerProfileInput({ ...profile, name: '  Relay  ', lastLatencyMs: 12.6 })).toEqual({
      ok: true,
      value: { ...profile, name: 'Relay', lastLatencyMs: 13 }
    })
    expect(validateServerProfileInput({ ...profile, connectionMode: 'RADIO' }).ok).toBe(false)
    expect(validateServerProfileInput({ ...profile, lastLatencyMs: 60_001 }).ok).toBe(false)
    expect(validateServerProfileInput({ ...profile, name: 'x'.repeat(81) }).ok).toBe(false)
    expect(validateServerProfileInput({ ...profile, endpointUrl: 'ftp://example.com' }).ok).toBe(false)
  })
})

describe('Firestore copilotPrompt payloads', () => {
  it('creates and updates exactly the shared field sets', () => {
    const created = promptCreatePayload('user_ABC123', prompt)
    expect(sortedKeys(created)).toEqual([
      'preferredModel',
      'promptText',
      'rolePersona',
      'title',
      'userId'
    ])
    expect(created.userId).toBe('user_ABC123')

    const updated = promptUpdatePayload(prompt)
    expect(sortedKeys(updated)).toEqual([
      'preferredModel',
      'promptText',
      'rolePersona',
      'title'
    ])
    expect(updated).not.toHaveProperty('userId')
    expect(updated).not.toHaveProperty('createdAt')
    expect(updated).not.toHaveProperty('authToken')
  })

  it('enforces prompt field lengths', () => {
    expect(validatePromptInput({ ...prompt, title: '' }).ok).toBe(false)
    expect(validatePromptInput({ ...prompt, title: 'x'.repeat(121) }).ok).toBe(false)
    expect(validatePromptInput({ ...prompt, promptText: 'x'.repeat(5001) }).ok).toBe(false)
    expect(validatePromptInput({ ...prompt, rolePersona: 'x'.repeat(81) }).ok).toBe(false)
    expect(validatePromptInput({ ...prompt, preferredModel: 'x'.repeat(81) }).ok).toBe(false)
    expect(validatePromptInput(prompt).ok).toBe(true)
  })
})

describe('cloud-safe endpoint URLs', () => {
  it('accepts canonical http(s) endpoints', () => {
    expect(normalizeHttpUrl('https://example.com/api/v1')).toEqual({
      ok: true,
      value: 'https://example.com/api/v1'
    })
    expect(normalizeHttpUrl('http://192.168.1.24:3847/status')).toEqual({
      ok: true,
      value: 'http://192.168.1.24:3847/status'
    })
  })

  it('rejects queries, fragments, credentials, metadata hosts, and unsafe characters', () => {
    const rejected = [
      'https://example.com/?token=abc',
      'https://example.com/#section',
      'https://user:pass@example.com/',
      'http://169.254.169.254/latest/meta-data',
      'http://metadata.google.internal/',
      'http://0.0.0.0/',
      'javascript:alert(1)',
      'https://example.com/a b',
      'https://example.com/<script>',
      `https://example.com/${'a'.repeat(400)}`
    ]
    for (const raw of rejected) {
      expect(normalizeHttpUrl(raw).ok, raw).toBe(false)
    }
  })
})

describe('URL secret stripping', () => {
  it('drops fragments and sensitive query keys but keeps benign data', () => {
    const stripped = stripUrlSecrets(
      'https://app.t3.codes/session?id=42&token=SECRET&model=gemini#token=ANOTHER'
    )
    expect(stripped).toContain('id=42')
    expect(stripped).toContain('model=gemini')
    expect(stripped).not.toContain('SECRET')
    expect(stripped).not.toContain('ANOTHER')
    expect(stripped).not.toContain('#')
  })

  it('rejects non-http schemes and malformed values', () => {
    expect(stripUrlSecrets('javascript:alert(1)')).toBe('')
    expect(stripUrlSecrets('not a url')).toBe('')
    expect(coerceAddressInput('javascript:alert(1)')).toBeNull()
    expect(coerceAddressInput('app.t3.codes/session')).toBe('https://app.t3.codes/session')
    expect(normalizePairingUrl('file:///etc/passwd').ok).toBe(false)
    expect(normalizePairingUrl('https://app.t3.codes/#token=live').ok).toBe(true)
  })
})
