import type { Settings, SettingsPatch } from './settings'
import type { WorkspaceId } from './workspaces'

/* ── Runtime snapshots ─────────────────────────────────────────────────────── */

export interface WorkspaceRuntimeState {
  id: WorkspaceId
  mounted: boolean
  loading: boolean
  crashed: boolean
  title: string
  url: string
  canGoBack: boolean
  canGoForward: boolean
  memoryBytes: number
  lastActiveAt: number | null
  zoom: number
  error: string | null
}

export interface RuntimeSnapshot {
  activeId: WorkspaceId | null
  secondaryId: WorkspaceId | null
  states: Record<string, WorkspaceRuntimeState>
  appMemoryBytes: number
  split: boolean
  zen: boolean
  pinnedCount: number
  startedAt: number
}

/* ── Phone bridge ──────────────────────────────────────────────────────────── */

export interface BridgeAddress {
  address: string
  label: 'LAN' | 'Tailscale' | 'Interface'
}

export interface BridgeDevice {
  id: string
  label: string
  address: string
  connectedAt: number
  lastSeenAt: number
  pingMs: number | null
}

export interface BridgeStatus {
  enabled: boolean
  running: boolean
  starting: boolean
  port: number
  addresses: BridgeAddress[]
  deepLink: string | null
  fallbackUrl: string | null
  qrDataUrl: string | null
  tokenPreview: string
  fingerprint: string
  devices: BridgeDevice[]
  error: string | null
  startedAt: number | null
}

/* ── Browser ───────────────────────────────────────────────────────────────── */

export interface BrowserTab {
  id: string
  title: string
  url: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  crashed: boolean
  error: string | null
}

export interface BrowserSnapshot {
  tabs: BrowserTab[]
  activeId: string | null
  visible: boolean
}

/* ── Updates & auth ───────────────────────────────────────────────────────── */

export interface UpdateStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'current'
    | 'error'
    | 'installing'
  latestVersion?: string
  url?: string
  message?: string
  checkedAt?: number
  /** Download progress percentage (0–100). */
  progress?: number
  /** True once the installer has been downloaded and verified. */
  downloaded?: boolean
  /** Human-readable release notes for the available version. */
  releaseNotes?: string
}

export interface GoogleTokens {
  idToken: string
  accessToken: string
  expiresAt: number
  email: string | null
  name: string | null
  picture: string | null
}

/* ── Bootstrap ─────────────────────────────────────────────────────────────── */

export interface BootstrapInfo {
  appVersion: string
  electronVersion: string
  chromeVersion: string
  platform: NodeJS.Platform
  arch: string
  isPackaged: boolean
  settings: Settings
  runtime: RuntimeSnapshot
  bridge: BridgeStatus
  browser: BrowserSnapshot
  update: UpdateStatus
  paths: { userData: string; downloads: string }
  googleConfigured: boolean
  hostName: string
  maximized: boolean
}

/* ── Commands ──────────────────────────────────────────────────────────────── */

export interface CommandMap {
  'app:bootstrap': { req: void; res: BootstrapInfo }
  'app:window': { req: { action: 'minimize' | 'maximize' | 'close' }; res: void }
  'app:copy': { req: { text: string }; res: void }
  'app:toast': {
    req: { title: string; body?: string; kind?: 'info' | 'success' | 'error' }
    res: void
  }
  'app:openExternal': { req: { url: string }; res: void }
  'app:openPath': { req: { target: 'userData' | 'downloads' }; res: void }
  'app:notify': { req: { title: string; body: string }; res: void }
  'app:quit': { req: void; res: void }
  'app:checkUpdates': { req: void; res: UpdateStatus }
  'app:downloadUpdate': { req: void; res: void }
  'app:installUpdate': { req: void; res: void }
  'settings:update': { req: SettingsPatch; res: Settings }
  'settings:reset': { req: void; res: Settings }

  'workspace:activate': { req: { id: WorkspaceId | null; secondary?: boolean }; res: void }
  'workspace:clearSplit': { req: void; res: void }
  'workspace:reload': { req: { id?: WorkspaceId }; res: void }
  'workspace:back': { req: { id?: WorkspaceId }; res: void }
  'workspace:forward': { req: { id?: WorkspaceId }; res: void }
  'workspace:stop': { req: { id?: WorkspaceId }; res: void }
  'workspace:devtools': { req: { id?: WorkspaceId }; res: void }
  'workspace:navigate': { req: { id: WorkspaceId; url: string }; res: void }
  'workspace:zoom': { req: { id?: WorkspaceId; direction: 'in' | 'out' | 'reset' }; res: number }
  'workspace:unload': { req: { id: WorkspaceId }; res: void }
  'workspace:openT3Pairing': { req: { url: string }; res: void }

