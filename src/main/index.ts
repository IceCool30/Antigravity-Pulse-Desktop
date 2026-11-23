import {
  app,
  BrowserWindow,
  clipboard,
  session,
  shell,
  type WebContents
} from 'electron'
import { hostname } from 'node:os'
import { join } from 'node:path'
import type {
  BootstrapInfo,
  BridgeStatus,
  BrowserSnapshot,
  RuntimeSnapshot,
  UpdateStatus
} from '@shared/ipc'
import { isAllowedExternalUrl, normalizePairingUrl } from '@shared/validation'
import { WORKSPACE_ACTIONS, type WorkspaceId } from '@shared/workspaces'
import { PhoneBridge } from './bridge'
import { setEventTarget, setNativeViewActive, publish, toast } from './events'
import { GoogleAuthBroker } from './google-auth'
import { installIpcRouter } from './ipc-router'
import { setNotificationsEnabled, showNotification } from './notifications'
import { installApplicationMenu, bindShortcuts, type ShortcutOptions } from './shortcuts'
import { SettingsStore } from './settings-store'
import { destroyNativeToast } from './toast-window'
import { PulseTray } from './tray'
import { checkForUpdates } from './update-checker'
import { WorkspaceHost } from './workspace-host'

const PROTOCOL = 'antigravity-pulse'

let mainWindow: BrowserWindow | null = null
let settingsStore: SettingsStore
let host: WorkspaceHost | null = null
let bridge: PhoneBridge | null = null
let auth: GoogleAuthBroker | null = null
let tray: PulseTray | null = null
let quitting = false
let cleanupDone = false
let shellReady = false
let shellReloaded = false
let trayNoticeShown = false
let updateStatus: UpdateStatus = { state: 'idle' }
let updateTimer: NodeJS.Timeout | null = null
let lastRuntime: RuntimeSnapshot | null = null
let lastBridge: BridgeStatus | null = null
let lastBrowser: BrowserSnapshot | null = null
let pendingDeepLink: string | null = null
let shareInfo: { id: WorkspaceId | null; title: string; url: string | null } = {
  id: null,
  title: 'Home',
  url: null
}

function log(phase: string): void {
  console.info(`[pulse] ${phase}`)
}

function emptyRuntime(): RuntimeSnapshot {
  return {
    activeId: null,
    secondaryId: null,
    states: {},
    appMemoryBytes: 0,
    split: false,
    zen: false,
    pinnedCount: 0,
    startedAt: Date.now()
  }
}

function emptyBridgeStatus(): BridgeStatus {
  return {
    enabled: false,
    running: false,
    starting: false,
    port: 3847,
    addresses: [],
    deepLink: null,
    fallbackUrl: null,
    qrDataUrl: null,
    tokenPreview: '',
    fingerprint: '',
    devices: [],
    error: null,
    startedAt: null
  }
}

function emptyBrowserSnapshot(): BrowserSnapshot {
  return { tabs: [], activeId: null, visible: false }
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function toggleWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide()
  else showWindow()
}

function requestQuit(): void {
  quitting = true
  app.quit()
}

function publishWindowState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  publish({
    type: 'window',
    payload: { maximized: mainWindow.isMaximized(), focused: mainWindow.isFocused() }
  })
}

function findDeepLink(argv: readonly string[]): string | null {
  return argv.find((argument) => argument.toLowerCase().startsWith(`${PROTOCOL}://`)) ?? null
}

function handleDeepLink(raw: string | null): void {
  if (!raw) return
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== `${PROTOCOL}:`) return
    if (parsed.hostname !== 'open' && parsed.hostname !== 'pair') return
    const target = parsed.searchParams.get('url')
    if (!target) {
      toast('Pairing link', 'The link did not include a URL.', 'error')
      return
    }
    const normalized = normalizePairingUrl(target)
    if (!normalized.ok) {
      toast('Pairing link', normalized.error, 'error')
      return
    }
    host?.openT3Pairing(normalized.value)
    showWindow()
  } catch {
    toast('Pairing link', 'The link could not be opened.', 'error')
  }
}

function handleWorkspaceAction(id: WorkspaceId): void {
  if (id === 'cloud') {
    host?.activate('cloud')
    publish({ type: 'shell', payload: { action: 'phone' } })
    return
  }
  if (id === 't3') {
    host?.activate('t3')
    publish({ type: 'shell', payload: { action: 't3-pairing' } })
    return
  }
  if (id === 'browser') {
    host?.activate('browser')
    host?.newBrowserTab()
    return
  }
  host?.activate(id)
  const target = WORKSPACE_ACTIONS[id].url
  if (target) host?.navigate(id, target)
}

function handleExternalLink(url: string): void {
  if (!isAllowedExternalUrl(url)) return
  if (settingsStore.get().externalLinkBehavior === 'pulse-browser') {
    showWindow()
    host?.activate('browser')
    host?.newBrowserTab(url)
    return
  }
  void shell.openExternal(url).catch(() => {
    toast('Could not open link', 'No system browser is available.', 'error')
  })
}

