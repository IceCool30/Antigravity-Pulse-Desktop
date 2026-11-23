import { shell } from 'electron'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { GoogleTokens } from '@shared/ipc'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPES = 'openid email profile'
const TIMEOUT_MS = 5 * 60_000

interface PendingSession {
  cancel: (reason: string) => void
}

interface TokenResponse {
  id_token?: string
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

function decodeIdentity(idToken: string): {
  email: string | null
  name: string | null
  picture: string | null
} {
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return { email: null, name: null, picture: null }
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
    return {
      email: typeof json.email === 'string' ? json.email : null,
      name: typeof json.name === 'string' ? json.name : null,
      picture: typeof json.picture === 'string' ? json.picture : null
    }
  } catch {
    return { email: null, name: null, picture: null }
  }
}

function resultPage(title: string, message: string, ok: boolean): string {
  const accent = ok ? '#FFC799' : '#EF4444'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} · Antigravity Pulse</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #000; color: #fff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
  .card { width: min(440px, calc(100vw - 40px)); background: linear-gradient(180deg, #111 0%, #070707 100%);
    border: 1px solid rgba(255,255,255,.13); border-radius: 18px; padding: 32px; text-align: center;
    box-shadow: 0 24px 64px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06); }
  .mark { width: 44px; height: 44px; margin: 0 auto 18px; border-radius: 50%; position: relative;
    border: 1px solid ${accent}; box-shadow: 0 0 30px ${accent}55; }
  .mark::after { content: ""; position: absolute; inset: 11px; border-radius: 50%; background: ${accent}; opacity: .9; }
  h1 { font-size: 20px; letter-spacing: -.02em; margin: 0 0 10px; }
  p { color: rgba(255,255,255,.72); line-height: 1.6; font-size: 14px; margin: 0 0 22px; }
  .hint { font: 11px/1.6 ui-monospace, "Cascadia Code", monospace; color: ${accent}; letter-spacing: .08em;
    text-transform: uppercase; }
