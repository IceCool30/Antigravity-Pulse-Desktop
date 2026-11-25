/**
 * Zero-trust validation shared by the cloud sync center and the phone bridge.
 * Every rule here mirrors `firestore.rules` in the Android repository.
 */

import { normalizeHex } from './theme'

export type ConnectionMode = 'HYBRID_BRIDGE' | 'DIRECT_TUNNEL' | 'PAIRING_TOKEN'
export const CONNECTION_MODES: readonly ConnectionMode[] = [
  'HYBRID_BRIDGE',
  'DIRECT_TUNNEL',
  'PAIRING_TOKEN'
]

export const MAX_URL_LENGTH = 300
export const MAX_NAME_LENGTH = 80
export const MAX_T3_URL_LENGTH = 2048
export const MAX_TOKEN_LENGTH = 512

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/
const CLOUD_URL_PATTERN =
  /^https?:\/\/[a-zA-Z0-9._:\-[\]]+(?::\d{1,5})?(?:\/[a-zA-Z0-9._~/%+\-]*)?$/
const BLOCKED_HOSTS = new Set([
  '0.0.0.0',
  '::',
  '[::]',
  'metadata.google.internal',
  'metadata.goog',
  'metadata'
])
const CONTROL_OR_UNSAFE = /[\s\u0000-\u001f\u007f<>"'`\\]/

export const BRIDGE_TOKEN_PATTERN = /^[a-f0-9]{64}$/i
const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

export interface Ok<T> {
  ok: true
  value: T
}

export interface Err {
  ok: false
  error: string
}

export type Result<T> = Ok<T> | Err

const ok = <T>(value: T): Ok<T> => ({ ok: true, value })
const err = (error: string): Err => ({ ok: false, error })

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.has(host)) return true
  if (host.startsWith('169.254.')) return true
  if (host === 'metadata.google.internal' || host.startsWith('metadata.')) return true
  return false
}

/**
 * Validates and canonicalizes a cloud-safe HTTP(S) endpoint: no userinfo,
 * query, fragment, whitespace, unsafe characters, metadata addresses, or
 * oversized paths. Output is guaranteed to satisfy the Firestore rule regex.
 */
