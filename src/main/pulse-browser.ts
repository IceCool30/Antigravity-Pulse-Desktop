import {
  Menu,
  WebContentsView,
  clipboard,
  shell,
  type BrowserWindow,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import { randomUUID } from 'node:crypto'
import type { BrowserSnapshot, BrowserTab } from '@shared/ipc'
import type { Settings } from '@shared/settings'
import type { Rect } from '@shared/layout'
import { WORKSPACES } from '@shared/workspaces'
import {
  coerceAddressInput,
  isAllowedExternalUrl,
  normalizePairingUrl,
  stripUrlSecrets
} from '@shared/validation'
import { authPopupOptions, isAuthPopupUrl } from './popups'
import { browserUserAgent, partitionFor, workspaceSession } from './sessions'

interface InternalTab extends BrowserTab {
  view: WebContentsView
}

export interface PulseBrowserOptions {
  window: BrowserWindow
  getSettings: () => Settings
  saveTabs: (patch: { browserTabs?: { url: string }[]; browserActiveIndex?: number }) => void
  onSnapshot: (snapshot: BrowserSnapshot) => void
  onActivate: () => void
  onFindResult: (result: { active: boolean; matches: number; activeMatch: number }) => void
  onCrash: (title: string, body: string) => void
  bindShortcuts: (contents: WebContents) => void
  openExternalLink: (url: string) => void
}

const MAX_TABS = 20
const DEFAULT_BROWSER_URL = WORKSPACES.find((workspace) => workspace.id === 'browser')?.url ?? 'https://www.google.com/'

export class PulseBrowser {
  private readonly tabs: InternalTab[] = []
  private readonly options: PulseBrowserOptions
  private activeId: string | null = null
  private active = false
  private rect: Rect | null = null
  private persistTimer: NodeJS.Timeout | null = null
  private destroyed = false

  constructor(options: PulseBrowserOptions) {
    this.options = options
  }

  ensureTab(): void {
    if (this.tabs.length === 0) {
      const settings = this.options.getSettings()
      const index = Math.min(settings.browserActiveIndex, Math.max(0, settings.browserTabs.length - 1))
      const seed = settings.browserTabs[index]?.url ?? DEFAULT_BROWSER_URL
      const tab = this.createTab(seed)
      this.activeId = tab.id
      this.applyVisibility()
      this.emit()
    }
  }

  newTab(url?: string): void {
    if (this.destroyed) return
    const normalized = url ? (coerceAddressInput(url) ?? DEFAULT_BROWSER_URL) : DEFAULT_BROWSER_URL
    if (this.tabs.length >= MAX_TABS) {
      const oldest = this.tabs[0]
      if (oldest) this.removeTab(oldest.id)
    }
    const tab = this.createTab(normalized)
    this.activeId = tab.id
    this.applyVisibility()
    this.emit()
    this.persistSoon()
    this.options.onActivate()
  }

  closeTab(id: string): void {
    if (this.destroyed) return
    const index = this.tabs.findIndex((tab) => tab.id === id)
    if (index < 0) return
    const wasActive = this.activeId === id
    this.removeTab(id)
    if (this.tabs.length === 0) {
      const tab = this.createTab(DEFAULT_BROWSER_URL)
      this.activeId = tab.id
    } else if (wasActive) {
      const neighbor = this.tabs[Math.min(index, this.tabs.length - 1)]
      this.activeId = neighbor?.id ?? null
    }
    this.applyVisibility()
    this.emit()
    this.persistSoon()
  }

  activateTab(id: string): void {
    if (this.destroyed) return
    if (!this.tabs.some((tab) => tab.id === id)) return
    this.activeId = id
    this.applyVisibility()
    this.emit()
    this.persistSoon()
  }

  navigate(raw: string): void {
    const normalized = coerceAddressInput(raw)
    const tab = this.activeTab()
    if (!normalized || !tab || tab.view.webContents.isDestroyed()) return
    void tab.view.webContents.loadURL(normalized, { userAgent: browserUserAgent() }).catch(() => {
      /* did-fail-load handles the UI state */
    })
  }

  back(): void {
    const contents = this.activeTab()?.view.webContents
    if (!contents || contents.isDestroyed() || !contents.navigationHistory.canGoBack()) return
    contents.navigationHistory.goBack()
  }

  forward(): void {
    const contents = this.activeTab()?.view.webContents
    if (!contents || contents.isDestroyed() || !contents.navigationHistory.canGoForward()) return
    contents.navigationHistory.goForward()
  }

  reload(): void {
    const contents = this.activeTab()?.view.webContents
    if (!contents || contents.isDestroyed()) return
    contents.reload()
  }

  stop(): void {
    const contents = this.activeTab()?.view.webContents
    if (!contents || contents.isDestroyed()) return
    contents.stop()
  }

  find(text: string, forward: boolean): void {
    const contents = this.activeTab()?.view.webContents
    if (!contents || contents.isDestroyed()) return
    if (!text) {
      this.findStop()
      return
    }
    contents.findInPage(text, { forward, findNext: true, matchCase: false })
  }

  findStop(): void {
    const contents = this.activeTab()?.view.webContents
    if (contents && !contents.isDestroyed()) {
      contents.stopFindInPage('clearSelection')
    }
    this.options.onFindResult({ active: false, matches: 0, activeMatch: 0 })
  }

  setActive(active: boolean): void {
    this.active = active
    this.applyVisibility()
  }

  setRect(rect: Rect): void {
    this.rect = rect
    this.applyVisibility()
  }

  activeTabView(): WebContentsView | null {
    return this.activeTab()?.view ?? null
  }

  pids(): number[] {
    const output: number[] = []
    for (const tab of this.tabs) {
      if (tab.view.webContents.isDestroyed()) continue
      const pid = tab.view.webContents.getOSProcessId()
      if (pid > 0) output.push(pid)
    }
    return output
  }

  activeShareUrl(): string | null {
    return this.activeTab()?.url || null
  }

  snapshot(): BrowserSnapshot {
    return {
      tabs: this.tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        loading: tab.loading,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward,
        crashed: tab.crashed,
        error: tab.error
      })),
      activeId: this.activeId,
      visible: this.active && Boolean(this.rect)
    }
  }

  destroy(): void {
    this.destroyed = true
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = null
    for (const tab of [...this.tabs]) this.removeTab(tab.id)
  }

  private activeTab(): InternalTab | null {
    return this.tabs.find((tab) => tab.id === this.activeId) ?? null
  }

  private createTab(url: string): InternalTab {
    const settings = this.options.getSettings()
    const partition = partitionFor('browser', settings.isolatedWorkspaces)
    workspaceSession(partition)
    const view = new WebContentsView({
      webPreferences: {
        partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true,
        backgroundThrottling: true
      }
    })
    view.setBackgroundColor('#0B0E14')
    view.setVisible(false)
    this.options.window.contentView.addChildView(view)

    const tab: InternalTab = {
      id: `tab_${randomUUID()}`,
      view,
      title: 'New Tab',
      url: stripUrlSecrets(url) || DEFAULT_BROWSER_URL,
      loading: true,
      canGoBack: false,
      canGoForward: false,
      crashed: false,
      error: null
    }
    this.tabs.push(tab)
    this.bindTab(tab, partition)
    const contents = view.webContents
    void contents.loadURL(url, { userAgent: browserUserAgent() }).catch(() => {
      /* surfaced through did-fail-load */
    })
    return tab
  }

  private bindTab(tab: InternalTab, partition: string): void {
    const contents = tab.view.webContents
    this.options.bindShortcuts(contents)

    contents.setWindowOpenHandler(({ url }) => {
      if (isAuthPopupUrl(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: authPopupOptions(partition, this.options.window)
        }
      }
      if (isAllowedExternalUrl(url)) {
        const behavior = this.options.getSettings().externalLinkBehavior
        if (behavior === 'pulse-browser') this.newTab(url)
        else void shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    const touch = (): void => {
      if (this.destroyed) return
      this.syncTab(tab)
      this.emit()
    }

    contents.on('did-start-loading', () => {
      tab.loading = true
      tab.error = null
      this.emit()
    })
    contents.on('did-stop-loading', () => {
      touch()
      tab.loading = false
      this.emit()
      this.persistSoon()
    })
    contents.on('did-navigate', touch)
    contents.on('did-navigate-in-page', touch)
    contents.on('page-title-updated', (_event, title) => {
      tab.title = title?.trim() || tab.title
      this.emit()
    })
    contents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return
      tab.error = `${errorDescription} (${errorCode})`
      tab.loading = false
      tab.view.setVisible(false)
      this.emit()
    })
    contents.on('render-process-gone', () => {
      if (this.destroyed) return
      tab.crashed = true
      tab.error = 'The tab renderer stopped responding.'
      tab.loading = false
      tab.view.setVisible(false)
      this.emit()
      this.options.onCrash('Pulse Browser tab crashed', 'Only this tab was affected. Reload it from the browser fallback.')
    })
    contents.on('found-in-page', (_event, result) => {
      if (typeof result.matches !== 'number') return
      this.options.onFindResult({
        active: true,
        matches: result.matches,
        activeMatch: result.activeMatchOrdinal ?? 0
      })
    })
    contents.on('enter-html-full-screen', () => this.options.window.setFullScreen(true))
    contents.on('leave-html-full-screen', () => this.options.window.setFullScreen(false))
    contents.on('context-menu', (_event, params) => {
      const template: MenuItemConstructorOptions[] = []
      if (params.linkURL && isAllowedExternalUrl(params.linkURL)) {
        template.push(
          {
            label: 'Open link in new tab',
            click: () => this.newTab(params.linkURL)
          },
          {
            label: 'Open link in system browser',
            click: () => void shell.openExternal(params.linkURL)
          },
          {
            label: 'Copy link address',
            click: () => clipboard.writeText(params.linkURL)
          },
          { type: 'separator' }
        )
      }
      if (params.selectionText) {
        template.push(
          {
            label: 'Copy',
            click: () => contents.copy()
          },
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
        { label: 'Reload', click: () => contents.reload() },
        { type: 'separator' },
        {
          label: 'Inspect element',
          click: () => contents.inspectElement(params.x, params.y)
        }
      )
      Menu.buildFromTemplate(template).popup({ window: this.options.window })
    })
  }

  private syncTab(tab: InternalTab): void {
    if (tab.view.webContents.isDestroyed()) return
    const contents = tab.view.webContents
    const url = stripUrlSecrets(contents.getURL())
    if (url) tab.url = url
    const title = contents.getTitle()
    if (title) tab.title = title
    tab.canGoBack = contents.navigationHistory.canGoBack()
    tab.canGoForward = contents.navigationHistory.canGoForward()
    tab.loading = contents.isLoading()
  }

  private removeTab(id: string): void {
    const index = this.tabs.findIndex((tab) => tab.id === id)
    if (index < 0) return
    const [tab] = this.tabs.splice(index, 1)
    if (!tab) return
    try {
      this.options.window.contentView.removeChildView(tab.view)
    } catch {
      /* view already detached */
    }
    try {
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()
    } catch {
      /* already destroyed */
    }
    if (this.activeId === id) this.activeId = null
  }

  private applyVisibility(): void {
    const active = this.activeTab()
    for (const tab of this.tabs) {
      const visible =
        this.active &&
        Boolean(this.rect) &&
        tab === active &&
        !tab.crashed &&
        !tab.error &&
        (this.rect?.width ?? 0) > 0 &&
        (this.rect?.height ?? 0) > 0
      tab.view.setVisible(visible)
      if (visible && this.rect) tab.view.setBounds(this.rect)
    }
    this.emit()
  }

  private emit(): void {
    if (this.destroyed) return
    this.options.onSnapshot(this.snapshot())
  }

  private persistSoon(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      const urls = this.tabs
        .map((tab) => stripUrlSecrets(tab.url))
        .filter((url) => /^https?:\/\//i.test(url))
        .slice(0, MAX_TABS)
        .map((url) => ({ url }))
      if (urls.length === 0) return
      const activeIndex = Math.max(
        0,
        this.tabs.findIndex((tab) => tab.id === this.activeId)
      )
      this.options.saveTabs({
        browserTabs: urls,
        browserActiveIndex: Math.min(activeIndex, urls.length - 1)
      })
    }, 600)
  }
}
