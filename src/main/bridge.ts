import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import type { Duplex } from 'node:stream'
import { toDataURL } from 'qrcode'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import type { BridgeAddress, BridgeDevice, BridgeStatus, RuntimeSnapshot } from '@shared/ipc'
import { buildPairingUris, stripUrlSecrets } from '@shared/validation'
import { WORKSPACES, isWorkspaceId, type WorkspaceId } from '@shared/workspaces'
import type { SettingsStore } from './settings-store'

const APP_NAME = 'Antigravity Pulse'
const DEFAULT_PORT = 3847
const MAX_BODY_BYTES = 16 * 1024
const MAX_DEVICES = 12
const FAILED_AUTH_LIMIT = 20
const AUTH_WINDOW_MS = 60_000
const HEARTBEAT_MS = 15_000
const STATUS_BROADCAST_MS = 3_000
const STATUS_PUBLISH_MS = 250

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

export interface PhoneBridgeOptions {
  settings: SettingsStore
  hostName: string
  appVersion: string
  getRuntime: () => RuntimeSnapshot
  getShareInfo: () => { title: string; url: string | null }
  onActivate: (id: WorkspaceId) => void
  onShare: (payload: { title?: string; text: string }) => void
  onStatus: (status: BridgeStatus) => void
}

export interface BridgeApiStatus {
  ok: true
  app: string
  version: string
  host: string
  startedAt: number | null
  active: { id: WorkspaceId | null; title: string; url: string | null }
  workspaces: Array<{
    id: WorkspaceId
    name: string
    shortName: string
    mounted: boolean
    loading: boolean
    crashed: boolean
    memoryBytes: number
  }>
  devices: BridgeDevice[]
  appMemoryBytes: number
}

interface Client {
  socket: WebSocket
  isAlive: boolean
  device: BridgeDevice
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function isRfc1918(address: string): boolean {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10))
  const a = parts[0] ?? -1
  const b = parts[1] ?? -1
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function isTailscale(address: string, interfaceName: string): boolean {
  return /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address) || /tailscale/i.test(interfaceName)
}

function discoverAddresses(): BridgeAddress[] {
  const seen = new Set<string>()
  const found: BridgeAddress[] = []
  for (const [name, infos] of Object.entries(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      const address = info.address
      if (!IPV4_PATTERN.test(address) || seen.has(address)) continue
      seen.add(address)
      const label: BridgeAddress['label'] = isTailscale(address, name)
        ? 'Tailscale'
        : isRfc1918(address)
          ? 'LAN'
          : 'Interface'
      found.push({ address, label })
    }
  }
  const rank = { LAN: 0, Tailscale: 1, Interface: 2 } as const
  return found.sort((left, right) => rank[left.label] - rank[right.label] || left.address.localeCompare(right.address))
}

function friendlyError(error: unknown, port: number): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
  if (code === 'EADDRINUSE') return `Port ${port} is already in use. Choose another port.`
  if (code === 'EACCES' || code === 'EPERM') {
    return `Permission denied binding port ${port}. Try a port above 1024 or check your firewall.`
  }
  const message = error instanceof Error ? error.message : ''
  return message ? `The phone bridge could not start: ${message.slice(0, 180)}` : 'The phone bridge could not start.'
}

function rawToString(raw: RawData): string {
  if (typeof raw === 'string') return raw
  if (Buffer.isBuffer(raw)) return raw.toString('utf8')
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8')
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8')
  return ''
}

/**
 * Opt-in local HTTP + WebSocket bridge. It never writes a token to disk itself
 * (SettingsStore owns the DPAPI-backed vault) and never logs credentials.
 */
export class PhoneBridge {
  private readonly options: PhoneBridgeOptions
  private token = ''
  private server: Server | null = null
  private wss: WebSocketServer | null = null
  private readonly clients = new Set<Client>()
  private readonly failedAuth = new Map<string, { count: number; resetAt: number }>()
  private heartbeatTimer: NodeJS.Timeout | null = null
  private statusTimer: NodeJS.Timeout | null = null
  private publishTimer: NodeJS.Timeout | null = null
  private running = false
  private starting = false
  private destroyed = false
  private port = DEFAULT_PORT
  private addresses: BridgeAddress[] = []
  private deepLink: string | null = null
  private fallbackUrl: string | null = null
  private qrDataUrl: string | null = null
  private error: string | null = null
  private startedAt: number | null = null
  private lastStatusJson = ''