export function normalizeHttpUrl(raw: unknown, maxLength: number = MAX_URL_LENGTH): Result<string> {
  if (typeof raw !== 'string') return err('Endpoint must be a URL string.')
  const trimmed = raw.trim()
  if (trimmed.length < 8) return err('Endpoint URL is too short.')
  if (trimmed.length > maxLength) return err(`Endpoint URL must be ${maxLength} characters or fewer.`)
  if (CONTROL_OR_UNSAFE.test(trimmed)) {
    return err('Endpoint contains spaces, quotes, backslashes, or control characters.')
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return err('Endpoint is not a valid URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return err('Endpoint must use http:// or https://.')
  }
  if (parsed.username || parsed.password) return err('Endpoint must not contain credentials.')
  if (parsed.search || parsed.hash) return err('Endpoint must not contain a query or fragment.')
  if (isBlockedHostname(parsed.hostname)) return err('Endpoint points at a blocked metadata address.')
  if (parsed.port && (Number(parsed.port) < 1 || Number(parsed.port) > 65535)) {
    return err('Endpoint port must be between 1 and 65535.')
  }
  if (!parsed.hostname) return err('Endpoint must include a hostname.')

  const pathname = parsed.pathname === '/' ? '' : parsed.pathname
  const canonical = `${parsed.origin}${pathname}`
  if (canonical.length > maxLength) return err('Endpoint URL is too long.')
  if (!CLOUD_URL_PATTERN.test(canonical)) {
    return err('Endpoint contains unsupported path characters.')
  }
  return ok(canonical)
}

/** Live T3 handshake URLs may carry a hash/query token; only http(s) is allowed. */
export function normalizePairingUrl(raw: unknown): Result<string> {
  if (typeof raw !== 'string') return err('Pairing URL must be a string.')
  const trimmed = raw.trim()
  if (trimmed.length < 8) return err('Pairing URL is too short.')
  if (trimmed.length > MAX_T3_URL_LENGTH) return err('Pairing URL is too long.')
  if (CONTROL_OR_UNSAFE.test(trimmed)) return err('Pairing URL contains unsafe characters.')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return err('Pairing URL is not valid.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return err('Pairing URL must use http:// or https://.')
  }
  if (parsed.username || parsed.password) return err('Pairing URL must not contain credentials.')
  if (isBlockedHostname(parsed.hostname)) return err('Pairing URL points at a blocked metadata address.')
  return ok(trimmed)
}

/**
 * Persistable form of a T3 (or any) URL: drops the fragment and any
 * token/key/secret/auth/session query parameters. Never store handshake tokens.
 */
export function stripUrlSecrets(raw: string): string {
  try {
    const parsed = new URL(raw)
    parsed.hash = ''
    const sensitive = /(token|key|secret|auth|session|password|bearer)/i
    for (const key of [...parsed.searchParams.keys()]) {
      if (sensitive.test(key)) parsed.searchParams.delete(key)
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

export interface ServerProfileInput {
  name: string
  endpointUrl: string
  connectionMode: ConnectionMode | string
  keepAlivePinned: boolean
  lastLatencyMs: number
}

export interface NormalizedServerProfile {
  name: string
  endpointUrl: string
  connectionMode: ConnectionMode
  keepAlivePinned: boolean
  lastLatencyMs: number
}

export function validateServerProfileInput(input: ServerProfileInput): Result<NormalizedServerProfile> {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name.length < 1) return err('Profile name is required.')
  if (name.length > MAX_NAME_LENGTH) return err(`Profile name must be ${MAX_NAME_LENGTH} characters or fewer.`)
  const url = normalizeHttpUrl(input.endpointUrl)
  if (!url.ok) return url
  if (!CONNECTION_MODES.includes(input.connectionMode as ConnectionMode)) {
    return err('Choose a valid connection mode.')
  }
  const latency = Math.round(Number(input.lastLatencyMs))
  if (!Number.isFinite(latency) || latency < 0 || latency > 60_000) {
    return err('Latency must be between 0 and 60000 ms.')
  }
  return ok({
    name,
    endpointUrl: url.value,
    connectionMode: input.connectionMode as ConnectionMode,
    keepAlivePinned: input.keepAlivePinned === true,
    lastLatencyMs: latency
  })
}

/** Create payload fields, excluding timestamps (added with serverTimestamp()). */
export function serverProfileCreatePayload(uid: string, profile: NormalizedServerProfile) {
  if (!isSafeId(uid)) throw new Error('Invalid user id.')
  return {
    userId: uid,
    name: profile.name,
    endpointUrl: profile.endpointUrl,
    connectionMode: profile.connectionMode,
    authToken: '',
    keepAlivePinned: profile.keepAlivePinned,
    lastLatencyMs: profile.lastLatencyMs
  }
}

/** Update payload: immutable identity and createdAt are never resent. */
export function serverProfileUpdatePayload(profile: NormalizedServerProfile) {
  return {
    name: profile.name,
    endpointUrl: profile.endpointUrl,
    connectionMode: profile.connectionMode,
    authToken: '',
    keepAlivePinned: profile.keepAlivePinned,
    lastLatencyMs: profile.lastLatencyMs
  }
}

export interface PromptInput {
  title: string
  promptText: string
  rolePersona: string
  preferredModel: string
}

export interface NormalizedPrompt {
  title: string
  promptText: string
  rolePersona: string
  preferredModel: string
}

export function validatePromptInput(input: PromptInput): Result<NormalizedPrompt> {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const promptText = typeof input.promptText === 'string' ? input.promptText.trim() : ''
  const rolePersona = typeof input.rolePersona === 'string' ? input.rolePersona.trim() : ''
  const preferredModel = typeof input.preferredModel === 'string' ? input.preferredModel.trim() : ''
  if (title.length < 1) return err('Prompt title is required.')
  if (title.length > 120) return err('Prompt title must be 120 characters or fewer.')
  if (promptText.length < 1) return err('Prompt body is required.')
  if (promptText.length > 5000) return err('Prompt body must be 5000 characters or fewer.')
  if (rolePersona.length < 1) return err('Role persona is required.')
  if (rolePersona.length > 80) return err('Role persona must be 80 characters or fewer.')
  if (preferredModel.length < 1) return err('Preferred model is required.')
  if (preferredModel.length > 80) return err('Preferred model must be 80 characters or fewer.')
  return ok({ title, promptText, rolePersona, preferredModel })
}

export function promptCreatePayload(uid: string, prompt: NormalizedPrompt) {
  if (!isSafeId(uid)) throw new Error('Invalid user id.')
  return {
    userId: uid,
    title: prompt.title,
    promptText: prompt.promptText,
    rolePersona: prompt.rolePersona,
    preferredModel: prompt.preferredModel
  }
}

export function promptUpdatePayload(prompt: NormalizedPrompt) {
  return {
    title: prompt.title,
    promptText: prompt.promptText,
    rolePersona: prompt.rolePersona,
    preferredModel: prompt.preferredModel
  }
}

/** Stable local secret key for a profile; never written to Firestore. */
export function profileSecretKey(profileId: string): string {
  return `profile:${profileId}`
}

export interface PairingUris {
  deepLink: string
  fallbackUrl: string
}

/**
 * Builds the exact payload Antigravity Pulse Android's QR scanner expects:
 *   antigravity://pair?url=http://<ip>:<port>&token=<token>&name=<encoded-hostname>
 * with the browser fallback `http://<ip>:<port>/#token=<token>`.
 */
export function buildPairingUris(params: {
  ip: string
  port: number
  token: string
  hostName: string
}): Result<PairingUris> {
  const ip = params.ip.trim()
  if (!IPV4_PATTERN.test(ip)) return err('Pairing address must be a valid IPv4 address.')
  const port = Math.round(Number(params.port))
  if (!Number.isFinite(port) || port < 1024 || port > 65535) {
    return err('Bridge port must be between 1024 and 65535.')
  }
  const token = params.token.trim()
  if (token.length < 16 || token.length > MAX_TOKEN_LENGTH) return err('Invalid bridge token.')
  if (!/^[a-zA-Z0-9._~-]+$/.test(token)) return err('Bridge token contains unsafe characters.')
  const hostName = (params.hostName || 'Antigravity Pulse')
    .replace(/[\u0000-\u001f\u007f<>"]/g, '')
    .trim()
    .slice(0, 80)
  if (!hostName) return err('Host name is required.')

  const base = `http://${ip}:${port}`
  return ok({
    deepLink: `antigravity://pair?url=${base}&token=${token}&name=${encodeURIComponent(hostName)}`,
    fallbackUrl: `${base}/#token=${token}`
  })
}

/**
 * Turns an address-bar entry into a safe navigable URL. Bare hosts get https://;
 * anything with an unsupported scheme returns null.
 */
export function coerceAddressInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > MAX_T3_URL_LENGTH) return null
  if (CONTROL_OR_UNSAFE.test(trimmed)) return null
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (isBlockedHostname(parsed.hostname)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function isAllowedExternalUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

const AUTH_POPUP_HOSTS = new Set([
  'accounts.google.com',
  'accounts.youtube.com',
  'appleid.apple.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'login.microsoftonline.com',
  'login.live.com',
  'vercel.com',
  'supabase.com'
])

const AUTH_POPUP_SUFFIXES = [
  '.google.com',
  '.googleapis.com',
  '.googleusercontent.com',
  '.supabase.co',
  '.supabase.com',
  '.vercel.com',
  '.github.com',
  '.t3.codes',
  '.clerk.accounts.dev',
  '.firebaseapp.com',
  '.web.app',
  '.auth0.com',
  '.workos.com'
]

/** True for popup destinations that must stay in a shared-session child window. */
export function isAllowedAuthPopup(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    if (AUTH_POPUP_HOSTS.has(host) || host.startsWith('accounts.google.')) return true
    return AUTH_POPUP_SUFFIXES.some((suffix) => host.endsWith(suffix))
  } catch {
    return false
  }
}

export function normalizeAccentOverride(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  return normalizeHex(raw)
}
