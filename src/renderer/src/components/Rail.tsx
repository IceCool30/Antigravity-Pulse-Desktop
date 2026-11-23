import { Eject, MonitorSmartphone, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react'
import { RAIL_COLLAPSED_WIDTH, RAIL_EXPANDED_WIDTH, TITLEBAR_HEIGHT } from '@shared/layout'
import { WORKSPACES, type WorkspaceDefinition } from '@shared/workspaces'
import { errorMessage, invoke } from '../lib/api'
import { formatBytes } from '../lib/format'
import { useShell, workspaceState } from '../store/shell'
import { WorkspaceGlyph } from './BrandIcons'
import { IconButton } from './ui/IconButton'
import { Meter } from './ui/Meter'

const MEMORY_BUDGET_BYTES = 2 * 1024 * 1024 * 1024

function RailItem({ workspace, expanded }: { workspace: WorkspaceDefinition; expanded: boolean }) {
  const runtime = useShell((state) => state.runtime)
  const pushToast = useShell((state) => state.pushToast)
  const state = workspaceState(runtime, workspace.id)
  const active = runtime?.activeId === workspace.id
  const mounted = state?.mounted === true
  const loading = state?.loading === true
  const failed = state?.crashed === true || Boolean(state?.error)
  const splittable = workspace.kind === 'web' && workspace.id !== 'browser'

  const activate = (secondary: boolean): void => {
    void invoke('workspace:activate', { id: workspace.id, secondary }).catch((error: unknown) =>
      pushToast({ title: `Could not open ${workspace.name}`, body: errorMessage(error), kind: 'error' })
    )
  }

  const unload = (): void => {
    if (!window.confirm(`Unload ${workspace.name}? It will reload the next time you open it.`)) return
    void invoke('workspace:unload', { id: workspace.id }).catch((error: unknown) =>
      pushToast({ title: 'Could not unload workspace', body: errorMessage(error), kind: 'error' })
    )
  }

  const tooltip = [
    workspace.name,
    workspace.shortcut,
    formatBytes(state?.memoryBytes ?? 0),
    mounted ? 'Pinned' : 'Not loaded'
  ].join(' · ')

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={`${workspace.name} (${workspace.shortcut})`}
        aria-current={active ? 'page' : undefined}
        title={tooltip}
        onClick={(event) => activate(event.altKey && splittable)}
        className={`relative flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.98] ${
          active ? 'text-accent' : 'text-muted hover:bg-hover hover:text-fg'
        }`}
      >
        {active ? (
          <span
            aria-hidden
            className="absolute -left-2 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
          />
        ) : null}
        <span
          className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] transition-colors duration-150 ${
            active ? 'bg-accent-soft' : 'bg-elevated group-hover:bg-hover'
          }`}
        >
          <WorkspaceGlyph icon={workspace.icon} size={18} />
          {loading ? <span aria-hidden className="shimmer absolute inset-0" /> : null}
          {failed ? (
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-error"
              title="Crashed"
            />
          ) : mounted ? (
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-accent"
            />
          ) : null}
        </span>
        {expanded ? (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate text-sm">{workspace.name}</span>
            <span className="shrink-0 font-mono text-2xs text-muted/70">{workspace.shortcut}</span>
          </span>
        ) : null}
      </button>
      {expanded && mounted && !active ? (
        <button
          type="button"
          aria-label={`Unload ${workspace.name}`}
          title={`Unload ${workspace.name}`}
          onClick={unload}
          className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md bg-elevated text-muted opacity-0 transition-opacity duration-150 hover:bg-hover hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Eject size={12} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

export function Rail() {
  const zen = useShell((state) => state.zen)
  const expanded = useShell((state) => state.railExpanded)
  const runtime = useShell((state) => state.runtime)
  const bridge = useShell((state) => state.bridge)
  const toggleRail = useShell((state) => state.toggleRail)
  const togglePhone = useShell((state) => state.togglePhone)
  const openSettings = useShell((state) => state.openSettings)

  if (zen) return null

  const width = expanded ? RAIL_EXPANDED_WIDTH : RAIL_COLLAPSED_WIDTH
  const appMemory = runtime?.appMemoryBytes ?? 0
  const pinnedCount = runtime?.pinnedCount ?? 0

  return (
    <nav
      aria-label="Workspaces"
      className="fixed bottom-0 left-0 z-20 flex flex-col border-r border-line bg-surface/95 backdrop-blur-md"
      style={{ top: TITLEBAR_HEIGHT, width }}
    >
      <div className="flex h-10 shrink-0 items-center gap-1 px-2">
        <IconButton
          label={expanded ? 'Collapse workspaces rail' : 'Expand workspaces rail'}
          onClick={toggleRail}
          size="sm"
        >
          {expanded ? <PanelLeftClose size={15} aria-hidden /> : <PanelLeftOpen size={15} aria-hidden />}
        </IconButton>
        {expanded ? (
          <span className="font-display text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
            Workspaces
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-1">
        {WORKSPACES.map((workspace) => (
          <RailItem key={workspace.id} workspace={workspace} expanded={expanded} />
        ))}
      </div>

      <div className="shrink-0 border-t border-line p-2">
        {expanded ? (
          <div className="panel mb-2 rounded-xl px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xs uppercase tracking-wide text-muted">Memory</span>
              <span className="font-mono text-2xs text-fg">{formatBytes(appMemory)}</span>
            </div>
            <Meter
              value={appMemory / MEMORY_BUDGET_BYTES}
              className="mt-1.5 w-full"
              label="App memory against 2 GB budget"
            />
            <p className="mt-1.5 text-2xs text-muted">Pinned {pinnedCount}</p>
          </div>
        ) : (
          <div
            className="mb-2 flex flex-col items-center gap-1"
            title={`App memory ${formatBytes(appMemory)} · Pinned ${pinnedCount}`}
          >
            <Meter value={appMemory / MEMORY_BUDGET_BYTES} className="w-7" label="App memory" />
            <span className="font-mono text-2xs text-muted">{pinnedCount}</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ${expanded ? '' : 'flex-col'}`}>
          <IconButton label="Phone Companion" onClick={togglePhone} className="relative">
            <MonitorSmartphone size={15} aria-hidden />
            {bridge?.running ? (
              <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-online" />
            ) : null}
          </IconButton>
          <IconButton label="Settings" onClick={() => openSettings()}>
            <Settings2 size={15} aria-hidden />
          </IconButton>
          {expanded ? <span className="flex-1" /> : null}
          <span className="px-1 font-mono text-2xs text-muted/70">v1.0.0</span>
        </div>
      </div>
    </nav>
  )
}
