import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Cloud,
  Compass,
  Home as HomeIcon,
  Keyboard,
  Maximize2,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  SplitSquareHorizontal
} from 'lucide-react'
import { WORKSPACES, isWorkspaceId, type WorkspaceId } from '@shared/workspaces'
import { errorMessage, invoke } from '../lib/api'
import { displayUrl, hostFromUrl } from '../lib/format'
import { fuzzyScore } from '../lib/fuzzy'
import { useShell } from '../store/shell'
import { WorkspaceGlyph } from './BrandIcons'
import { useDialogBehavior } from './ui/Modal'
import { Kbd } from './ui/Kbd'

interface PaletteItem {
  id: string
  group: 'Workspaces' | 'Actions' | 'Resume'
  label: string
  keywords: string
  icon: ReactNode
  hint?: string
  run: () => void
}

export function CommandPalette() {
  const closePalette = useShell((state) => state.closePalette)
  const openSettings = useShell((state) => state.openSettings)
  const togglePhone = useShell((state) => state.togglePhone)
  const toggleZen = useShell((state) => state.toggleZen)
  const setSplitRatio = useShell((state) => state.setSplitRatio)
  const commitSplitRatio = useShell((state) => state.commitSplitRatio)
  const settings = useShell((state) => state.settings)
  const pushToast = useShell((state) => state.pushToast)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useDialogBehavior(panelRef, closePalette)

  const items = useMemo<PaletteItem[]>(() => {
    const activate = (id: WorkspaceId | null): void => {
      void invoke('workspace:activate', { id }).catch((error: unknown) =>
        pushToast({ title: 'Could not open workspace', body: errorMessage(error), kind: 'error' })
      )
    }
    const workspaces: PaletteItem[] = WORKSPACES.map((workspace) => ({
      id: `ws-${workspace.id}`,
      group: 'Workspaces',
      label: workspace.name,
      keywords: `${workspace.shortName} ${workspace.id} ${workspace.description} ${workspace.shortcut}`,
      icon: <WorkspaceGlyph icon={workspace.icon} size={15} />,
      hint: workspace.shortcut,
      run: () => activate(workspace.id)
    }))
    const actions: PaletteItem[] = [
      {
        id: 'act-home',
        group: 'Actions',
        label: 'Home',
        keywords: 'dashboard launchpad start',
        icon: <HomeIcon size={15} aria-hidden />,
        run: () => activate(null)
      },
      {
        id: 'act-settings',
        group: 'Actions',
        label: 'Settings',
        keywords: 'preferences appearance theme config',
        icon: <Settings2 size={15} aria-hidden />,
        hint: 'Ctrl+,',
        run: () => openSettings()
      },
      {
        id: 'act-phone',
        group: 'Actions',
        label: 'Phone Companion',
        keywords: 'bridge qr android pair mobile',
        icon: <MonitorSmartphone size={15} aria-hidden />,
        hint: 'Ctrl+Shift+P',
        run: () => togglePhone()
      },
      {
        id: 'act-cloud',
        group: 'Actions',
        label: 'Cloud Sync',
        keywords: 'firebase google firestore profiles prompts',
        icon: <Cloud size={15} aria-hidden />,
        run: () => activate('cloud')
      },
      {
        id: 'act-new-tab',
        group: 'Actions',
        label: 'New browser tab',
        keywords: 'pulse browser tab new',
        icon: <Plus size={15} aria-hidden />,
        hint: 'Ctrl+T',
        run: () => {
          void invoke('browser:newTab', {})
            .then(() => invoke('workspace:activate', { id: 'browser' }))
            .catch((error: unknown) =>
              pushToast({ title: 'Could not open a new tab', body: errorMessage(error), kind: 'error' })
            )
        }
      },
      {
        id: 'act-zen',
        group: 'Actions',
        label: 'Toggle zen',
        keywords: 'zen fullscreen focus hide chrome',
        icon: <Maximize2 size={15} aria-hidden />,
        hint: 'Ctrl+\\',
        run: () => toggleZen()
      },
      {
        id: 'act-reload',
        group: 'Actions',
        label: 'Reload workspace',
        keywords: 'refresh reload restart',
        icon: <RefreshCw size={15} aria-hidden />,
        hint: 'Ctrl+R',
        run: () => {
          void invoke('workspace:reload', {}).catch((error: unknown) =>
            pushToast({ title: 'Reload failed', body: errorMessage(error), kind: 'error' })
          )
        }
      },
      {
        id: 'act-updates',
        group: 'Actions',
        label: 'Check for updates',
        keywords: 'update version release check',
        icon: <RotateCcw size={15} aria-hidden />,
        run: () => {
          void invoke('app:checkUpdates', undefined)
            .then((status) =>
              pushToast({
                title:
                  status.state === 'available'
                    ? `Update available: ${status.latestVersion ?? 'new version'}`
                    : status.state === 'current'
                      ? 'You are on the latest version'
                      : status.state === 'error'
                        ? 'Update check failed'
                        : 'Checking for updates…',
                body: status.message,
                kind: status.state === 'error' ? 'error' : 'info'
              })
            )
            .catch((error: unknown) =>
              pushToast({ title: 'Update check failed', body: errorMessage(error), kind: 'error' })
            )
        }
      },
      {
        id: 'act-shortcuts',
        group: 'Actions',
        label: 'Keyboard shortcuts',
        keywords: 'keys accelerators cheat sheet help',
        icon: <Keyboard size={15} aria-hidden />,
        run: () => openSettings('shortcuts')
      },
      {
        id: 'act-reset-split',
        group: 'Actions',
        label: 'Reset split',
        keywords: 'split divider ratio reset close',
        icon: <SplitSquareHorizontal size={15} aria-hidden />,
        run: () => {
          void invoke('workspace:clearSplit', undefined).catch(() => undefined)
          setSplitRatio(0.5)
          commitSplitRatio()
        }
      }
    ]
    const resume: PaletteItem[] = Object.entries(settings.lastUrls)
      .filter(([id]) => isWorkspaceId(id))
      .slice(0, 3)
      .map(([id, url]) => {
        const clean = displayUrl(url)
        return {
          id: `resume-${id}`,
          group: 'Resume' as const,
          label: `Resume ${hostFromUrl(clean) || clean}`,
          keywords: `resume continue ${clean}`,
          icon: <Compass size={15} aria-hidden />,
          run: () => {
            if (!isWorkspaceId(id)) return
            void invoke('workspace:activate', { id })
              .then(() => invoke('workspace:navigate', { id, url: clean }))
              .catch((error: unknown) =>
                pushToast({ title: 'Could not resume', body: errorMessage(error), kind: 'error' })
              )
          }
        }
      })
    return [...workspaces, ...actions, ...resume]
  }, [
    settings.lastUrls,
    openSettings,
    togglePhone,
    toggleZen,
    setSplitRatio,
    commitSplitRatio,
    pushToast
  ])

  const filtered = useMemo(() => {
    const scored = items
      .map((item) => ({ item, score: fuzzyScore(query, `${item.label} ${item.keywords}`) }))
      .filter((entry) => entry.score >= 0)
    scored.sort((a, b) => b.score - a.score)
    // Display order is grouped; keyboard navigation must follow the same order.
    const groups: PaletteItem['group'][] = ['Workspaces', 'Actions', 'Resume']
    return groups.flatMap((group) => scored.filter((entry) => entry.item.group === group).map((entry) => entry.item))
  }, [items, query])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const clampedSelected = Math.min(selected, Math.max(0, filtered.length - 1))

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${clampedSelected}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [clampedSelected])

  const runItem = (item: PaletteItem): void => {
    closePalette()
    item.run()
  }

  const groups: PaletteItem['group'][] = ['Workspaces', 'Actions', 'Resume']

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center pt-[14vh]">
      <div
        className="absolute inset-0 bg-black/32 backdrop-blur-[2px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePalette()
        }}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        className="glass anim-scale-in relative flex h-fit max-h-[72vh] w-[620px] max-w-[92vw] flex-col overflow-hidden rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelected((value) => Math.min(value + 1, filtered.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected((value) => Math.max(value - 1, 0))
              } else if (event.key === 'Home') {
                event.preventDefault()
                setSelected(0)
              } else if (event.key === 'End') {
                event.preventDefault()
                setSelected(Math.max(0, filtered.length - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const item = filtered[clampedSelected]
                if (item) runItem(item)
              }
            }}
            placeholder="Search workspaces and actions…"
            aria-label="Search commands"
            className="h-12 min-w-0 flex-1 bg-transparent text-md text-fg placeholder:text-muted/50 focus:outline-none"
          />
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label="Commands">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No matches for “{query}”.
            </p>
          ) : (
            groups.map((group) => {
              const groupItems = filtered.filter((item) => item.group === group)
              if (groupItems.length === 0) return null
              return (
                <div key={group}>
                  <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    const index = filtered.indexOf(item)
                    const isSelected = index === clampedSelected
                    return (
                      <div
                        key={item.id}
                        role="option"
                        aria-selected={isSelected}
                        data-index={index}
                        onMouseEnter={() => setSelected(index)}
                        onClick={() => runItem(item)}
                        className={`relative flex h-10 cursor-pointer items-center gap-3 rounded-[10px] px-3 ${
                          isSelected ? 'bg-accent-soft' : ''
                        }`}
                      >
                        {isSelected ? (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent"
                          />
                        ) : null}
                        <span className={isSelected ? 'text-accent' : 'text-muted'}>{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                        {item.hint ? <Kbd>{item.hint}</Kbd> : null}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <footer className="flex items-center gap-4 border-t border-line px-4 py-2 text-2xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>esc</Kbd> close
          </span>
        </footer>
      </div>
    </div>,
    document.body
  )
}