async function runUpdateCheck(manual: boolean): Promise<UpdateStatus> {
  if (manual || updateStatus.state !== 'checking') {
    updateStatus = { state: 'checking' }
    publish({ type: 'update', payload: updateStatus })
  }
  const result = await checkForUpdates(app.getVersion())
  updateStatus = result
  publish({ type: 'update', payload: result })
  return result
}

function scheduleUpdates(): void {
  if (!settingsStore.get().updateChecks) return
  void runUpdateCheck(false)
  if (updateTimer) clearInterval(updateTimer)
  updateTimer = setInterval(() => {
    void runUpdateCheck(false)
  }, 6 * 60 * 60 * 1000)
  updateTimer.unref?.()
}

function buildBootstrap(): BootstrapInfo {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions['electron'] ?? '',
    chromeVersion: process.versions['chrome'] ?? '',
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    settings: settingsStore.get(),
    runtime: host?.getRuntime() ?? emptyRuntime(),
    bridge: bridge?.status() ?? emptyBridgeStatus(),
    browser: lastBrowser ?? emptyBrowserSnapshot(),
    update: updateStatus,
    paths: { userData: app.getPath('userData'), downloads: app.getPath('downloads') },
    googleConfigured: auth?.isConfigured() ?? false,
    hostName: hostname(),
    maximized: mainWindow?.isMaximized() ?? false
  }
}