</style></head><body><div class="card"><div class="mark"></div><h1>${title}</h1><p>${message}</p>
<p class="hint">Antigravity Pulse Desktop · you can close this tab</p></div>
<script>setTimeout(() => window.close(), 2200)</script></body></html>`
}

function respondHtml(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'close',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  })
  response.end(html)
}

/**
 * System-browser loopback OAuth with PKCE. The embedded webview never sees the
 * consent screen; tokens are exchanged in main and handed to Firebase Auth in
 * the sandboxed renderer via `signInWithCredential`.
 */
export class GoogleAuthBroker {
  private pending: PendingSession | null = null

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret)
  }

  private get clientId(): string {
    return (import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID ?? process.env.MAIN_VITE_GOOGLE_CLIENT_ID ?? '').trim()
  }

  private get clientSecret(): string {
    return (
      import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET ??
      process.env.MAIN_VITE_GOOGLE_CLIENT_SECRET ??
      ''
    ).trim()
  }

  cancel(reason = 'Google sign-in cancelled.'): void {
    const pending = this.pending
    this.pending = null
    pending?.cancel(reason)
  }

  signIn(): Promise<GoogleTokens> {
    if (!this.clientId || !this.clientSecret) {
      return Promise.reject(
        new Error(
          'Google OAuth is not configured. Add MAIN_VITE_GOOGLE_CLIENT_ID and MAIN_VITE_GOOGLE_CLIENT_SECRET to .env, then rebuild.'
        )
      )
    }
    this.cancel('A newer Google sign-in started.')

    return new Promise<GoogleTokens>((resolve, reject) => {
      const verifier = base64url(randomBytes(48))
      const challenge = base64url(createHash('sha256').update(verifier).digest())
      const state = base64url(randomBytes(32))

      let server: Server | null = null
      let timer: NodeJS.Timeout | null = null
      let settled = false

      const settle = (error: Error | null, tokens?: GoogleTokens): void => {
        if (settled) return
        settled = true
        this.pending = null
        if (timer) clearTimeout(timer)
        try {
          server?.closeAllConnections?.()
          server?.close()
        } catch {
          /* socket already closed */
        }
        if (error) reject(error)
        else if (tokens) resolve(tokens)
      }

      this.pending = { cancel: (reason) => settle(new Error(reason)) }

      server = createServer((request, response) => {
        void (async () => {
          const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
          if (requestUrl.pathname !== '/callback') {
            response.writeHead(404, { Connection: 'close' })
            response.end('Not found')
            return
          }

          const error = requestUrl.searchParams.get('error')
          if (error) {
            respondHtml(
              response,
              400,
              resultPage('Sign-in cancelled', 'Google did not finish the handshake. Nothing was stored.', false)
            )
            settle(new Error(error === 'access_denied' ? 'Google sign-in was declined.' : 'Google sign-in failed.'))
            return
          }

          const receivedState = requestUrl.searchParams.get('state') ?? ''
          const stateOk =
            receivedState.length === state.length &&
            timingSafeEqual(Buffer.from(receivedState), Buffer.from(state))
          if (!stateOk) {
            respondHtml(
              response,
              400,
              resultPage('State check failed', 'The callback was not started by this app. Try again.', false)
            )
            settle(new Error('OAuth state verification failed.'))
            return
          }

          const code = requestUrl.searchParams.get('code')
          if (!code) {
            respondHtml(response, 400, resultPage('Missing code', 'Google did not return an authorization code.', false))
            settle(new Error('Google did not return an authorization code.'))
            return
          }

          const redirectUri = `http://127.0.0.1:${(server?.address() as AddressInfo | null)?.port ?? 0}/callback`
          try {
            const body = new URLSearchParams({
              code,
              client_id: this.clientId,
              client_secret: this.clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
              code_verifier: verifier
            })
            const tokenResponse = await fetch(TOKEN_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json'
              },
              body,
              signal: AbortSignal.timeout(20_000)
            })
            const payload = (await tokenResponse.json()) as TokenResponse
            if (!tokenResponse.ok || payload.error || !payload.id_token) {
              const detail =
                typeof payload.error_description === 'string'
                  ? payload.error_description.slice(0, 240)
                  : 'The token exchange was rejected.'
              respondHtml(
                response,
                502,
                resultPage('Sign-in could not complete', 'The token exchange failed. Return to the app and try again.', false)
              )
              settle(new Error(`Google token exchange failed: ${detail}`))
              return
            }
            const identity = decodeIdentity(payload.id_token)
            respondHtml(
              response,
              200,
              resultPage(
                'Signed in with Google',
                'Antigravity Pulse now has an ID token for Firebase Auth. This browser tab can close.',
                true
              )
            )
            settle(null, {
              idToken: payload.id_token,
              accessToken: payload.access_token ?? '',
              expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
              email: identity.email,
              name: identity.name,
              picture: identity.picture
            })
          } catch {
            respondHtml(
              response,
              502,
              resultPage('Network error', 'Could not reach Google. Check your connection and try again.', false)
            )
            settle(new Error('Could not reach Google to exchange the sign-in code.'))
          }
        })().catch(() => {
          if (!response.headersSent) response.writeHead(500, { Connection: 'close' })
          response.end('Sign-in error')
          settle(new Error('Unexpected error during Google sign-in.'))
        })
      })

      server.on('error', (error) => {
        settle(new Error(`Could not start the local OAuth callback: ${error.message}`))
      })

      timer = setTimeout(() => {
        settle(new Error('Google sign-in timed out. Start it again from the app.'))
      }, TIMEOUT_MS)

      server.listen(0, '127.0.0.1', () => {
        if (settled) return
        const address = server?.address() as AddressInfo | null
        if (!address || typeof address === 'string') {
          settle(new Error('Could not allocate a local OAuth callback port.'))
          return
        }
        const redirectUri = `http://127.0.0.1:${address.port}/callback`
        const authUrl = new URL(AUTH_ENDPOINT)
        authUrl.searchParams.set('client_id', this.clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', SCOPES)
        authUrl.searchParams.set('state', state)
        authUrl.searchParams.set('code_challenge', challenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')
        authUrl.searchParams.set('prompt', 'select_account')
        authUrl.searchParams.set('access_type', 'online')
        void shell.openExternal(authUrl.toString()).catch(() => {
          settle(new Error('Could not open your default browser for Google sign-in.'))
        })
      })
    })
  }
}
