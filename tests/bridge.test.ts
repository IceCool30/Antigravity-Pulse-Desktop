import { createServer } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { PhoneBridge } from '../src/main/bridge'
import type { SettingsStore } from '../src/main/settings-store'
import type { RuntimeSnapshot } from '../src/shared/ipc'
import { DEFAULT_SETTINGS } from '../src/shared/settings'
import type { WorkspaceId } from '../src/shared/workspaces'

const TOKEN = 'a1'.repeat(32)
const HOST = 'QA-DESKTOP'

interface FakeSettingsOptions {
  port: number
  enabled: boolean
}

function fakeSettings(options: FakeSettingsOptions): SettingsStore {
  return {
    get: () => ({ ...DEFAULT_SETTINGS, bridgePort: options.port, bridgeEnabled: options.enabled }),
    ensureBridgeToken: async () => TOKEN,
    regenerateBridgeToken: async () => TOKEN,
    setSecret: async () => undefined,
    getSecret: () => null,
    deleteSecret: async () => undefined
  } as unknown as SettingsStore
}

function runtime(): RuntimeSnapshot {
  return {
    activeId: 't3',
    secondaryId: null,
    states: {
      t3: {
        id: 't3',
        mounted: true,
        loading: false,
        crashed: false,
        title: 'T3 Code Web',
        url: 'https://app.t3.codes/session#token=RAW',
        canGoBack: false,
        canGoForward: false,
        memoryBytes: 1024,
        lastActiveAt: Date.now(),
        zoom: 0,
        error: null
      }
    },
    appMemoryBytes: 2048,
    split: false,
    zen: false,
    pinnedCount: 1,
    startedAt: Date.now()
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

function waitForMessage(socket: WebSocket, predicate: (value: Record<string, unknown>) => boolean) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket message timeout')), 3000)
    socket.once('message', (raw) => {
      clearTimeout(timer)
      try {
        const parsed = JSON.parse(raw.toString()) as Record<string, unknown>
        if (!predicate(parsed)) {
          reject(new Error(`Unexpected message: ${raw.toString()}`))
          return
        }
        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    })
  })
}

const bridges: PhoneBridge[] = []

afterEach(async () => {
  await Promise.all(bridges.splice(0).map((bridge) => bridge.destroy()))
})

describe('phone bridge integration', () => {
  it('generates a bearer-protected pairing endpoint and QR code', async () => {
    const port = await freePort()
    const onActivate = vi.fn()
    const onShare = vi.fn()
    const bridge = new PhoneBridge({
      settings: fakeSettings({ port, enabled: true }),
      hostName: HOST,
      appVersion: '1.0.0',
      getRuntime: runtime,
      getShareInfo: () => ({ title: 'T3 Code Web', url: 'https://app.t3.codes/#token=RAW' }),
      onActivate,
      onShare,
      onStatus: () => undefined
    })
    bridges.push(bridge)

    const status = await bridge.start(port)
    expect(status.running).toBe(true)
    expect(status.error).toBeNull()
    expect(status.port).toBe(port)
    expect(status.tokenPreview).toBe(`••••••••${TOKEN.slice(-4)}`)
    expect(status.fingerprint).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/)
    expect(status.deepLink).toMatch(
      new RegExp(`^antigravity://pair\\?url=http://\\d+\\.\\d+\\.\\d+\\.\\d+:${port}&token=${TOKEN}&name=${HOST}`)
    )
    expect(status.fallbackUrl).toMatch(new RegExp(`^http://\\d+\\.\\d+\\.\\d+\\.\\d+:${port}/#token=${TOKEN}$`))
    expect(status.qrDataUrl?.startsWith('data:image/png;base64,')).toBe(true)

    const base = `http://127.0.0.1:${port}`
    const health = await fetch(`${base}/api/health`)
    expect(health.status).toBe(200)
    expect((await health.json()) as object).toMatchObject({ ok: true, app: 'Antigravity Pulse', host: HOST })

    const unauthorized = await fetch(`${base}/api/status`)
    expect(unauthorized.status).toBe(401)

    const headers = { Authorization: `Bearer ${TOKEN}` }
    const details = await fetch(`${base}/api/status`, { headers })
    expect(details.status).toBe(200)
    const detailsBody = (await details.json()) as {
      active: { id: string; url: string }
      workspaces: unknown[]
    }
    expect(detailsBody.active.id).toBe('t3')
    expect(detailsBody.active.url).not.toContain('RAW')
    expect(detailsBody.workspaces).toHaveLength(9)

    const activated = await fetch(`${base}/api/activate`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'gemini' })
    })
    expect(activated.status).toBe(200)
    expect(onActivate).toHaveBeenCalledWith('gemini')

    const shared = await fetch(`${base}/api/share`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Link', text: 'https://example.com' })
    })
    expect(shared.status).toBe(200)
    expect(onShare).toHaveBeenCalledWith({ title: 'Link', text: 'https://example.com' })

    const landing = await fetch(`${base}/`)
    expect(landing.status).toBe(200)
    expect(await landing.text()).toContain('Phone Companion')

    const stopped = await bridge.stop()
    expect(stopped.running).toBe(false)
    expect(stopped.deepLink).toBeNull()
  })

  it('accepts an authenticated WebSocket device and answers ping', async () => {
    const port = await freePort()
    const bridge = new PhoneBridge({
      settings: fakeSettings({ port, enabled: true }),
      hostName: HOST,
      appVersion: '1.0.0',
      getRuntime: runtime,
      getShareInfo: () => ({ title: 'Home', url: null }),
      onActivate: vi.fn(),
      onShare: vi.fn(),
      onStatus: () => undefined
    })
    bridges.push(bridge)
    await bridge.start(port)

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${TOKEN}&name=Test%20Phone`)
    const hello = await waitForMessage(socket, (value) => value['type'] === 'hello')
    expect(hello['host']).toBe(HOST)
    expect((hello['workspaces'] as unknown[]).length).toBe(9)
    expect(bridge.status().devices[0]?.label).toBe('Test Phone')

    const sentAt = Date.now() - 25
    const pongPromise = waitForMessage(socket, (value) => value['type'] === 'pong')
    socket.send(JSON.stringify({ type: 'ping', t: sentAt }))
    const pong = await pongPromise
    expect(pong['t']).toBe(sentAt)
    expect(bridge.status().devices[0]?.pingMs).toBeGreaterThanOrEqual(0)

    socket.close()
  })

  it('refuses a WebSocket upgrade with the wrong token', async () => {
    const port = await freePort()
    const bridge = new PhoneBridge({
      settings: fakeSettings({ port, enabled: true }),
      hostName: HOST,
      appVersion: '1.0.0',
      getRuntime: runtime,
      getShareInfo: () => ({ title: 'Home', url: null }),
      onActivate: vi.fn(),
      onShare: vi.fn(),
      onStatus: () => undefined
    })
    bridges.push(bridge)
    await bridge.start(port)

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=wrong`)
    const error = await new Promise<Error>((resolve) => socket.once('error', resolve))
    expect(error.message).toContain('401')
  })
})
