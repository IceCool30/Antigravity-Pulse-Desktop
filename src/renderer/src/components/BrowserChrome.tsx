import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  ExternalLink,
  LoaderCircle,
  Lock,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  ShieldAlert,
  SquareTerminal,
  Trash2,
  X,
  ZoomOut
} from 'lucide-react'
import { BROWSER_CHROME_HEIGHT, TITLEBAR_HEIGHT } from '@shared/layout'
import type { BrowserTab } from '@shared/ipc'
import { coerceAddressInput } from '@shared/validation'
import { errorMessage, invoke } from '../lib/api'
import { displayUrl } from '../lib/format'
import { useShell } from '../store/shell'
import { FindBar } from './FindBar'
import { Badge } from './ui/Badge'
import { IconButton } from './ui/IconButton'

function BrowserMenu({ top }: { top: number }) {
  const browser = useShell((state) => state.browser)
  const setBrowserMenuOpen = useShell((state) => state.setBrowserMenuOpen)
  const pushToast = useShell((state) => state.pushToast)
  const menuRef = useRef<HTMLDivElement>(null)
  const tabs = browser?.tabs ?? []

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setBrowserMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setBrowserMenuOpen])

  const run = (action: () => Promise<unknown>, failure: string): void => {
    setBrowserMenuOpen(false)
    void action().catch((error: unknown) =>
      pushToast({ title: failure, body: errorMessage(error), kind: 'error' })
    )
  }

  const clearTabs = (): void => {
    if (tabs.length === 0) return
    if (!window.confirm(`Close all ${tabs.length} browser tabs?`)) return
    run(async () => {
      for (const tab of tabs) {
        await invoke('browser:closeTab', { id: tab.id })
      }
    }, 'Could not clear tabs')
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={() => setBrowserMenuOpen(false)} aria-hidden />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Browser options"
        className="glass anim-scale-in fixed right-2 z-50 w-[220px] rounded-xl p-1.5"
        style={{ top }}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() =>
            run(async () => {
              const zoom = await invoke('workspace:zoom', { id: 'browser', direction: 'reset' })
              pushToast({ title: `Zoom reset (${zoom})`, kind: 'success' })
            }, 'Zoom reset failed')
          }
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-fg hover:bg-hover"
        >
          <ZoomOut size={14} aria-hidden />
          Reset zoom
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => run(() => invoke('workspace:devtools', { id: 'browser' }), 'DevTools failed')}
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-fg hover:bg-hover"
        >
          <SquareTerminal size={14} aria-hidden />
          Open DevTools
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={clearTabs}
          disabled={tabs.length === 0}
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-error hover:bg-hover disabled:opacity-40"
        >
          <Trash2 size={14} aria-hidden />
          Clear all tabs
        </button>
      </div>
    </>
  )
}

