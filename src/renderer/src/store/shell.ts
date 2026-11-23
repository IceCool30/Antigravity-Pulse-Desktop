import { create } from 'zustand'
import type {
  BootstrapInfo,
  BridgeStatus,
  BrowserSnapshot,
  PulseEvent,
  RuntimeSnapshot,
  UpdateStatus,
  WorkspaceRuntimeState
} from '@shared/ipc'
import {
  DEFAULT_SETTINGS,
  applySettingsPatch,
  type Settings,
  type SettingsPatch
} from '@shared/settings'
import { RAIL_COLLAPSED_WIDTH, RAIL_EXPANDED_WIDTH } from '@shared/layout'
import type { WorkspaceId } from '@shared/workspaces'
import { errorMessage, invoke } from '../lib/api'

export type SettingsSection =
  | 'appearance'
  | 'workspaces'
  | 'browser'
  | 'phone'
  | 'system'
  | 'about'
  | 'shortcuts'

const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  'appearance',
  'workspaces',
  'browser',
  'phone',
  'system',
  'about',
  'shortcuts'
]

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

export interface Toast {
  id: number
  title: string
  body?: string
  kind: 'info' | 'success' | 'error'
}

export interface CloudAccount {
  email: string | null
  name: string | null
  picture: string | null
}

export type CloudConnection = 'connecting' | 'live' | 'cached' | 'offline'

export interface FindState {
  active: boolean
  matches: number
  activeMatch: number
}

interface ShellState {
  ready: boolean
  bootError: string | null
  bootstrap: BootstrapInfo | null
  settings: Settings
  runtime: RuntimeSnapshot | null
  bridge: BridgeStatus | null
  browser: BrowserSnapshot | null
  update: UpdateStatus
  find: FindState
  findUiOpen: boolean
  findFocusNonce: number
  addressFocusNonce: number
  windowMaximized: boolean
  windowFocused: boolean
  systemPrefersDark: boolean

  /* Renderer-owned layout state (source of truth for layout:update). */
  zen: boolean
  railExpanded: boolean
  splitRatio: number

  /* Overlay surfaces — any of these hides native views via overlay:setVisible. */
  paletteOpen: boolean
  settingsOpen: boolean
  settingsSection: SettingsSection
  phoneOpen: boolean
  t3Open: boolean
  splitMenuOpen: boolean
  browserMenuOpen: boolean
  surfaceModalCount: number

  toasts: Toast[]
  cloudAccount: CloudAccount | null
  cloudConnection: CloudConnection

  seed: (info: BootstrapInfo) => void
  setBootError: (message: string | null) => void
  applyEvent: (event: PulseEvent) => void
  setSystemPrefersDark: (prefersDark: boolean) => void

  sendLayout: () => void
  toggleZen: () => void
  toggleRail: () => void
  setSplitRatio: (ratio: number) => void
  commitSplitRatio: () => void

  togglePalette: () => void
  closePalette: () => void
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  togglePhone: () => void
  closePhone: () => void
  openT3: () => void
  closeT3: () => void
  setSplitMenuOpen: (open: boolean) => void
  setBrowserMenuOpen: (open: boolean) => void
  beginSurfaceModal: () => void
  endSurfaceModal: () => void

  patchSettings: (patch: SettingsPatch) => void
  flushSettings: () => Promise<void>
  resetSettings: () => Promise<void>

  pushToast: (toast: { title: string; body?: string; kind: Toast['kind'] }) => void
  dismissToast: (id: number) => void

  setFindUiOpen: (open: boolean) => void
  requestFindFocus: () => void
  requestAddressFocus: () => void

  setCloudAccount: (account: CloudAccount | null) => void
  setCloudConnection: (connection: CloudConnection) => void
}

/* ── Module-level timers (kept out of reactive state) ──────────────────────── */

let settingsTimer: ReturnType<typeof setTimeout> | null = null
let pendingPatch: SettingsPatch = {}
let toastSequence = 0
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()

export function workspaceState(
  runtime: RuntimeSnapshot | null,
  id: WorkspaceId
): WorkspaceRuntimeState | null {
  return runtime?.states[id] ?? null
}

/** Selector: true while any modal/palette/settings/phone drawer is open. */
export function selectOverlayOpen(state: ShellState): boolean {
  return (
    state.paletteOpen ||
    state.settingsOpen ||
    state.phoneOpen ||
    state.t3Open ||
    state.splitMenuOpen ||
    state.browserMenuOpen ||
    state.surfaceModalCount > 0
  )
}