  constructor(options: PhoneBridgeOptions) {
    this.options = options
    this.port = this.normalizePort(options.settings.get().bridgePort)
    this.addresses = discoverAddresses()
    // Prime the token so the pairing card can show a fingerprint before start.
    void options.settings
      .ensureBridgeToken()
      .then((token) => {
        this.token = token
        this.publishStatus()
      })
      .catch(() => {
        /* start() retries and surfaces a friendly error */
      })
  }

  status(): BridgeStatus {
    const settings = this.options.settings.get()
    return {
      enabled: settings.bridgeEnabled,
      running: this.running,
      starting: this.starting,
      port: this.running || this.starting ? this.port : settings.bridgePort,
      addresses: this.addresses.map((address) => ({ ...address })),
      deepLink: this.running ? this.deepLink : null,
      fallbackUrl: this.running ? this.fallbackUrl : null,
      qrDataUrl: this.running ? this.qrDataUrl : null,
      tokenPreview: this.token ? `••••••••${this.token.slice(-4)}` : '',
      fingerprint: this.token ? this.fingerprint(this.token) : '',
      devices: [...this.clients].map((client) => ({ ...client.device })),
      error: this.error,
      startedAt: this.startedAt
    }
  }

  async start(port?: number): Promise<BridgeStatus> {
    if (this.destroyed) return this.status()
    const requested = this.normalizePort(port)
    if (this.running && this.port === requested) return this.status()
    if (this.running) return this.restart(requested)

    this.starting = true
    this.error = null
    this.flushStatus()

    try {
      this.token = await this.options.settings.ensureBridgeToken()
      this.port = requested
      this.addresses = discoverAddresses()
      this.failedAuth.clear()

      const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_BODY_BYTES })
      wss.on('connection', (socket, request) => this.onConnection(socket, request))
      this.wss = wss

      const server = createServer((request, response) => {
        this.handleRequest(request, response)
      })
      server.on('upgrade', (request, socket, head) => {
        this.handleUpgrade(request, socket, head)
      })
      this.server = server

