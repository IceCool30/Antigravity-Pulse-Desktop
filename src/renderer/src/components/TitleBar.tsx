import { useEffect, useRef } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Columns2,
  Copy,
  Maximize2,
  Minimize2,
  Minus,
  MonitorSmartphone,
  Search,
  Settings2,
  Square,
  X
} from 'lucide-react'
import { MIN_PANE_WIDTH, SPLIT_GAP, TITLEBAR_HEIGHT } from '@shared/layout'
import { WORKSPACES, getWorkspace, type WorkspaceId } from '@shared/workspaces'
import { errorMessage, invoke } from '../lib/api'
import { displayUrl, formatBytes, hostFromUrl } from '../lib/format'
import { useWindowSize } from '../lib/useWindowSize'
import { useShell } from '../store/shell'
import { OrbitMark, WorkspaceGlyph } from './BrandIcons'
import { IconButton } from './ui/IconButton'
import { Kbd } from './ui/Kbd'
import { Meter } from './ui/Meter'

const MEMORY_BUDGET_BYTES = 2 * 1024 * 1024 * 1024

function SplitMenu({ anchorRight }: { anchorRight: number }) {
  const runtime = useShell((state) => state.runtime)
  const setSplitMenuOpen = useShell((state) => state.setSplitMenuOpen)
  const pushToast = useShell((state) => state.pushToast)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeId = runtime?.activeId ?? null
  const split = runtime?.split === true

  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>('button')
    first?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSplitMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setSplitMenuOpen])

  const choose = (id: WorkspaceId): void => {
    setSplitMenuOpen(false)
    void invoke('workspace:activate', { id, secondary: true }).catch((error: unknown) =>
      pushToast({ title: 'Could not open split', body: errorMessage(error), kind: 'error' })
    )
  }

  const closeSplit = (): void => {
    setSplitMenuOpen(false)
    void invoke('workspace:clearSplit', undefined).catch((error: unknown) =>
      pushToast({ title: 'Could not close split', body: errorMessage(error), kind: 'error' })
    )
  }

  const candidates = WORKSPACES.filter(
    (workspace) => workspace.kind === 'web' && workspace.id !== 'browser' && workspace.id !== activeId
  )

  return (
    <>
      <div
        className="titlebar-no-drag fixed inset-0 z-40"
        onMouseDown={() => setSplitMenuOpen(false)}
        aria-hidden
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Split workspace"
        className="titlebar-no-drag glass anim-scale-in fixed top-[40px] z-50 w-[240px] rounded-xl p-1.5"
        style={{ right: anchorRight }}
      >
        {split ? (
          <button
            type="button"
            role="menuitem"
            onClick={closeSplit}
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-fg hover:bg-hover"
          >
            <X size={14} aria-hidden />
            Close split
          </button>
        ) : null}
        <p className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-muted">
          {split ? 'Switch secondary' : 'Open in split'}
        </p>
        {candidates.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            role="menuitem"
            onClick={() => choose(workspace.id)}
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs text-fg hover:bg-hover"
          >
            <WorkspaceGlyph icon={workspace.icon} size={14} className="text-muted" />
            <span className="flex-1 truncate">{workspace.name}</span>
            <span className="font-mono text-2xs text-muted">{workspace.shortcut}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export function TitleBar() {
  const zen = useShell((state) => state.zen)
  const runtime = useShell((state) => state.runtime)
  const bridge = useShell((state) => state.bridge)
  const maximized = useShell((state) => state.windowMaximized)
  const railExpanded = useShell((state) => state.railExpanded)
  const splitMenuOpen = useShell((state) => state.splitMenuOpen)
  const setSplitMenuOpen = useShell((state) => state.setSplitMenuOpen)
  const toggleZen = useShell((state) => state.toggleZen)
  const togglePalette = useShell((state) => state.togglePalette)
  const togglePhone = useShell((state) => state.togglePhone)
  const openSettings = useShell((state) => state.openSettings)
  const pushToast = useShell((state) => state.pushToast)
  const { width } = useWindowSize()

  if (zen) return null

  const activeId = runtime?.activeId ?? null
  const activeWorkspace = activeId ? getWorkspace(activeId) : null
  const activeState = activeId && runtime ? (runtime.states[activeId] ?? null) : null
  const activeHost = activeState ? hostFromUrl(displayUrl(activeState.url)) : ''
  const secondaryWorkspace = runtime?.secondaryId ? getWorkspace(runtime.secondaryId) : null
  const railWidth = railExpanded ? 220 : 56
  const splitEligible =
    activeId !== null &&
    activeId !== 'browser' &&
    activeId !== 'cloud' &&
    width >= MIN_PANE_WIDTH * 2 + SPLIT_GAP + railWidth
  const splitActive = runtime?.split === true
  // Pulse Browser already has its own back/forward controls in its 72px chrome;
  // Cloud Sync and Home have no web history. Every other workspace gets them here.
  const showHistory = activeId !== null && activeId !== 'browser' && activeId !== 'cloud'
  const canGoBack = activeState?.canGoBack === true
  const canGoForward = activeState?.canGoForward === true

  const historyAction = (direction: 'back' | 'forward'): void => {
    if (!activeId) return
    void invoke(direction === 'back' ? 'workspace:back' : 'workspace:forward', { id: activeId }).catch(
      (error: unknown) =>
        pushToast({
          title: direction === 'back' ? 'Could not go back' : 'Could not go forward',
          body: errorMessage(error),
          kind: 'error'
        })
    )
  }

  const windowAction = (action: 'minimize' | 'maximize' | 'close'): void => {
    void invoke('app:window', { action }).catch((error: unknown) =>
      pushToast({ title: 'Window action failed', body: errorMessage(error), kind: 'error' })
    )
  }

  const clearSplit = (): void => {
    void invoke('workspace:clearSplit', undefined).catch((error: unknown) =>
      pushToast({ title: 'Could not close split', body: errorMessage(error), kind: 'error' })
    )
  }

  const splitTitle = splitActive
    ? 'Split options'
    : splitEligible
      ? 'Open a second workspace side by side'
      : activeId === 'browser' || activeId === 'cloud'
        ? 'Split needs a web workspace (not Pulse Browser or Cloud Sync)'
        : 'Window is too narrow for split'

  return (
    <header
      className="titlebar-drag fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 pl-3 backdrop-blur-md"
      style={{ height: TITLEBAR_HEIGHT }}
    >
      {/* Left: brand + active workspace */}
      <div className="flex min-w-0 items-center gap-2.5">
        <OrbitMark size={16} className="shrink-0 text-accent" />
        <span className="shrink-0 font-display text-[12.5px] font-semibold tracking-[0.02em]">
          Antigravity Pulse
        </span>
        {activeWorkspace ? (
          <>
            {showHistory ? (
              <>
                <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
                <IconButton
                  className="titlebar-no-drag"
                  size="sm"
                  label="Back (Alt+←)"
                  disabled={!canGoBack}
                  onClick={() => historyAction('back')}
                >
                  <ArrowLeft size={14} aria-hidden />
                </IconButton>
                <IconButton
                  className="titlebar-no-drag"
                  size="sm"
                  label="Forward (Alt+→)"
                  disabled={!canGoForward}
                  onClick={() => historyAction('forward')}
                >
                  <ArrowRight size={14} aria-hidden />
                </IconButton>
              </>
            ) : null}
            <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
            <span className="truncate text-xs text-fg">{activeWorkspace.name}</span>
            {activeHost ? (
              <span className="hidden truncate font-mono text-2xs text-muted sm:inline">
                {activeHost}
              </span>
            ) : null}
            {splitActive && secondaryWorkspace ? (
              <span className="titlebar-no-drag inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-elevated py-0.5 pl-2 pr-1 text-2xs text-muted">
                + {secondaryWorkspace.shortName}
                <button
                  type="button"
                  aria-label="Close split"
                  title="Close split"
                  onClick={clearSplit}
                  className="grid h-4 w-4 place-items-center rounded-full hover:bg-hover hover:text-fg"
                >
                  <X size={10} aria-hidden />
                </button>
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
            <span className="truncate text-xs text-muted">Home</span>
          </>
        )}
      </div>

      {/* Right: status + tools + window controls */}
      <div className="titlebar-no-drag flex h-full items-center">
        <span
          className="mr-1 hidden items-center gap-2 rounded-lg px-2 py-1 md:inline-flex"
          title={`App memory: ${formatBytes(runtime?.appMemoryBytes ?? 0)} of 2 GB budget`}
        >
          <span className="font-mono text-2xs text-muted">
            {formatBytes(runtime?.appMemoryBytes ?? 0)}
          </span>
          <Meter
            value={(runtime?.appMemoryBytes ?? 0) / MEMORY_BUDGET_BYTES}
            className="w-10"
            label="App memory against 2 GB budget"
          />
        </span>

        <IconButton
          label={splitTitle}
          active={splitActive}
          disabled={!splitEligible && !splitActive}
          onClick={() => setSplitMenuOpen(!splitMenuOpen)}
        >
          <Columns2 size={15} aria-hidden />
        </IconButton>
        <IconButton
          label={zen ? 'Exit zen mode' : 'Enter zen mode (Ctrl+\\)'}
          onClick={toggleZen}
        >
          {zen ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
        </IconButton>
        <button
          type="button"
          onClick={togglePalette}
          aria-label="Open command palette"
          title="Command palette"
          className="mx-1 inline-flex h-7 items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 text-xs text-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
        >
          <Search size={13} aria-hidden />
          <Kbd>Ctrl K</Kbd>
        </button>
        <IconButton label="Phone Companion (Ctrl+Shift+P)" onClick={togglePhone} className="relative">
          <MonitorSmartphone size={15} aria-hidden />
          {bridge?.running ? (
            <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-online" />
          ) : null}
        </IconButton>
        <IconButton label="Settings (Ctrl+,)" onClick={() => openSettings()}>
          <Settings2 size={15} aria-hidden />
        </IconButton>

        <span aria-hidden className="mx-1 h-4 w-px bg-line" />

        <button
          type="button"
          aria-label="Minimize window"
          title="Minimize"
          onClick={() => windowAction('minimize')}
          className="grid h-full w-[46px] place-items-center text-muted transition-colors duration-100 hover:bg-hover hover:text-fg"
        >
          <Minus size={15} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={maximized ? 'Restore window' : 'Maximize window'}
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => windowAction('maximize')}
          className="grid h-full w-[46px] place-items-center text-muted transition-colors duration-100 hover:bg-hover hover:text-fg"
        >
          {maximized ? <Copy size={13} aria-hidden /> : <Square size={12} aria-hidden />}
        </button>
        <button
          type="button"
          aria-label="Close window"
          title="Close"
          onClick={() => windowAction('close')}
          className="grid h-full w-[46px] place-items-center text-muted transition-colors duration-100 hover:bg-[#E81123] hover:text-white"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      {splitMenuOpen ? <SplitMenu anchorRight={190} /> : null}
    </header>
  )
}
