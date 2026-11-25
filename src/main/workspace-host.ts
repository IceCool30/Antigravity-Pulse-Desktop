import {
  app,
  BrowserWindow,
  Menu,
  WebContentsView,
  shell,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import {
  BROWSER_CHROME_HEIGHT,
  RAIL_COLLAPSED_WIDTH,
  SPLIT_GAP,
  computeWorkspaceLayout,
  type Rect,
  type WorkspaceLayout
} from '@shared/layout'
import type {
  BrowserSnapshot,
  RuntimeSnapshot,
  WorkspaceRuntimeState
} from '@shared/ipc'
import type { Settings } from '@shared/settings'
import {
  WORKSPACES,
  getWorkspace,
  isWorkspaceId,
  workspaceUrl,
  type WorkspaceId
} from '@shared/workspaces'
import {
  isAllowedExternalUrl,
  normalizePairingUrl,
  stripUrlSecrets
} from '@shared/validation'
import { PulseBrowser } from './pulse-browser'
import { authPopupOptions, bindAuthPopupWindow, isAuthPopupUrl } from './popups'
import { browserUserAgent, browserWebPreferences, partitionFor, workspaceSession } from './sessions'

export interface WorkspaceHostOptions {
  window: BrowserWindow
  getSettings: () => Settings
  saveSettings: (patch: Partial<Settings>) => void
  bindShortcuts: (contents: WebContents) => void
  onRuntime: (runtime: RuntimeSnapshot) => void
  onActive: (info: { id: WorkspaceId | null; title: string; url: string | null }) => void
  onBrowser: (snapshot: BrowserSnapshot) => void
  onCrash: (title: string, body: string) => void
  onExternalLink: (url: string) => void
}

const SHARE_BLANK = 'pulse://home'

export class WorkspaceHost {
  readonly browser: PulseBrowser
  private readonly options: WorkspaceHostOptions
  private readonly views = new Map<WorkspaceId, WebContentsView>()
  private readonly states: Record<string, WorkspaceRuntimeState> = {}
  private readonly startedAt = Date.now()
  private activeId: WorkspaceId | null = null
  private secondaryId: WorkspaceId | null = null
  private overlayVisible = false
  private zen = false
  private railWidth = RAIL_COLLAPSED_WIDTH
  private splitRatio = 0.5
  private layoutResult: WorkspaceLayout
  private currentSplit = false
  private appMemoryBytes = 0
  private emitTimer: NodeJS.Timeout | null = null
  private metricsTimer: NodeJS.Timeout | null = null
  private readonly persistTimers = new Map<WorkspaceId, NodeJS.Timeout>()
  private destroyed = false
  private readonly onResize = (): void => this.layout()

  constructor(options: WorkspaceHostOptions) {
    this.options = options
    const settings = options.getSettings()
    this.railWidth = settings.railExpanded ? 220 : RAIL_COLLAPSED_WIDTH
    this.splitRatio = settings.splitRatio

    for (const workspace of WORKSPACES) {
      const fallbackUrl =
        workspace.kind === 'native' ? 'pulse://cloud' : (settings.lastUrls[workspace.id] ?? workspace.url)
      this.states[workspace.id] = {
        id: workspace.id,
        mounted: false,
        loading: false,
        crashed: false,
        title: workspace.name,
        url: workspace.kind === 'native' ? 'pulse://cloud' : stripUrlSecrets(fallbackUrl) || fallbackUrl,
        canGoBack: false,
        canGoForward: false,
        memoryBytes: 0,
        lastActiveAt: null,
        zoom: settings.zoom[workspace.id] ?? 0,
        error: null
      }
    }

    this.browser = new PulseBrowser({
      window: options.window,
      getSettings: options.getSettings,
      saveTabs: (patch) => options.saveSettings(patch),
      onSnapshot: (snapshot) => this.handleBrowserSnapshot(snapshot),
      onActivate: () => this.activate('browser'),
      onFindResult: (result) => {
        /* routed through index via browser events below */
        this.findResultHandler?.(result)
      },
      onCrash: options.onCrash,
      bindShortcuts: options.bindShortcuts,
      openExternalLink: (url) => this.openExternalLink(url)
    })

    this.layoutResult = computeWorkspaceLayout({
      windowWidth: options.window.getContentSize()[0] ?? 1280,
      windowHeight: options.window.getContentSize()[1] ?? 800,
      railWidth: this.railWidth,
      split: false
    })

    this.metricsTimer = setInterval(() => this.refreshMetrics(), 4_000)
    this.metricsTimer.unref?.()
    options.window.on('resize', this.onResize)
    this.refreshMetrics()
  }

  private findResultHandler: ((result: { active: boolean; matches: number; activeMatch: number }) => void) | null =
    null

  setFindResultHandler(handler: (result: { active: boolean; matches: number; activeMatch: number }) => void): void {
    this.findResultHandler = handler
  }

  getRuntime(): RuntimeSnapshot {
    const states: Record<string, WorkspaceRuntimeState> = {}
    for (const [id, state] of Object.entries(this.states)) {
      states[id] = { ...state }
    }
    const pinnedCount = Object.values(this.states).filter((state) => state.mounted).length
    return {
      activeId: this.activeId,
      secondaryId: this.secondaryId,
      states,
      appMemoryBytes: this.appMemoryBytes,
      split: this.currentSplit,
      zen: this.zen,
      pinnedCount,
      startedAt: this.startedAt
    }
  }

  shareInfo(): { id: WorkspaceId | null; title: string; url: string | null } {
    if (!this.activeId) return { id: null, title: 'Home', url: null }
    const state = this.states[this.activeId]
    if (this.activeId === 'browser') {
      return {
        id: 'browser',
        title: 'Pulse Browser',
        url: this.browser.activeShareUrl() ?? null
      }
    }
    if (this.activeId === 'cloud') {
      return { id: 'cloud', title: 'Cloud Sync & Phone Companion', url: 'pulse://cloud' }
    }
    return {
      id: this.activeId,
      title: state?.title ?? getWorkspace(this.activeId).name,
      url: state?.url ? state.url : SHARE_BLANK
    }
  }

  activate(id: WorkspaceId | null, secondary = false): void {
    if (this.destroyed) return
    if (id !== null && !isWorkspaceId(id)) throw new Error('Unknown workspace.')

    if (secondary && id !== null && this.canSplitWith(id)) {
      this.ensureView(id)
      this.secondaryId = id
      this.states[id] = { ...this.states[id], lastActiveAt: Date.now() } as WorkspaceRuntimeState
      const settings = this.options.getSettings()
      this.options.saveSettings({
        lastSecondaryId: id,
        lastWorkspaceId: this.activeId,
        lastUrls: settings.lastUrls
      })
      this.layout()
      this.emitNow()
      return
    }

    if (id === null) {
      this.activeId = null
      this.secondaryId = null
      this.browser.setActive(false)
      this.options.saveSettings({ lastWorkspaceId: null, lastSecondaryId: null })
      this.layout()
      this.emitNow()
      return
    }

    const workspace = getWorkspace(id)
    if (id === 'browser') {
      this.browser.ensureTab()
      this.secondaryId = null
    } else if (workspace.kind === 'native') {
      this.secondaryId = null
    } else {
      this.ensureView(id)
      if (this.secondaryId === id) this.secondaryId = null
      if (this.activeId === 'browser' || this.activeId === 'cloud') this.secondaryId = null
    }

    this.activeId = id
    this.states[id] = {
      ...this.states[id],
      lastActiveAt: Date.now(),
      error: this.states[id]?.error ?? null
    } as WorkspaceRuntimeState
    this.options.saveSettings({
      lastWorkspaceId: id,
      lastSecondaryId: this.secondaryId
    })
    this.layout()
    this.emitNow()
  }

  setLayout(input: { railWidth: number; zen: boolean; splitRatio: number }): void {
    this.railWidth = Math.min(320, Math.max(0, Number.isFinite(input.railWidth) ? input.railWidth : 56))
    this.zen = input.zen === true
    this.splitRatio = Math.min(0.8, Math.max(0.2, Number.isFinite(input.splitRatio) ? input.splitRatio : 0.5))
    this.layout()
    this.scheduleEmit()
  }

  setOverlayVisible(visible: boolean): void {
    this.overlayVisible = visible
    this.layout()
    if (visible) {
      // The shell must own the keyboard while a palette/modal/sheet is open.
      if (!this.options.window.isDestroyed()) this.options.window.webContents.focus()
      return
    }
    const activeView = this.activeId ? this.views.get(this.activeId) : null
    if (this.activeId === 'browser') this.browser.activeTabView()?.webContents.focus()
    else activeView?.webContents.focus()
  }

  relayout(): void {
    this.layout()
  }

  clearSplit(): void {
    if (!this.secondaryId) return
    this.secondaryId = null
    this.options.saveSettings({ lastSecondaryId: null })
    this.layout()
    this.emitNow()
  }

  reload(id?: WorkspaceId): void {
    const target = this.resolveTarget(id)
    if (!target) return
    if (target === 'browser') {
      this.browser.reload()
      return
    }
    if (target === 'cloud' || !getWorkspace(target).kind || getWorkspace(target).kind === 'native') return
    const existing = this.views.get(target)
    const crashed = this.states[target]?.crashed
    if (!existing || existing.webContents.isDestroyed() || crashed) {
      this.disposeView(target)
      this.ensureView(target)
    } else {
      this.states[target] = { ...this.states[target], crashed: false, error: null, loading: true } as WorkspaceRuntimeState
      existing.webContents.reload()
    }
    this.layout()
    this.scheduleEmit()
  }

  goBack(id?: WorkspaceId): void {
    const target = this.resolveTarget(id)
    if (!target || target === 'browser' || target === 'cloud') return
    const contents = this.views.get(target)?.webContents
    if (!contents || contents.isDestroyed()) return
    if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
  }

  goForward(id?: WorkspaceId): void {
    const target = this.resolveTarget(id)
    if (!target || target === 'browser' || target === 'cloud') return
    const contents = this.views.get(target)?.webContents
    if (!contents || contents.isDestroyed()) return
    if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
  }

  stop(id?: WorkspaceId): void {
    const target = this.resolveTarget(id)
    if (!target || target === 'browser' || target === 'cloud') return
    const contents = this.views.get(target)?.webContents
    if (!contents || contents.isDestroyed()) return
    contents.stop()
  }

  devtools(id?: WorkspaceId): void {
    const target = this.resolveTarget(id)
    if (!target) return
    if (target === 'browser') {
      const contents = this.browser.activeTabView()?.webContents
      if (contents && !contents.isDestroyed()) {
        if (contents.isDevToolsOpened()) contents.closeDevTools()
        else contents.openDevTools({ mode: 'detach' })
      }
      return
    }
    const contents = this.views.get(target)?.webContents
    if (!contents || contents.isDestroyed()) return
    if (contents.isDevToolsOpened()) contents.closeDevTools()
    else contents.openDevTools({ mode: 'detach' })
  }

  navigate(id: WorkspaceId, rawUrl: string): void {
    if (!isWorkspaceId(id)) throw new Error('Unknown workspace.')
    const normalized = normalizePairingUrl(rawUrl)
    if (!normalized.ok) throw new Error(normalized.error)
    if (id === 'browser') {
      this.browser.navigate(normalized.value)
      return
    }
    const view = this.ensureView(id)
    if (!view) return
    void view.webContents.loadURL(normalized.value, { userAgent: browserUserAgent() }).catch(() => {
      /* did-fail-load handles the banner */
    })
  }

  openT3Pairing(rawUrl: string): void {
    const normalized = normalizePairingUrl(rawUrl)
    if (!normalized.ok) throw new Error(normalized.error)
    const view = this.ensureView('t3')
    if (!view) return
    this.activeId = 't3'
    this.secondaryId = null
    this.options.saveSettings({ lastWorkspaceId: 't3', lastSecondaryId: null })
    const clean = stripUrlSecrets(normalized.value)
    if (clean) {
      const settings = this.options.getSettings()
      this.options.saveSettings({ lastUrls: { ...settings.lastUrls, t3: clean } })
    }
    this.layout()
    void view.webContents.loadURL(normalized.value, { userAgent: browserUserAgent() }).catch(() => {
      /* did-fail-load handles the banner */
    })
    this.emitNow()
  }

  zoom(id: WorkspaceId | undefined, direction: 'in' | 'out' | 'reset'): number {
    const target = id ?? (this.activeId === 'browser' ? 'browser' : this.activeId)
    if (!target) return 0
    const current = this.states[target]?.zoom ?? 0
    const next =
      direction === 'reset' ? 0 : Math.min(5, Math.max(-3, current + (direction === 'in' ? 0.5 : -0.5)))
    if (target === 'browser') {
      const contents = this.browser.activeTabView()?.webContents
      if (contents && !contents.isDestroyed()) contents.setZoomLevel(next)
    } else {
      const contents = this.views.get(target)?.webContents
      if (contents && !contents.isDestroyed()) contents.setZoomLevel(next)
    }
    const settings = this.options.getSettings()
    this.options.saveSettings({ zoom: { ...settings.zoom, [target]: next } })
    this.states[target] = { ...this.states[target], zoom: next } as WorkspaceRuntimeState
    this.scheduleEmit()
    return next
  }

  unload(id: WorkspaceId): void {
    if (!isWorkspaceId(id)) throw new Error('Unknown workspace.')
    if (id === this.activeId || id === this.secondaryId) {
      throw new Error('Switch away from this workspace before unloading it.')
    }
    if (id === 'browser') {
      throw new Error('Close Pulse Browser tabs to reclaim their memory.')
    }
    if (!this.views.has(id)) return
    this.disposeView(id)
    this.states[id] = {
      ...this.states[id],
      mounted: false,
      loading: false,
      crashed: false,
      error: null,
      memoryBytes: 0
    } as WorkspaceRuntimeState
    this.scheduleEmit()
  }

  newBrowserTab(url?: string): void {
    this.browser.newTab(url)
  }

  closeBrowserTab(id: string): void {
    this.browser.closeTab(id)
  }

  activateBrowserTab(id: string): void {
    this.browser.activateTab(id)
  }

  browserNavigate(url: string): void {
    this.browser.navigate(url)
  }

  browserBack(): void {
    this.browser.back()
  }

  browserForward(): void {
    this.browser.forward()
  }

  browserReload(): void {
    this.browser.reload()
  }

  browserStop(): void {
    this.browser.stop()
  }

  browserFind(text: string, forward: boolean): void {
    this.browser.find(text, forward)
  }

  browserFindStop(): void {
    this.browser.findStop()
  }

  isBrowserActive(): boolean {
    return this.activeId === 'browser'
  }

  destroy(): void {
    this.destroyed = true
    this.options.window.off('resize', this.onResize)
    if (this.metricsTimer) clearInterval(this.metricsTimer)
    if (this.emitTimer) clearTimeout(this.emitTimer)
    for (const timer of this.persistTimers.values()) clearTimeout(timer)
    this.persistTimers.clear()
    this.browser.destroy()
    for (const id of [...this.views.keys()]) this.disposeView(id)
  }

  private resolveTarget(id?: WorkspaceId): WorkspaceId | null {
    if (id) return isWorkspaceId(id) ? id : null
    if (this.activeId === 'browser') return 'browser'
    return this.activeId
  }

  private canSplitWith(id: WorkspaceId): boolean {
    if (id === 'browser' || id === 'cloud') return false
    if (!this.activeId || this.activeId === 'browser' || this.activeId === 'cloud') return false
    if (this.activeId === id) return false
    return Boolean(this.views.get(this.activeId)) || getWorkspace(this.activeId).kind === 'web'
  }

  private resumeUrl(id: WorkspaceId): string {
    const settings = this.options.getSettings()
    const last = settings.lastUrls[id]
    if (last && /^https?:\/\//i.test(last)) return last
    return workspaceUrl(id, settings.workspaceUrls)
  }

  private ensureView(id: WorkspaceId): WebContentsView | null {
    const workspace = getWorkspace(id)
    if (workspace.kind !== 'web') return null
    const existing = this.views.get(id)
    if (existing) return existing

    const settings = this.options.getSettings()
    const partition = partitionFor(id, settings.isolatedWorkspaces)
    workspaceSession(partition)
    const view = new WebContentsView({
      webPreferences: browserWebPreferences(partition)
    })
    view.setBackgroundColor('#0B0E14')
    view.setVisible(false)
    this.options.window.contentView.addChildView(view)
    this.views.set(id, view)

    const initialUrl = this.resumeUrl(id)
    this.states[id] = {
      ...this.states[id],
      mounted: true,
      loading: true,
      crashed: false,
      error: null,
      url: stripUrlSecrets(initialUrl) || initialUrl,
      title: this.states[id]?.title ?? workspace.name,
      zoom: settings.zoom[id] ?? 0,
      lastActiveAt: Date.now()
    } as WorkspaceRuntimeState

    const contents = view.webContents
    contents.setZoomLevel(settings.zoom[id] ?? 0)
    this.bindView(id, view, partition)
    void contents.loadURL(initialUrl, { userAgent: browserUserAgent() }).catch(() => {
      /* did-fail-load handles the banner */
    })
    this.scheduleEmit()
    return view
  }

  private bindView(id: WorkspaceId, view: WebContentsView, partition: string): void {
    const contents = view.webContents
    const workspace = getWorkspace(id)
    this.options.bindShortcuts(contents)

    contents.setWindowOpenHandler(({ url }) => {
      if (isAuthPopupUrl(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: authPopupOptions(partition, this.options.window)
        }
      }
      this.openExternalLink(url)
      return { action: 'deny' }
    })
    contents.on('did-create-window', (child) => {
      bindAuthPopupWindow(child, partition, this.options.window, (url) => this.openExternalLink(url))
    })

    const touch = (): void => {
      if (this.destroyed) return
      this.syncViewState(id)
    }

    contents.on('did-start-loading', () => {
      const state = this.states[id]
      if (!state) return
      this.states[id] = { ...state, loading: true, error: null }
      this.scheduleEmit()
    })
    contents.on('did-stop-loading', () => {
      touch()
      const state = this.states[id]
      if (!state) return
      this.states[id] = { ...state, loading: false }
      this.layout()
      this.scheduleEmit()
    })
    contents.on('did-navigate', touch)
    contents.on('did-navigate-in-page', touch)
    contents.on('page-title-updated', (_event, title) => {
      const state = this.states[id]
      if (!state) return
      this.states[id] = { ...state, title: title?.trim() || workspace.name }
      this.scheduleEmit()
    })
    contents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return
      const state = this.states[id]
      if (!state) return
      this.states[id] = {
        ...state,
        loading: false,
        error: `${errorDescription || 'Page failed to load'} (${errorCode})`
      }
      view.setVisible(false)
      this.scheduleEmit()
    })
    contents.on('render-process-gone', (_event, details) => {
      if (this.destroyed) return
      const state = this.states[id]
      if (!state) return
      this.states[id] = {
        ...state,
        crashed: true,
        loading: false,
        error: `Renderer stopped (${details.reason}).`
      }
      view.setVisible(false)
      this.scheduleEmit()
      this.options.onCrash(
        `${workspace.name} crashed`,
        'Only this workspace was affected. Use the recovery banner to reload it.'
      )
    })
    contents.on('unresponsive', () => {
      this.options.onCrash(
        `${workspace.name} is unresponsive`,
        'The workspace process is busy. You can wait or reload it from the titlebar.'
      )
    })
    contents.on('enter-html-full-screen', () => this.options.window.setFullScreen(true))
    contents.on('leave-html-full-screen', () => this.options.window.setFullScreen(false))
    contents.on('context-menu', (_event, params) => {
      const template: MenuItemConstructorOptions[] = []
      if (params.linkURL && isAllowedExternalUrl(params.linkURL)) {
        template.push(
          {
            label: 'Open link in Pulse Browser',
            click: () => this.browser.newTab(params.linkURL)
          },
          {
            label: 'Open link in system browser',
            click: () => void shell.openExternal(params.linkURL)
          },
          { type: 'separator' }
        )
      }
      if (params.selectionText) {
        template.push(
          { label: 'Copy', click: () => contents.copy() },
          { type: 'separator' }
        )
      }
      if (params.isEditable) {
        template.push(
          { label: 'Paste', enabled: params.editFlags.canPaste, click: () => contents.paste() },
          { type: 'separator' }
        )
      }
      template.push(
        {
          label: 'Back',
          enabled: contents.navigationHistory.canGoBack(),
          click: () => contents.navigationHistory.goBack()
        },
        {
          label: 'Forward',
          enabled: contents.navigationHistory.canGoForward(),
          click: () => contents.navigationHistory.goForward()
        },
        { label: 'Reload workspace', click: () => this.reload(id) },
        { type: 'separator' },
        {
          label: 'Inspect element',
          click: () => contents.inspectElement(params.x, params.y)
        }
      )
      Menu.buildFromTemplate(template).popup({ window: this.options.window })
    })
  }

  private syncViewState(id: WorkspaceId): void {
    const view = this.views.get(id)
    if (!view || view.webContents.isDestroyed()) return
    const contents = view.webContents
    const state = this.states[id]
    if (!state) return
    const currentUrl = stripUrlSecrets(contents.getURL())
    this.states[id] = {
      ...state,
      url: currentUrl || state.url,
      title: contents.getTitle()?.trim() || state.title,
      loading: contents.isLoading(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward()
    }
    this.schedulePersistResume(id)
    this.scheduleEmit()
  }

  private schedulePersistResume(id: WorkspaceId): void {
    const existing = this.persistTimers.get(id)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.persistTimers.delete(id)
      const view = this.views.get(id)
      if (!view || view.webContents.isDestroyed()) return
      const clean = stripUrlSecrets(view.webContents.getURL())
      if (!clean || !/^https?:\/\//i.test(clean) || clean.length > 2048) return
      const settings = this.options.getSettings()
      this.options.saveSettings({ lastUrls: { ...settings.lastUrls, [id]: clean } })
    }, 800)
    this.persistTimers.set(id, timer)
  }

  private openExternalLink(url: string): void {
    if (!isAllowedExternalUrl(url)) return
    this.options.onExternalLink(url)
  }

  private handleBrowserSnapshot(snapshot: BrowserSnapshot): void {
    const active = snapshot.tabs.find((tab) => tab.id === snapshot.activeId)
    const previous = this.states.browser
    if (!previous) return
    this.states.browser = {
      ...previous,
      mounted: snapshot.tabs.length > 0,
      loading: active?.loading ?? false,
      crashed: active?.crashed ?? false,
      error: active?.error ?? null,
      title: active?.title ?? 'Pulse Browser',
      url: active?.url ?? previous.url,
      canGoBack: active?.canGoBack ?? false,
      canGoForward: active?.canGoForward ?? false
    }
    this.options.onBrowser(snapshot)
    this.scheduleEmit()
  }

  private layout(): void {
    if (this.destroyed || this.options.window.isDestroyed()) return
    const [width, height] = this.options.window.getContentSize()
    const browserChrome = this.activeId === 'browser' ? BROWSER_CHROME_HEIGHT : 0
    const splitEligible =
      Boolean(this.activeId) &&
      Boolean(this.secondaryId) &&
      this.activeId !== 'browser' &&
      this.activeId !== 'cloud' &&
      this.secondaryId !== 'browser' &&
      this.secondaryId !== 'cloud' &&
      this.activeId !== this.secondaryId

    this.layoutResult = computeWorkspaceLayout({
      windowWidth: width ?? 0,
      windowHeight: height ?? 0,
      railWidth: this.railWidth,
      browserChromeHeight: browserChrome,
      split: splitEligible,
      ratio: this.splitRatio,
      zen: this.zen
    })

    const nextSplit = this.layoutResult.split
    const splitChanged = nextSplit !== this.currentSplit
    this.currentSplit = nextSplit

    const visible = new Set<WorkspaceId>()
    if (!this.overlayVisible) {
      if (this.activeId && this.activeId !== 'browser' && this.activeId !== 'cloud') {
        const view = this.views.get(this.activeId)
        const state = this.states[this.activeId]
        if (view && state && !state.crashed && !state.error) {
          view.setBounds(this.layoutResult.primary)
          view.setVisible(true)
          visible.add(this.activeId)
        }
      }
      if (this.layoutResult.split && this.secondaryId) {
        const view = this.views.get(this.secondaryId)
        const state = this.states[this.secondaryId]
        if (view && state && !state.crashed && !state.error && this.layoutResult.secondary) {
          view.setBounds(this.layoutResult.secondary)
          view.setVisible(true)
          visible.add(this.secondaryId)
        }
      }
    }

    for (const [id, view] of this.views) {
      if (!visible.has(id)) view.setVisible(false)
    }

    this.browser.setRect(this.layoutResult.primary)
    this.browser.setActive(this.activeId === 'browser' && !this.overlayVisible)

    if (splitChanged) this.scheduleEmit()
  }

  private refreshMetrics(): void {
    if (this.destroyed) return
    try {
      const metrics = app.getAppMetrics()
      const memoryByPid = new Map<number, number>()
      for (const metric of metrics) {
        memoryByPid.set(metric.pid, (metric.memory?.workingSetSize ?? 0) * 1024)
      }
      this.appMemoryBytes = metrics.reduce(
        (total, metric) => total + (metric.memory?.workingSetSize ?? 0) * 1024,
        0
      )
      for (const [id, view] of this.views) {
        if (view.webContents.isDestroyed()) continue
        const pid = view.webContents.getOSProcessId()
        this.states[id] = {
          ...this.states[id],
          memoryBytes: memoryByPid.get(pid) ?? 0
        } as WorkspaceRuntimeState
      }
      const browserMemory = this.browser
        .pids()
        .reduce((total, pid) => total + (memoryByPid.get(pid) ?? 0), 0)
      this.states.browser = { ...this.states.browser, memoryBytes: browserMemory } as WorkspaceRuntimeState
    } catch {
      /* metrics are best-effort */
    }
    this.scheduleEmit()
  }

  private disposeView(id: WorkspaceId): void {
    const view = this.views.get(id)
    if (!view) return
    this.views.delete(id)
    try {
      this.options.window.contentView.removeChildView(view)
    } catch {
      /* already removed */
    }
    try {
      if (!view.webContents.isDestroyed()) view.webContents.close()
    } catch {
      /* already destroyed */
    }
  }

  private scheduleEmit(): void {
    if (this.destroyed || this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null
      this.emitNow()
    }, 80)
  }

  private emitNow(): void {
    if (this.destroyed) return
    if (this.emitTimer) {
      clearTimeout(this.emitTimer)
      this.emitTimer = null
    }
    const runtime = this.getRuntime()
    this.options.onRuntime(runtime)
    this.options.onActive(this.shareInfo())
  }
}