export const useShell = create<ShellState>()((set, get) => {
  /** Renders a toast that main has already accepted and broadcast. */
  const displayToast = (toast: { title: string; body?: string; kind: Toast['kind'] }): void => {
    toastSequence += 1
    const id = toastSequence
    const entry: Toast = { id, ...toast }
    set({ toasts: [...get().toasts.slice(-3), entry] })
    const timer = setTimeout(() => get().dismissToast(id), 5000)
    toastTimers.set(id, timer)
  }

  const reportError = (error: unknown, fallback: string): void => {
    get().pushToast({ title: fallback, body: errorMessage(error), kind: 'error' })
  }

  const handleShellAction = (action: string, id?: string): void => {
    const state = get()
    switch (action) {
      case 'palette':
        state.togglePalette()
        break
      case 'settings':
        state.openSettings(isSettingsSection(id) ? id : undefined)
        break
      case 'phone':
        state.togglePhone()
        break
      case 'zen':
        state.toggleZen()
        break
      case 't3-pairing':
        state.openT3()
        break
      case 'find':
        if (state.runtime?.activeId === 'browser') {
          set({ findUiOpen: true, findFocusNonce: state.findFocusNonce + 1 })
        }
        break
      case 'address':
        if (state.runtime?.activeId === 'browser') {
          set({ addressFocusNonce: state.addressFocusNonce + 1 })
        }
        break
      case 'new-tab':
        void invoke('browser:newTab', {})
          .then(() => invoke('workspace:activate', { id: 'browser' }))
          .catch((error: unknown) => reportError(error, 'Could not open a new tab'))
        break
      case 'cloud':
        void invoke('workspace:activate', { id: 'cloud' }).catch((error: unknown) =>
          reportError(error, 'Could not open Cloud Sync')
        )
        break
      case 'workspaces':
        state.toggleRail()
        break
      case 'shortcuts':
        state.openSettings('shortcuts')
        break
      default:
        break
    }
  }

  return {
    ready: false,
    bootError: null,
    bootstrap: null,
    settings: DEFAULT_SETTINGS,
    runtime: null,
    bridge: null,
    browser: null,
    update: { state: 'idle' },
    find: { active: false, matches: 0, activeMatch: 0 },
    findUiOpen: false,
    findFocusNonce: 0,
    addressFocusNonce: 0,
    windowMaximized: false,
    windowFocused: true,
    systemPrefersDark:
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,

    zen: false,
    railExpanded: DEFAULT_SETTINGS.railExpanded,
    splitRatio: DEFAULT_SETTINGS.splitRatio,

    paletteOpen: false,
    settingsOpen: false,
    settingsSection: 'appearance',
    phoneOpen: false,
    t3Open: false,
    splitMenuOpen: false,
    browserMenuOpen: false,
    surfaceModalCount: 0,

    toasts: [],
    cloudAccount: null,
    cloudConnection: 'connecting',

    seed: (info) => {
      set({
        ready: true,
        bootError: null,
        bootstrap: info,
        settings: info.settings,
        runtime: info.runtime,
        bridge: info.bridge,
        browser: info.browser,
        update: info.update,
        windowMaximized: info.maximized,
        zen: info.runtime.zen,
        railExpanded: info.settings.railExpanded,
        splitRatio: info.settings.splitRatio
      })
    },

    setBootError: (message) => set({ bootError: message }),

    applyEvent: (event) => {
      switch (event.type) {
        case 'runtime': {
          const runtime = event.payload
          set({ runtime })
          // Split collapsed elsewhere: fall back to the persisted ratio.
          if (!runtime.split) set({ splitRatio: get().settings.splitRatio })
          break
        }
        case 'settings':
          set({ settings: event.payload, railExpanded: event.payload.railExpanded })
          break
        case 'bridge':
          set({ bridge: event.payload })
          break
        case 'browser':
          set({ browser: event.payload })
          break
        case 'update':
          set({ update: event.payload })
          break
        case 'find':
          set({ find: event.payload })
          break
        case 'toast':
          displayToast(event.payload)
          break
        case 'window':
          set({ windowMaximized: event.payload.maximized, windowFocused: event.payload.focused })
          break
        case 'shell':
          handleShellAction(event.payload.action, event.payload.id)
          break
        default:
          break
      }
    },

    setSystemPrefersDark: (prefersDark) => set({ systemPrefersDark: prefersDark }),

    sendLayout: () => {
      const { zen, railExpanded, splitRatio } = get()
      void invoke('layout:update', {
        railWidth: railExpanded ? RAIL_EXPANDED_WIDTH : RAIL_COLLAPSED_WIDTH,
        zen,
        splitRatio
      }).catch((error: unknown) => reportError(error, 'Layout update failed'))
    },

    toggleZen: () => {
      set({ zen: !get().zen, splitMenuOpen: false, browserMenuOpen: false })
      get().sendLayout()
    },

    toggleRail: () => {
      const next = !get().railExpanded
      set({ railExpanded: next })
      get().patchSettings({ railExpanded: next })
      get().sendLayout()
    },

    setSplitRatio: (ratio) => {
      set({ splitRatio: ratio })
      get().sendLayout()
    },

    commitSplitRatio: () => {
      get().patchSettings({ splitRatio: get().splitRatio })
    },

    togglePalette: () => set({ paletteOpen: !get().paletteOpen }),
    closePalette: () => set({ paletteOpen: false }),
    openSettings: (section) =>
      set({
        settingsOpen: true,
        settingsSection: section ?? get().settingsSection,
        paletteOpen: false
      }),
    closeSettings: () => set({ settingsOpen: false }),
    togglePhone: () => set({ phoneOpen: !get().phoneOpen }),
    closePhone: () => set({ phoneOpen: false }),
    openT3: () => set({ t3Open: true, paletteOpen: false }),
    closeT3: () => set({ t3Open: false }),
    setSplitMenuOpen: (open) => set({ splitMenuOpen: open }),
    setBrowserMenuOpen: (open) => set({ browserMenuOpen: open }),
    beginSurfaceModal: () => set({ surfaceModalCount: get().surfaceModalCount + 1 }),
    endSurfaceModal: () => set({ surfaceModalCount: Math.max(0, get().surfaceModalCount - 1) }),

    patchSettings: (patch) => {
      // Optimistic local state; the returned/broadcast settings wins.
      set({ settings: applySettingsPatch(get().settings, patch) })
      pendingPatch = { ...pendingPatch, ...patch }
      if (settingsTimer) clearTimeout(settingsTimer)
      settingsTimer = setTimeout(() => {
        void get().flushSettings()
      }, 200)
    },

    flushSettings: async () => {
      if (settingsTimer) {
        clearTimeout(settingsTimer)
        settingsTimer = null
      }
      const patch = pendingPatch
      pendingPatch = {}
      if (Object.keys(patch).length === 0) return
      try {
        const next = await invoke('settings:update', patch)
        set({ settings: next })
      } catch (error) {
        reportError(error, 'Could not save settings')
      }
    },

    resetSettings: async () => {
      try {
        const next = await invoke('settings:reset', undefined)
        set({ settings: next, railExpanded: next.railExpanded, splitRatio: next.splitRatio })
        get().sendLayout()
        get().pushToast({ title: 'Settings reset', kind: 'success' })
      } catch (error) {
        reportError(error, 'Could not reset settings')
      }
    },

    /**
     * Local toasts go through main so it can choose the DOM stack or a native
     * overlay depending on whether a WebContentsView currently covers the shell.
     * Main broadcasts the event back; `displayToast` does the rendering.
     */
    pushToast: (toast) => {
      void invoke('app:toast', toast).catch(() => {
        displayToast({ title: 'Notification', body: toast.title, kind: 'error' })
      })
    },

    dismissToast: (id) => {
      const timer = toastTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        toastTimers.delete(id)
      }
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
    },

    setFindUiOpen: (open) => {
      set({ findUiOpen: open })
      if (!open) void invoke('browser:findStop', undefined).catch(() => undefined)
    },
    requestFindFocus: () =>
      set({ findUiOpen: true, findFocusNonce: get().findFocusNonce + 1 }),
    requestAddressFocus: () => set({ addressFocusNonce: get().addressFocusNonce + 1 }),

    setCloudAccount: (account) => set({ cloudAccount: account }),
    setCloudConnection: (connection) => set({ cloudConnection: connection })
  }
})