      await new Promise<void>((resolve, reject) => {
        const cleanup = (): void => {
          server.off('error', onError)
          server.off('listening', onListening)
        }
        const onError = (error: Error): void => {
          cleanup()
          reject(error)
        }
        const onListening = (): void => {
          cleanup()
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(this.port, '0.0.0.0')
      })

      await this.refreshPairing()
      this.startedAt = Date.now()
      this.running = true
      this.starting = false
      this.startTimers()
      this.flushStatus()
      console.info('[pulse] phone bridge listening')
      return this.status()
    } catch (error) {
      this.running = false
      this.starting = false
      this.error = friendlyError(error, requested)
      const server = this.server
      this.server = null
      this.wss = null
      if (server) await this.closeServer(server)
      this.flushStatus()
      return this.status()
    }
  }

  async stop(): Promise<BridgeStatus> {
    this.stopTimers()
    for (const client of [...this.clients]) {
      try {
        client.socket.terminate()
      } catch {
        /* already gone */
      }
    }
    this.clients.clear()
    try {
      this.wss?.close()
    } catch {
      /* already closed */
    }
    this.wss = null
    const server = this.server
    this.server = null
    if (server) await this.closeServer(server)

    this.running = false
    this.starting = false
    this.startedAt = null
    this.deepLink = null
    this.fallbackUrl = null
    this.qrDataUrl = null
    this.error = null
    this.lastStatusJson = ''
    this.flushStatus()
    return this.status()
  }

  async restart(port?: number): Promise<BridgeStatus> {
    await this.stop()
    this.port = this.normalizePort(port)
    this.addresses = discoverAddresses()
    return this.start(this.port)
  }

  async regenerateToken(): Promise<BridgeStatus> {
    if (this.destroyed) return this.status()
    this.token = await this.options.settings.regenerateBridgeToken()
    await this.refreshPairing()
    this.lastStatusJson = ''
    this.flushStatus()
    return this.status()
  }

  async shareActive(): Promise<void> {
    const info = this.options.getShareInfo()
    const cleaned = info.url ? stripUrlSecrets(info.url) : ''
    const text = cleaned ? `${info.title}\n${cleaned}` : info.title
    this.options.onShare({ title: info.title, text })
    this.broadcast({ type: 'shared', title: info.title, text, at: Date.now() })
  }

  broadcast(payload: unknown): void {
    const text = this.serialize(payload)
    if (!text) return
    for (const client of this.clients) {
      if (client.socket.readyState !== WebSocket.OPEN) continue
      try {
        client.socket.send(text)
      } catch {
        /* drop the message for a dead socket */
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    void this.stop()
  }

  /* ── internals ─────────────────────────────────────────────────────────── */

  private normalizePort(port?: number): number {
    const fallback = this.options.settings.get().bridgePort
    const candidate = typeof port === 'number' ? port : fallback
    const rounded = Math.round(candidate)
    return Number.isFinite(rounded) && rounded >= 1024 && rounded <= 65535 ? rounded : DEFAULT_PORT
  }

  private fingerprint(token: string): string {
    const hex = createHash('sha256').update(token).digest('hex').slice(0, 8).toUpperCase()
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`
  }

  private async refreshPairing(): Promise<void> {
    const first = this.addresses[0]?.address
    if (!first || !this.token) {
      this.deepLink = null
      this.fallbackUrl = null
      this.qrDataUrl = null
      return
    }
    const uris = buildPairingUris({
      ip: first,
      port: this.port,
      token: this.token,
      hostName: this.options.hostName
    })
    if (!uris.ok) {
      this.deepLink = null
      this.fallbackUrl = null
      this.qrDataUrl = null
      return
    }
    this.deepLink = uris.value.deepLink
    this.fallbackUrl = uris.value.fallbackUrl
    try {
      this.qrDataUrl = await toDataURL(uris.value.deepLink, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
    } catch {
      this.qrDataUrl = null
    }
  }

  private async closeServer(server: Server): Promise<void> {
    await new Promise<void>((resolve) => {
      let done = false
      const finish = (): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(finish, 2_000)
      timer.unref?.()
      server.close(finish)
      server.closeAllConnections?.()
    })
  }

  private apiStatus(): BridgeApiStatus {
    const runtime = this.options.getRuntime()
    const activeId = runtime.activeId
    const activeState = activeId ? runtime.states[activeId] : undefined
    const activeTitle =
      activeState?.title ??
      (activeId ? (WORKSPACES.find((workspace) => workspace.id === activeId)?.name ?? activeId) : 'Home')
    const activeUrl = activeState?.url ? stripUrlSecrets(activeState.url) || null : null
    return {
      ok: true,
      app: APP_NAME,
      version: this.options.appVersion,
      host: this.options.hostName,
      startedAt: this.startedAt,
      active: { id: activeId, title: activeTitle, url: activeUrl },
      workspaces: WORKSPACES.map((workspace) => {
        const state = runtime.states[workspace.id]
        return {
          id: workspace.id,
          name: workspace.name,
          shortName: workspace.shortName,
          mounted: state?.mounted ?? false,
          loading: state?.loading ?? false,
          crashed: state?.crashed ?? false,
          memoryBytes: state?.memoryBytes ?? 0
        }
      }),
      devices: [...this.clients].map((client) => ({ ...client.device })),
      appMemoryBytes: runtime.appMemoryBytes
    }
  }

  private health(): { ok: true; app: string; version: string; host: string } {
    return { ok: true, app: APP_NAME, version: this.options.appVersion, host: this.options.hostName }
  }

  private setHeaders(response: ServerResponse): void {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'"
    )
  }

  private json(response: ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body)
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(payload)
  }

  private clientIp(request: IncomingMessage): string {
    // Never trust client-supplied forwarding headers for the rate limiter.
    return request.socket.remoteAddress ?? 'unknown'
  }

  private checkRateLimit(ip: string): boolean {
    const entry = this.failedAuth.get(ip)
    if (!entry) return true
    if (Date.now() >= entry.resetAt) {
      this.failedAuth.delete(ip)
      return true
    }
    return entry.count < FAILED_AUTH_LIMIT
  }

  private recordFailure(ip: string): void {
    const now = Date.now()
    const entry = this.failedAuth.get(ip)
    if (!entry || now >= entry.resetAt) this.failedAuth.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS })
    else entry.count += 1
  }

  private tokenFromRequest(request: IncomingMessage, url: URL): string | null {
    const header = request.headers.authorization
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7).trim() || null
    }
    return url.searchParams.get('token')
  }

  private authorize(token: string | null): boolean {
    if (!token || !this.token || token.length !== this.token.length) return false
    try {
      return timingSafeEqual(Buffer.from(token), Buffer.from(this.token))
    } catch {
      return false
    }
  }

  private async readBody(request: IncomingMessage): Promise<Record<string, unknown> | null> {
    const chunks: Buffer[] = []
    let size = 0
    for await (const raw of request as AsyncIterable<unknown>) {
      const buffer = Buffer.isBuffer(raw)
        ? raw
        : typeof raw === 'string'
          ? Buffer.from(raw)
          : Buffer.from(raw as Uint8Array)
      size += buffer.length
      if (size > MAX_BODY_BYTES) return null
      chunks.push(buffer)
    }
    try {
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    void this.routeRequest(request, response).catch(() => {
      if (!response.headersSent) this.json(response, 500, { error: 'internal' })
      else {
        try {
          response.end()
        } catch {
          /* already closed */
        }
      }
    })
  }

  private async routeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    this.setHeaders(response)
    let url: URL
    try {
      url = new URL(request.url ?? '/', 'http://localhost')
    } catch {
      this.json(response, 400, { error: 'bad_request' })
      return
    }
    const path = url.pathname

    if (path === '/' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(this.landingPage())
      return
    }
    if (path === '/api/health' && request.method === 'GET') {
      this.json(response, 200, this.health())
      return
    }
    if (!path.startsWith('/api/')) {
      this.json(response, 404, { error: 'not_found' })
      return
    }

    const ip = this.clientIp(request)
    if (!this.checkRateLimit(ip)) {
      response.setHeader('Retry-After', '60')
      this.json(response, 429, { error: 'rate_limited' })
      return
    }
    if (!this.authorize(this.tokenFromRequest(request, url))) {
      this.recordFailure(ip)
      response.setHeader('WWW-Authenticate', 'Bearer')
      this.json(response, 401, { error: 'unauthorized' })
      return
    }
    this.failedAuth.delete(ip)

    if (path === '/api/status' || path === '/api/workspaces') {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET')
        this.json(response, 405, { error: 'method_not_allowed' })
        return
      }
      if (path === '/api/status') {
        this.json(response, 200, this.apiStatus())
      } else {
        this.json(
          response,
          200,
          WORKSPACES.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            shortName: workspace.shortName,
            shortcut: workspace.shortcut,
            url: stripUrlSecrets(workspace.url) || workspace.url,
            kind: workspace.kind
          }))
        )
      }
      return
    }
    if (path === '/api/activate') {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        this.json(response, 405, { error: 'method_not_allowed' })
        return
      }
      const body = await this.readBody(request)
      const id = body?.['id']
      if (!body || !isWorkspaceId(id)) {
        this.json(response, 400, { error: 'invalid_workspace' })
        return
      }
      this.options.onActivate(id)
      this.json(response, 200, this.apiStatus())
      return
    }
    if (path === '/api/share') {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        this.json(response, 405, { error: 'method_not_allowed' })
        return
      }
      const body = await this.readBody(request)
      const rawText = body?.['text']
      if (!body || typeof rawText !== 'string' || !rawText.trim()) {
        this.json(response, 400, { error: 'invalid_share' })
        return
      }
      const title = typeof body['title'] === 'string' ? body['title'].slice(0, 200) : undefined
      const text = rawText.slice(0, 4000)
      this.options.onShare({ title, text })
      this.broadcast({ type: 'shared', title: title ?? null, text, at: Date.now() })
      this.json(response, 200, { ok: true })
      return
    }
    if (path.startsWith('/api/')) {
      this.json(response, 404, { error: 'not_found' })
      return
    }
    this.json(response, 404, { error: 'not_found' })
  }

  private handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    let url: URL
    try {
      url = new URL(request.url ?? '/', 'http://localhost')
    } catch {
      socket.destroy()
      return
    }
    if (url.pathname !== '/ws') {
      socket.destroy()
      return
    }
    const ip = this.clientIp(request)
    if (!this.checkRateLimit(ip)) {
      socket.destroy()
      return
    }
    if (!this.authorize(url.searchParams.get('token') ?? this.tokenFromRequest(request, url))) {
      this.recordFailure(ip)
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    const wss = this.wss
    if (!wss) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (upgraded) => {
      wss.emit('connection', upgraded, request)
    })
  }

  private onConnection(socket: WebSocket, request: IncomingMessage): void {
    if (this.clients.size >= MAX_DEVICES) {
      socket.close(1013, 'Device limit reached')
      return
    }
    let url: URL
    try {
      url = new URL(request.url ?? '/', 'http://localhost')
    } catch {
      url = new URL('http://localhost')
    }
    const cleanName = (url.searchParams.get('name') ?? '')
      .replace(/[\u0000-\u001f\u007f<>"]/g, '')
      .trim()
      .slice(0, 40)
    const now = Date.now()
    const client: Client = {
      socket,
      isAlive: true,
      device: {
        id: `dev_${randomBytes(8).toString('hex')}`,
        label: cleanName || 'Phone',
        address: this.clientIp(request),
        connectedAt: now,
        lastSeenAt: now,
        pingMs: null
      }
    }
    this.clients.add(client)

    socket.on('pong', () => {
      client.isAlive = true
      client.device.lastSeenAt = Date.now()
    })
    socket.on('message', (raw) => this.onMessage(client, raw))
    socket.on('close', () => {
      this.clients.delete(client)
      this.lastStatusJson = ''
      this.flushStatus()
    })
    socket.on('error', () => {
      /* a dead peer is removed by the close handler */
    })

    this.broadcastTo(socket, {
      type: 'hello',
      host: this.options.hostName,
      version: this.options.appVersion,
      workspaces: WORKSPACES.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        shortName: workspace.shortName
      })),
      status: this.apiStatus()
    })
    this.lastStatusJson = ''
    this.flushStatus()
  }

  private onMessage(client: Client, raw: RawData): void {
    client.device.lastSeenAt = Date.now()
    let message: unknown
    try {
      message = JSON.parse(rawToString(raw).slice(0, MAX_BODY_BYTES))
    } catch {
      return
    }
    if (!isRecord(message)) return
    if (message['type'] === 'ping') {
      const sent = message['t']
      const timestamp = typeof sent === 'number' && Number.isFinite(sent) ? sent : null
      if (timestamp !== null) client.device.pingMs = Math.max(0, Math.round(Date.now() - timestamp))
      this.broadcastTo(client.socket, { type: 'pong', t: timestamp })
      return
    }
    if (message['type'] === 'activate') {
      const id = message['id']
      if (isWorkspaceId(id)) this.options.onActivate(id)
      return
    }
    if (message['type'] === 'share') {
      const rawText = message['text']
      if (typeof rawText !== 'string' || !rawText.trim()) return
      const submitted = message['title']
      const title = typeof submitted === 'string' ? submitted.slice(0, 200) : undefined
      const text = rawText.slice(0, 4000)
      this.options.onShare({ title, text })
      this.broadcast({ type: 'shared', title: title ?? null, text, at: Date.now() })
    }
  }

  private broadcastTo(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return
    const text = this.serialize(payload)
    if (!text) return
    try {
      socket.send(text)
    } catch {
      /* drop */
    }
  }

  private serialize(payload: unknown): string | null {
    try {
      return JSON.stringify(payload)
    } catch {
      return null
    }
  }

  private startTimers(): void {
    this.stopTimers()
    this.heartbeatTimer = setInterval(() => {
      for (const client of [...this.clients]) {
        if (!client.isAlive) {
          this.clients.delete(client)
          this.lastStatusJson = ''
          this.flushStatus()
          try {
            client.socket.terminate()
          } catch {
            /* already gone */
          }
          continue
        }
        client.isAlive = false
        try {
          client.socket.ping()
        } catch {
          /* socket will be reaped on the next heartbeat */
        }
      }
    }, HEARTBEAT_MS)
    this.heartbeatTimer.unref?.()
    this.statusTimer = setInterval(() => this.publishStatusSnapshot(), STATUS_BROADCAST_MS)
    this.statusTimer.unref?.()
  }

  private stopTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.statusTimer) clearInterval(this.statusTimer)
    if (this.publishTimer) clearTimeout(this.publishTimer)
    this.heartbeatTimer = null
    this.statusTimer = null
    this.publishTimer = null
  }

  private publishStatusSnapshot(): void {
    if (this.clients.size === 0) {
      this.lastStatusJson = ''
      return
    }
    const payload = { type: 'status', status: this.apiStatus() }
    const text = this.serialize(payload)
    if (!text || text === this.lastStatusJson) return
    this.lastStatusJson = text
    this.broadcast(payload)
  }

  private publishStatus(): void {
    if (this.publishTimer) return
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null
      this.flushStatus()
    }, STATUS_PUBLISH_MS)
    this.publishTimer.unref?.()
  }

  private flushStatus(): void {
    if (this.publishTimer) {
      clearTimeout(this.publishTimer)
      this.publishTimer = null
    }
    this.options.onStatus(this.status())
  }

  private landingPage(): string {
    const host = escapeHtml(this.options.hostName)
    const version = escapeHtml(this.options.appVersion)
    return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>Antigravity Pulse · Phone Companion</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; background: #000; color: #fff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
  .card { width: min(520px, 100%); background: linear-gradient(180deg, #141414 0%, #070707 100%);
    border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 28px;
    box-shadow: 0 24px 70px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.07); }
  .mark { width: 40px; height: 40px; margin-bottom: 16px; border-radius: 50%; border: 1px solid #FFC799;
    box-shadow: 0 0 28px #FFC79944; position: relative; }
  .mark::after { content: ""; position: absolute; inset: 11px; border-radius: 50%; background: #FFC799; }
  h1 { font-size: 20px; letter-spacing: -.02em; margin: 0 0 4px; }
  .sub { font: 11px/1.6 ui-monospace, "Cascadia Code", monospace; letter-spacing: .06em; color: #FFC799;
    text-transform: uppercase; margin: 0 0 22px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
  .tile { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 10px; padding: 12px; }
  .tile span { display: block; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.5); }
  .tile strong { display: block; margin-top: 6px; font-size: 14px; }
  .label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.5); margin-bottom: 10px; }
  .ws-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ws { cursor: pointer; font: inherit; font-size: 12px; color: #fff; background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.11); border-radius: 9px; padding: 10px 6px; }
  .ws:hover { background: rgba(255,199,153,.16); border-color: #FFC799; }
  .notice { background: rgba(255,199,153,.08); border: 1px solid rgba(255,199,153,.3); border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.6; }
  .notice p { margin: 8px 0 0; color: rgba(255,255,255,.75); }
  .mono, .foot { font: 10px/1.6 ui-monospace, "Cascadia Code", monospace; color: rgba(255,255,255,.42); }
  .foot { margin: 22px 0 0; text-align: center; }
  .dim { color: rgba(255,255,255,.5); font-size: 13px; }
</style></head><body>
<div class="card"><div class="mark"></div>
<h1>Antigravity Pulse</h1>
<p class="sub">Phone Companion · ${host} · v${version}</p>
<div id="panel"><div class="dim">Checking bridge status…</div></div>
<p class="foot">Local network only · every API call requires a 256-bit bearer token</p>
</div>
<script>
(function () {
  var panel = document.getElementById('panel');
  var hash = (location.hash || '').replace(/^#/, '');
  var token = new URLSearchParams(hash).get('token');
  if (token) {
    try { sessionStorage.setItem('pulse.token', token); } catch (e) {}
    history.replaceState(null, '', location.pathname);
  } else {
    try { token = sessionStorage.getItem('pulse.token'); } catch (e) {}
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function api(path, init) {
    init = init || {};
    init.headers = Object.assign({}, init.headers || {}, { 'Authorization': 'Bearer ' + (token || '') });
    return fetch(path, init).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function instructions(message) {
    panel.innerHTML = '<div class="notice"><strong>Pair with the desktop app</strong><p>' +
      esc(message || 'Open Phone Companion in Antigravity Pulse, start the bridge, then scan the QR code with the Android app.') +
      '</p><p class="mono">The pairing link carries a one-time token in its fragment. It is kept only in this browser tab.</p></div>';
  }
  function render(status, workspaces) {
    var active = status.active || {};
    var html = '<div class="grid">';
    html += '<div class="tile"><span>Active workspace</span><strong>' + esc(active.title || 'Home') + '</strong></div>';
    html += '<div class="tile"><span>Devices</span><strong>' + esc((status.devices || []).length) + '</strong></div>';
    html += '<div class="tile"><span>Bridge</span><strong>' + (token ? 'Connected' : 'Off') + '</strong></div>';
    html += '</div><div class="label">Workspaces</div><div class="ws-grid">';
    for (var i = 0; i < workspaces.length; i++) {
      var w = workspaces[i];
      html += '<button class="ws" data-id="' + esc(w.id) + '">' + esc(w.shortName || w.name) + '</button>';
    }
    html += '</div>';
    panel.innerHTML = html;
    var buttons = panel.querySelectorAll('button.ws');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        api('/api/activate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id })
        }).then(function () {
          return Promise.all([api('/api/status'), api('/api/workspaces')]);
        }).then(function (pair) {
          render(pair[0], pair[1]);
        }).catch(function () {
          instructions('Could not switch workspace. Check that the bridge is still running.');
        });
      });
    }
  }
  if (!token) { instructions(); return; }
  Promise.all([api('/api/status'), api('/api/workspaces')])
    .then(function (pair) { render(pair[0], pair[1]); })
    .catch(function () { instructions('The token was rejected. Regenerate it in the desktop app and scan the QR code again.'); });
})();
</script>
</body></html>`
  }
}