  'layout:update': { req: { railWidth: number; zen: boolean; splitRatio: number }; res: void }
  'overlay:setVisible': { req: { visible: boolean }; res: void }

  'browser:newTab': { req: { url?: string }; res: void }
  'browser:closeTab': { req: { id: string }; res: void }
  'browser:activateTab': { req: { id: string }; res: void }
  'browser:navigate': { req: { url: string }; res: void }
  'browser:back': { req: void; res: void }
  'browser:forward': { req: void; res: void }
  'browser:reload': { req: void; res: void }
  'browser:stop': { req: void; res: void }
  'browser:find': { req: { text: string; forward: boolean }; res: void }
  'browser:findStop': { req: void; res: void }

  'auth:google': { req: void; res: GoogleTokens }
  'auth:cancel': { req: void; res: void }

  'vault:setProfileToken': { req: { profileId: string; token: string }; res: void }
  'vault:getProfileToken': { req: { profileId: string }; res: string | null }
  'vault:deleteProfileToken': { req: { profileId: string }; res: void }

  'bridge:start': { req: void; res: BridgeStatus }
  'bridge:stop': { req: void; res: BridgeStatus }
  'bridge:restart': { req: { port?: number }; res: BridgeStatus }
  'bridge:regenerateToken': { req: void; res: BridgeStatus }
  'bridge:status': { req: void; res: BridgeStatus }
  'bridge:alert': { req: { title: string; body: string; kind?: string }; res: void }
  'bridge:shareActive': { req: void; res: void }
}

export const COMMAND_CHANNELS = [
  'app:bootstrap',
  'app:window',
  'app:copy',
  'app:toast',
  'app:openExternal',
  'app:openPath',
  'app:notify',
  'app:quit',
  'app:checkUpdates',
  'app:downloadUpdate',
  'app:installUpdate',
  'settings:update',
  'settings:reset',
  'workspace:activate',
  'workspace:clearSplit',
  'workspace:reload',
  'workspace:back',
  'workspace:forward',
  'workspace:stop',
  'workspace:devtools',
  'workspace:navigate',
  'workspace:zoom',
  'workspace:unload',
  'workspace:openT3Pairing',
  'layout:update',
  'overlay:setVisible',
  'browser:newTab',
  'browser:closeTab',
  'browser:activateTab',
  'browser:navigate',
  'browser:back',
  'browser:forward',
  'browser:reload',
  'browser:stop',
  'browser:find',
  'browser:findStop',
  'auth:google',
  'auth:cancel',
  'vault:setProfileToken',
  'vault:getProfileToken',
  'vault:deleteProfileToken',
  'bridge:start',
  'bridge:stop',
  'bridge:restart',
  'bridge:regenerateToken',
  'bridge:status',
  'bridge:alert',
  'bridge:shareActive'
] as const satisfies readonly (keyof CommandMap)[]

export type CommandChannel = (typeof COMMAND_CHANNELS)[number]

/* ── Events ────────────────────────────────────────────────────────────────── */

export type ShellAction =
  | 'palette'
  | 'settings'
  | 'phone'
  | 'zen'
  | 't3-pairing'
  | 'find'
  | 'address'
  | 'new-tab'
  | 'cloud'
  | 'workspaces'
  | 'shortcuts'

export type PulseEvent =
  | { type: 'runtime'; payload: RuntimeSnapshot }
  | { type: 'settings'; payload: Settings }
  | { type: 'bridge'; payload: BridgeStatus }
  | { type: 'browser'; payload: BrowserSnapshot }
  | { type: 'update'; payload: UpdateStatus }
  | { type: 'find'; payload: { active: boolean; matches: number; activeMatch: number } }
  | { type: 'toast'; payload: { title: string; body?: string; kind: 'info' | 'success' | 'error' } }
  | { type: 'shell'; payload: { action: ShellAction; id?: string } }
  | { type: 'window'; payload: { maximized: boolean; focused: boolean } }

export interface PreloadApi {
  invoke<K extends CommandChannel>(
    channel: K,
    payload: CommandMap[K]['req']
  ): Promise<CommandMap[K]['res']>
  onEvent(listener: (event: PulseEvent) => void): () => void
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    pulse: PreloadApi
  }
}
