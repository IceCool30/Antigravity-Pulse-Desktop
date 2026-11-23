import { app, clipboard, ipcMain, shell, type BrowserWindow } from 'electron'
import { COMMAND_CHANNELS, type BootstrapInfo, type CommandChannel, type UpdateStatus } from '@shared/ipc'
import type { Settings } from '@shared/settings'
import {
  coerceAddressInput,
  isAllowedExternalUrl,
  isSafeId,
  normalizePairingUrl,
  profileSecretKey
} from '@shared/validation'
import { isWorkspaceId, type WorkspaceId } from '@shared/workspaces'
import { publish, setOverlayVisibleForEvents, toast } from './events'
import { setNotificationsEnabled, showNotification } from './notifications'
import type { PhoneBridge } from './bridge'
import type { GoogleAuthBroker } from './google-auth'
import type { SettingsStore } from './settings-store'
import type { WorkspaceHost } from './workspace-host'

export interface RouterDeps {
  settings: SettingsStore
  bridge: PhoneBridge
  host: WorkspaceHost
  auth: GoogleAuthBroker
  getWindow: () => BrowserWindow | null
  getBootstrap: () => BootstrapInfo
  checkUpdates: () => Promise<UpdateStatus>
  downloadUpdate: () => Promise<void>
  installUpdate: () => void
  requestQuit: () => void
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${name} must be an object.`)
  return value
}

/** IPC serializes an omitted payload as undefined (or null on some bridges). */
const optionalRecord = (value: unknown, name: string): Record<string, unknown> =>
  value === undefined || value === null ? {} : requireRecord(value, name)

/** These commands take no arguments; reject anything unexpected from a caller. */
function requireVoid(value: unknown, name: string): void {
  if (value !== undefined && value !== null) throw new Error(`${name} does not accept arguments.`)
}

function stringField(
  record: Record<string, unknown>,
  key: string,
  name: string,
  max = 4096,
  allowEmpty = false
): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error(`${name} must be text.`)
  if (!allowEmpty && !value.trim()) throw new Error(`${name} is required.`)
  if (value.length > max) throw new Error(`${name} is too long.`)
  return value
}

function booleanField(record: Record<string, unknown>, key: string, name: string, fallback: boolean): boolean {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error(`${name} must be true or false.`)
  return value
}

function workspaceField(value: unknown, name: string, allowNull = false): WorkspaceId | null {
  if (allowNull && value === null) return null
  if (!isWorkspaceId(value)) throw new Error(`${name} is not a known workspace.`)
  return value
}

function optionalWorkspaceField(value: unknown, name: string): WorkspaceId | undefined {
  if (value === undefined) return undefined
  return workspaceField(value, name) ?? undefined
}

/**
 * Defensively handles every command channel. The exhaustive `Record` means a
 * channel added to `COMMAND_CHANNELS` without an implementation fails the
 * typecheck instead of silently becoming an unhandled IPC call.
 */
export function installIpcRouter(deps: RouterDeps): void {
  function nativeNotice(title: string, body: string): void {
    showNotification(title, body, () => {
      const window = deps.getWindow()
      if (!window || window.isDestroyed()) return
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    })
  }

  async function reconcileBridge(previous: Settings, next: Settings): Promise<void> {
    publish({ type: 'settings', payload: next })
    setNotificationsEnabled(next.notificationsEnabled)
    const enabledChanged = previous.bridgeEnabled !== next.bridgeEnabled
    const portChanged = previous.bridgePort !== next.bridgePort
    if (!enabledChanged && !portChanged) return

    if (!next.bridgeEnabled) {
      if (enabledChanged) await deps.bridge.stop()
      return
    }
    if (portChanged) {
      await deps.bridge.restart(next.bridgePort)
      return
    }
    if (enabledChanged) await deps.bridge.start(next.bridgePort)
  }

  type Handler = (payload: unknown) => unknown | Promise<unknown>
  const handlers: Record<CommandChannel, Handler> = {
    'app:bootstrap': () => deps.getBootstrap(),

    'app:window': (payload) => {
      const body = requireRecord(payload, 'Window command')
      const action = body['action']
      if (action !== 'minimize' && action !== 'maximize' && action !== 'close') {
        throw new Error('Unknown window action.')
      }
      const window = deps.getWindow()
      if (!window || window.isDestroyed()) return
      if (action === 'minimize') window.minimize()
      else if (action === 'maximize') {
        if (window.isMaximized()) window.restore()
        else window.maximize()
      } else window.close()
    },

    'app:copy': (payload) => {
      const body = requireRecord(payload, 'Copy command')
      clipboard.writeText(stringField(body, 'text', 'Text', 100_000, true))
    },

    'app:toast': (payload) => {
      const body = requireRecord(payload, 'Toast command')
      const title = stringField(body, 'title', 'Title', 200)
      const message = stringField(body, 'body', 'Message', 1000, true)
      const kind = body['kind']
      toast(title, message, kind === 'success' || kind === 'error' ? kind : 'info')
    },

    'app:openExternal': async (payload) => {
      const body = requireRecord(payload, 'Open link command')
      const url = stringField(body, 'url', 'URL', 2048)
      if (!isAllowedExternalUrl(url)) throw new Error('Only web and mail links can be opened.')
      await shell.openExternal(url)
    },

    'app:openPath': async (payload) => {
      const body = requireRecord(payload, 'Open folder command')
      const target = body['target']
      if (target !== 'userData' && target !== 'downloads') throw new Error('Unknown folder target.')
      const result = await shell.openPath(app.getPath(target))
      if (result) toast('Could not open folder', result, 'error')
    },

    'app:notify': (payload) => {
      const body = requireRecord(payload, 'Notification command')
      const title = stringField(body, 'title', 'Title', 200)
      const message = stringField(body, 'body', 'Message', 1000, true)
      nativeNotice(title, message)
      toast(title, message, 'info')
    },

    'app:quit': () => {
      deps.requestQuit()
    },

    'app:checkUpdates': (payload) => {
      requireVoid(payload, 'Update check command')
      return deps.checkUpdates()
    },

    'app:downloadUpdate': (payload) => {
      requireVoid(payload, 'Download update command')
      return deps.downloadUpdate()
    },

    'app:installUpdate': (payload) => {
      requireVoid(payload, 'Install update command')
      deps.installUpdate()
    },

    'settings:update': async (payload) => {
      const previous = deps.settings.get()
      const patch = requireRecord(payload, 'Settings patch')
      const next = await deps.settings.update(patch)
      await reconcileBridge(previous, next)
      return next
    },

    'settings:reset': async () => {
      const previous = deps.settings.get()
      const next = await deps.settings.reset()
      await reconcileBridge(previous, next)
      return next
    },

    'workspace:activate': (payload) => {
      const body = requireRecord(payload, 'Activate command')
      const id = workspaceField(body['id'], 'Workspace', true)
      const secondary = booleanField(body, 'secondary', 'Secondary pane', false)
      deps.host.activate(id, secondary)
    },

    'workspace:clearSplit': () => deps.host.clearSplit(),

    'workspace:reload': (payload) => {
      const id = optionalRecord(payload, 'Reload command')['id']
      deps.host.reload(optionalWorkspaceField(id, 'Workspace'))
    },

    'workspace:back': (payload) => {
      const id = optionalRecord(payload, 'Back command')['id']
      deps.host.goBack(optionalWorkspaceField(id, 'Workspace'))
    },

    'workspace:forward': (payload) => {
      const id = optionalRecord(payload, 'Forward command')['id']
      deps.host.goForward(optionalWorkspaceField(id, 'Workspace'))
    },

    'workspace:stop': (payload) => {
      const id = optionalRecord(payload, 'Stop command')['id']
      deps.host.stop(optionalWorkspaceField(id, 'Workspace'))
    },

    'workspace:devtools': (payload) => {
      const id = optionalRecord(payload, 'DevTools command')['id']
      deps.host.devtools(optionalWorkspaceField(id, 'Workspace'))
    },

    'workspace:navigate': (payload) => {
      const body = requireRecord(payload, 'Navigate command')
      const id = workspaceField(body['id'], 'Workspace') as WorkspaceId
      const normalized = normalizePairingUrl(body['url'])
      if (!normalized.ok) throw new Error(normalized.error)
      deps.host.navigate(id, normalized.value)
    },

    'workspace:zoom': (payload) => {
      const body = requireRecord(payload, 'Zoom command')
      const id = optionalWorkspaceField(body['id'], 'Workspace')
      const direction = body['direction']
      if (direction !== 'in' && direction !== 'out' && direction !== 'reset') {
        throw new Error('Unknown zoom direction.')
      }
      return deps.host.zoom(id, direction)
    },

    'workspace:unload': (payload) => {
      const body = requireRecord(payload, 'Unload command')
      deps.host.unload(workspaceField(body['id'], 'Workspace') as WorkspaceId)
    },

    'workspace:openT3Pairing': (payload) => {
      const body = requireRecord(payload, 'Pairing command')
      const normalized = normalizePairingUrl(body['url'])
      if (!normalized.ok) throw new Error(normalized.error)
      deps.host.openT3Pairing(normalized.value)
    },

    'layout:update': (payload) => {
      const body = requireRecord(payload, 'Layout update')
      const railWidth = body['railWidth']
      const splitRatio = body['splitRatio']
      if (typeof railWidth !== 'number' || !Number.isFinite(railWidth) || railWidth < 0 || railWidth > 320) {
        throw new Error('Invalid rail width.')
      }
      if (typeof splitRatio !== 'number' || !Number.isFinite(splitRatio) || splitRatio < 0.2 || splitRatio > 0.8) {
        throw new Error('Invalid split ratio.')
      }
      deps.host.setLayout({
        railWidth,
        splitRatio,
        zen: booleanField(body, 'zen', 'Zen mode', false)
      })
    },

    'overlay:setVisible': (payload) => {
      const body = requireRecord(payload, 'Overlay command')
      if (typeof body['visible'] !== 'boolean') throw new Error('Overlay visibility must be a boolean.')
      setOverlayVisibleForEvents(body['visible'])
      deps.host.setOverlayVisible(body['visible'])
    },

    'browser:newTab': (payload) => {
      const body = optionalRecord(payload, 'New tab command')
      const raw = body['url']
      if (raw === undefined || raw === null) {
        deps.host.newBrowserTab()
        return
      }
      if (typeof raw !== 'string') throw new Error('Tab URL must be text.')
      deps.host.newBrowserTab(coerceAddressInput(raw) ?? undefined)
    },

    'browser:closeTab': (payload) => {
      const body = requireRecord(payload, 'Close tab command')
      deps.host.closeBrowserTab(stringField(body, 'id', 'Tab id', 200))
    },

    'browser:activateTab': (payload) => {
      const body = requireRecord(payload, 'Activate tab command')
      deps.host.activateBrowserTab(stringField(body, 'id', 'Tab id', 200))
    },

    'browser:navigate': (payload) => {
      const body = requireRecord(payload, 'Browser navigate command')
      const normalized = normalizePairingUrl(body['url'])
      if (!normalized.ok) throw new Error(normalized.error)
      deps.host.browserNavigate(normalized.value)
    },

    'browser:back': () => deps.host.browserBack(),
    'browser:forward': () => deps.host.browserForward(),
    'browser:reload': () => deps.host.browserReload(),
    'browser:stop': () => deps.host.browserStop(),

    'browser:find': (payload) => {
      const body = requireRecord(payload, 'Find command')
      deps.host.browserFind(stringField(body, 'text', 'Search text', 2000, true), booleanField(body, 'forward', 'Direction', true))
    },

    'browser:findStop': () => deps.host.browserFindStop(),

    'auth:google': () => deps.auth.signIn(),
    'auth:cancel': () => deps.auth.cancel(),

    'vault:setProfileToken': async (payload) => {
      const body = requireRecord(payload, 'Store token command')
      const profileId = stringField(body, 'profileId', 'Profile id', 128)
      if (!isSafeId(profileId)) throw new Error('Invalid profile id.')
      await deps.settings.setSecret(profileSecretKey(profileId), stringField(body, 'token', 'Token', 2048, true))
    },

    'vault:getProfileToken': (payload) => {
      const body = requireRecord(payload, 'Read token command')
      const profileId = stringField(body, 'profileId', 'Profile id', 128)
      if (!isSafeId(profileId)) throw new Error('Invalid profile id.')
      return deps.settings.getSecret(profileSecretKey(profileId))
    },

    'vault:deleteProfileToken': async (payload) => {
      const body = requireRecord(payload, 'Delete token command')
      const profileId = stringField(body, 'profileId', 'Profile id', 128)
      if (!isSafeId(profileId)) throw new Error('Invalid profile id.')
      await deps.settings.deleteSecret(profileSecretKey(profileId))
    },

    'bridge:start': () => deps.bridge.start(),
    'bridge:stop': () => deps.bridge.stop(),

    'bridge:restart': (payload) => {
      const body = optionalRecord(payload, 'Bridge restart command')
      const portValue = body['port']
      if (portValue === undefined || portValue === null) return deps.bridge.restart()
      if (typeof portValue !== 'number' || !Number.isInteger(portValue) || portValue < 1024 || portValue > 65535) {
        throw new Error('Bridge port must be between 1024 and 65535.')
      }
      return deps.bridge.restart(portValue)
    },

    'bridge:regenerateToken': () => deps.bridge.regenerateToken(),
    'bridge:status': () => deps.bridge.status(),

    'bridge:alert': (payload) => {
      const body = requireRecord(payload, 'Bridge alert')
      const title = stringField(body, 'title', 'Title', 200)
      const message = stringField(body, 'body', 'Message', 1000, true)
      const kind = body['kind']
      const safeKind = kind === 'success' || kind === 'error' ? kind : 'info'
      nativeNotice(title, message)
      toast(title, message, safeKind)
    },

    'bridge:shareActive': () => deps.bridge.shareActive()
  }

  for (const channel of COMMAND_CHANNELS) {
    ipcMain.handle(channel, (_event, payload: unknown) =>
      Promise.resolve()
        .then(() => handlers[channel](payload))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'The request could not be completed.'
          throw new Error(`${channel}: ${message}`)
        })
    )
  }
}