async function bootstrap(): Promise<void> {
  log('boot: single-instance lock')
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  app.setName('Antigravity Pulse')
  app.setAppUserModelId('com.antigravitypulse.desktop')
  if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL)

  log('boot: settings')
  settingsStore = new SettingsStore(app.getPath('userData'))
  await settingsStore.load()
  setNotificationsEnabled(settingsStore.get().notificationsEnabled)
  auth = new GoogleAuthBroker()

  log('boot: window')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: '#000000',
    roundedCorners: true,
    autoHideMenuBar: true,
    title: 'Antigravity Pulse',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true
    }
  })
  mainWindow.setMenuBarVisibility(false)
  setEventTarget(mainWindow)

  const shellSession = session.defaultSession
  shellSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  shellSession.setPermissionCheckHandler(() => false)

  const shortcutOptions: ShortcutOptions = {
    activate: (id) => {
      showWindow()
      host?.activate(id)
    },
    workspaceAction: (id) => {
      showWindow()
      handleWorkspaceAction(id)
    },
    shellAction: (action) => {
      showWindow()
      publish({ type: 'shell', payload: { action } })
    },
    newTab: () => {
      showWindow()
      host?.activate('browser')
      host?.newBrowserTab()
    },
    closeTab: () => {
      if (!host?.isBrowserActive()) return
      const activeTab = lastBrowser?.activeId
      if (activeTab) host.closeBrowserTab(activeTab)
    },
    reload: () => {
      if (host?.isBrowserActive()) host.browserReload()
      else host?.reload()
    },
    back: () => {
      if (host?.isBrowserActive()) host.browserBack()
      else host?.goBack()
    },
    forward: () => {
      if (host?.isBrowserActive()) host.browserForward()
      else host?.goForward()
    },
    zoom: (direction) => {
      host?.zoom(undefined, direction)
    },
    devtools: () => host?.devtools(),
    clearSplit: () => host?.clearSplit(),
    isBrowserActive: () => host?.isBrowserActive() ?? false,
    quit: () => requestQuit()
  }

  installApplicationMenu(shortcutOptions)
  bindShortcuts(mainWindow.webContents, shortcutOptions)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!shellReady || url === mainWindow?.webContents.getURL()) return
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    event.preventDefault()
  })
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.warn('[pulse] shell renderer stopped', details.reason)
    if (shellReloaded || quitting) return
    shellReloaded = true
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload()
    }, 600)
  })

  log('boot: workspace host')
  host = new WorkspaceHost({
    window: mainWindow,
    getSettings: () => settingsStore.get(),
    saveSettings: (patch) => {
      void settingsStore.update(patch).then((settings) => {
        // Resume URLs, zoom, and the active pane change without a renderer
        // settings:update call; keep the Home dashboard in sync.
        publish({ type: 'settings', payload: settings })
      })
    },
    bindShortcuts: (contents: WebContents) => bindShortcuts(contents, shortcutOptions),
    onRuntime: (runtime) => {
      lastRuntime = runtime
      publish({ type: 'runtime', payload: runtime })
      tray?.update(runtime, bridge?.status() ?? lastBridge ?? emptyBridgeStatus())
    },
    onActive: (info) => {
      shareInfo = info
      const id = info.id
      // Browser tabs are native views too; their page area covers DOM toasts.
      setNativeViewActive(id !== null && id !== 'cloud')
    },
    onBrowser: (snapshot) => {
      lastBrowser = snapshot
      publish({ type: 'browser', payload: snapshot })
    },
    onCrash: (title, body) => {
      showNotification(title, body, showWindow)
      toast(title, body, 'error')
    },
    onExternalLink: (url) => handleExternalLink(url)
  })
  host.setFindResultHandler((result) => publish({ type: 'find', payload: result }))

  log('boot: phone bridge')
  bridge = new PhoneBridge({
    settings: settingsStore,
    hostName: hostname(),
    appVersion: app.getVersion(),
    getRuntime: () => host?.getRuntime() ?? lastRuntime ?? emptyRuntime(),
    getShareInfo: () => shareInfo,
    onActivate: (id) => {
      showWindow()
      host?.activate(id)
    },
    onShare: ({ title, text }) => {
      clipboard.writeText(text)
      const label = title?.trim() ? title : 'Shared from your phone'
      toast(label, text.slice(0, 140), 'success')
      showNotification(label, text.slice(0, 180), showWindow)
    },
    onStatus: (status) => {
      lastBridge = status
      publish({ type: 'bridge', payload: status })
      tray?.update(lastRuntime ?? emptyRuntime(), status)
    }
  })

  log('boot: tray')
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(__dirname, '../../build/tray.png')
  tray = new PulseTray({
    iconPath,
    showWindow: () => showWindow(),
    toggleWindow: () => toggleWindow(),
    quit: () => requestQuit(),
    activate: (id) => {
      showWindow()
      host?.activate(id)
    },
    openCloud: () => {
      showWindow()
      host?.activate('cloud')
    },
    openPhone: () => {
      showWindow()
      host?.activate('cloud')
      publish({ type: 'shell', payload: { action: 'phone' } })
    },
    toggleBridge: () => {
      if (!bridge) return
      void (bridge.status().running ? bridge.stop() : bridge.start())
    },
    checkUpdates: () => {
      void runUpdateCheck(true)
    }
  })

  installIpcRouter({
    settings: settingsStore,
    bridge,
    host,
    auth,
    getWindow: () => mainWindow,
    getBootstrap: buildBootstrap,
    checkUpdates: () => runUpdateCheck(true),
    requestQuit: () => requestQuit()
  })

  mainWindow.on('maximize', publishWindowState)
  mainWindow.on('unmaximize', publishWindowState)
  mainWindow.on('focus', publishWindowState)
  mainWindow.on('blur', publishWindowState)
  mainWindow.on('close', (event) => {
    if (quitting || !settingsStore.get().closeToTray) return
    event.preventDefault()
    mainWindow?.hide()
    if (trayNoticeShown) return
    trayNoticeShown = true
    showNotification(
      'Still running in the tray',
      'Antigravity Pulse keeps your workspaces warm. Click the tray icon to reopen it.',
      showWindow
    )
    toast('Still running in the tray', 'Click the tray icon to reopen Antigravity Pulse.', 'info')
  })

  app.on('second-instance', (_event, argv) => {
    showWindow()
    handleDeepLink(findDeepLink(argv))
  })
  app.on('activate', () => showWindow())
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', (event) => {
    quitting = true
    if (cleanupDone) return
    // Block until settings are flushed and the bridge is closed, otherwise the
    // process can exit before the debounced writes land.
    event.preventDefault()
    if (updateTimer) clearInterval(updateTimer)
    updateTimer = null
    void (async () => {
      try {
        await settingsStore.flush()
        await bridge?.stop()
      } finally {
        host?.destroy()
        tray?.destroy()
        destroyNativeToast()
        setEventTarget(null)
        cleanupDone = true
        app.quit()
      }
    })()
  })

  mainWindow.once('ready-to-show', () => {
    const settings = settingsStore.get()
    if (!(settings.launchMinimized && settings.closeToTray)) showWindow()
  })

  mainWindow.webContents.once('did-finish-load', () => {
    shellReady = true
    const settings = settingsStore.get()
    if (settings.seenWelcome) {
      if (settings.lastWorkspaceId) host?.activate(settings.lastWorkspaceId)
      if (settings.lastSecondaryId) host?.activate(settings.lastSecondaryId, true)
    }
    handleDeepLink(findDeepLink(process.argv) ?? pendingDeepLink)
    pendingDeepLink = null
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void mainWindow.loadURL(devUrl)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

  if (settingsStore.get().bridgeEnabled) void bridge.start()
  scheduleUpdates()
  publishWindowState()
  log('boot: ready')
}

// macOS can deliver a protocol URL before app.whenReady(); queue it for boot.
app.on('open-url', (event, url) => {
  event.preventDefault()
  pendingDeepLink = url
})

void app.whenReady().then(bootstrap).catch((error: unknown) => {
  console.error('[pulse] startup failed', error instanceof Error ? error.message : 'unknown error')
})