function TabButton({ tab, active }: { tab: BrowserTab; active: boolean }) {
  const pushToast = useShell((state) => state.pushToast)
  const close = (): void => {
    void invoke('browser:closeTab', { id: tab.id }).catch((error: unknown) =>
      pushToast({ title: 'Could not close tab', body: errorMessage(error), kind: 'error' })
    )
  }
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      title={displayUrl(tab.url)}
      onClick={() => {
        void invoke('browser:activateTab', { id: tab.id }).catch(() => undefined)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void invoke('browser:activateTab', { id: tab.id }).catch(() => undefined)
        }
      }}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault()
          close()
        }
      }}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      className={`group flex h-8 min-w-[150px] max-w-[220px] flex-1 cursor-pointer items-center gap-1.5 rounded-t-[10px] border border-b-0 px-2.5 text-xs transition-colors duration-150 ${
        active
          ? 'border-line bg-surface text-fg'
          : 'border-transparent text-muted hover:bg-hover hover:text-fg'
      }`}
    >
      {tab.loading ? (
        <LoaderCircle size={13} className="shrink-0 animate-spin text-accent" aria-hidden />
      ) : (
        <Compass size={13} className="shrink-0 text-muted" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{tab.title || 'New tab'}</span>
      <button
        type="button"
        aria-label={`Close tab ${tab.title || 'New tab'}`}
        title="Close tab"
        onClick={(event) => {
          event.stopPropagation()
          close()
        }}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg ${
          active ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
        }`}
      >
        <X size={11} aria-hidden />
      </button>
    </div>
  )
}

export function BrowserChrome() {
  const runtime = useShell((state) => state.runtime)
  const browser = useShell((state) => state.browser)
  const settings = useShell((state) => state.settings)
  const zen = useShell((state) => state.zen)
  const railExpanded = useShell((state) => state.railExpanded)
  const addressFocusNonce = useShell((state) => state.addressFocusNonce)
  const browserMenuOpen = useShell((state) => state.browserMenuOpen)
  const setBrowserMenuOpen = useShell((state) => state.setBrowserMenuOpen)
  const requestFindFocus = useShell((state) => state.requestFindFocus)
  const pushToast = useShell((state) => state.pushToast)
  const [addressDraft, setAddressDraft] = useState<string | null>(null)
  const addressRef = useRef<HTMLInputElement>(null)

  const tabs = browser?.tabs ?? []
  const activeTab = tabs.find((tab) => tab.id === browser?.activeId) ?? null
  const activeUrl = activeTab ? displayUrl(activeTab.url) : ''
  const secure = activeTab?.url.startsWith('https:') === true

  useEffect(() => {
    setAddressDraft(null)
  }, [activeTab?.id, activeTab?.url])

  useEffect(() => {
    if (addressFocusNonce > 0) {
      addressRef.current?.focus()
      addressRef.current?.select()
    }
  }, [addressFocusNonce])

  if (runtime?.activeId !== 'browser') return null

  const top = zen ? 0 : TITLEBAR_HEIGHT
  const left = zen ? 0 : railExpanded ? 220 : 56
  const isolated = settings.isolatedWorkspaces.includes('browser')

  const navigate = (): void => {
    const draft = addressDraft ?? activeUrl
    const url = coerceAddressInput(draft)
    setAddressDraft(null)
    addressRef.current?.blur()
    if (!url) {
      pushToast({ title: 'Enter a valid http(s) address', kind: 'error' })
      return
    }
    void invoke('browser:navigate', { url }).catch((error: unknown) =>
      pushToast({ title: 'Navigation failed', body: errorMessage(error), kind: 'error' })
    )
  }

  const run = (action: () => Promise<unknown>, failure: string): void => {
    void action().catch((error: unknown) =>
      pushToast({ title: failure, body: errorMessage(error), kind: 'error' })
    )
  }

  return (
    <section
      aria-label="Pulse Browser chrome"
      className="fixed right-0 z-20 border-b border-line bg-surface/95 backdrop-blur-md"
      style={{ top, left, height: BROWSER_CHROME_HEIGHT }}
    >
      {/* Row 1 — tab strip (40px) */}
      <div className="flex h-10 items-end gap-1 px-2">
        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto" role="tablist" aria-label="Browser tabs">
          {tabs.map((tab) => (
            <TabButton key={tab.id} tab={tab} active={tab.id === browser?.activeId} />
          ))}
        </div>
        <IconButton
          label="New tab (Ctrl+T)"
          size="sm"
          className="mb-0.5"
          onClick={() => run(() => invoke('browser:newTab', {}), 'Could not open a new tab')}
        >
          <Plus size={15} aria-hidden />
        </IconButton>
        <div className="mb-0.5 flex shrink-0 items-center gap-2 pl-1">
          <span
            className="font-mono text-2xs text-muted"
            title={`${tabs.length} open tabs (max 20)`}
          >
            {tabs.length}/20
          </span>
          <span className="hidden font-display text-xs font-semibold text-muted lg:inline">
            Pulse Browser
          </span>
          {isolated ? (
            <Badge variant="accent" title="This browser uses an isolated session">
              Isolated
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Row 2 — navigation + address (32px) */}
      <div className="relative flex h-8 items-center gap-1 px-2">
        <IconButton
          label="Back (Alt+Left)"
          size="sm"
          disabled={activeTab?.canGoBack !== true}
          onClick={() => run(() => invoke('browser:back', undefined), 'Back failed')}
        >
          <ArrowLeft size={14} aria-hidden />
        </IconButton>
        <IconButton
          label="Forward (Alt+Right)"
          size="sm"
          disabled={activeTab?.canGoForward !== true}
          onClick={() => run(() => invoke('browser:forward', undefined), 'Forward failed')}
        >
          <ArrowRight size={14} aria-hidden />
        </IconButton>
        {activeTab?.loading === true ? (
          <IconButton
            label="Stop loading"
            size="sm"
            onClick={() => run(() => invoke('browser:stop', undefined), 'Stop failed')}
          >
            <LoaderCircle size={14} className="animate-spin text-accent" aria-hidden />
          </IconButton>
        ) : (
          <IconButton
            label="Reload (Ctrl+R)"
            size="sm"
            disabled={!activeTab}
            onClick={() => run(() => invoke('browser:reload', undefined), 'Reload failed')}
          >
            <RotateCw size={14} aria-hidden />
          </IconButton>
        )}

        <input
          ref={addressRef}
          value={addressDraft ?? activeUrl}
          onChange={(event) => setAddressDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={() => setAddressDraft(null)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              navigate()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setAddressDraft(null)
              addressRef.current?.blur()
            }
          }}
          placeholder="Search or enter address"
          aria-label="Address bar"
          spellCheck={false}
          className="h-7 min-w-0 flex-1 rounded-[10px] border border-line bg-bg px-3 font-mono text-xs text-fg placeholder:text-muted/50 transition-colors duration-150 focus:border-accent/60 focus:outline-none"
        />

        <span
          className={`hidden h-7 shrink-0 items-center gap-1 rounded-[10px] border border-line px-2 font-mono text-2xs sm:inline-flex ${
            secure ? 'text-online' : 'text-warning'
          }`}
          title={secure ? 'Connection is secure (https)' : 'Connection is not secure (http)'}
        >
          {secure ? <Lock size={11} aria-hidden /> : <ShieldAlert size={11} aria-hidden />}
          {secure ? 'https' : 'http'}
        </span>
        <IconButton label="Find in page (Ctrl+F)" size="sm" onClick={requestFindFocus}>
          <Search size={14} aria-hidden />
        </IconButton>
        <IconButton
          label="Open in system browser"
          size="sm"
          disabled={!activeTab}
          onClick={() =>
            run(() => invoke('app:openExternal', { url: activeUrl }), 'Could not open system browser')
          }
        >
          <ExternalLink size={14} aria-hidden />
        </IconButton>
        <IconButton
          label="Browser options"
          size="sm"
          active={browserMenuOpen}
          onClick={() => setBrowserMenuOpen(!browserMenuOpen)}
        >
          <MoreHorizontal size={14} aria-hidden />
        </IconButton>

        <FindBar />
      </div>

      {/* 1px accent hairline */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-accent opacity-40" />

      {browserMenuOpen ? <BrowserMenu top={top + BROWSER_CHROME_HEIGHT + 4} /> : null}
    </section>
  )
}
