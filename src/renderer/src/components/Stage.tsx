import { BROWSER_CHROME_HEIGHT, SPLIT_GAP, computeWorkspaceLayout, type Rect } from '@shared/layout'
import { getWorkspace, workspaceUrl, type WorkspaceId } from '@shared/workspaces'
import { displayUrl } from '../lib/format'
import { rectStyle } from '../lib/rect'
import { useWindowSize } from '../lib/useWindowSize'
import { selectOverlayOpen, useShell, workspaceState } from '../store/shell'
import { WorkspaceGlyph } from './BrandIcons'
import { CrashCard } from './CrashCard'
import { SplitDivider } from './SplitDivider'
import { Badge } from './ui/Badge'
import { Spinner } from './ui/Spinner'
import { CloudSync } from './cloud/CloudSync'
import { Home } from './Home'

/**
 * What the user sees when the native view is hidden (overlay, crash, error)
 * or still warming up. Native WebContentsViews cover this layer when healthy.
 */
function StageFallback({ id, rect }: { id: WorkspaceId; rect: Rect }) {
  const runtime = useShell((state) => state.runtime)
  const settings = useShell((state) => state.settings)
  const workspace = getWorkspace(id)
  const state = workspaceState(runtime, id)
  const url = displayUrl(state?.url ?? workspaceUrl(id, settings.workspaceUrls))
  const warm = state?.mounted === true && state?.loading !== true && state?.crashed !== true && !state?.error

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{
        ...rectStyle(rect),
        background: 'radial-gradient(620px at 50% 38%, var(--accent-soft), transparent 72%)'
      }}
      aria-hidden
    >
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-fg opacity-[0.04]">
        <WorkspaceGlyph icon={workspace.icon} size={220} />
      </span>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-accent">
          <WorkspaceGlyph icon={workspace.icon} size={22} />
        </span>
        <p className="font-display text-md font-semibold leading-[1.15]">{workspace.name}</p>
        <p className="max-w-full truncate font-mono text-2xs text-muted">{url}</p>
        {state?.loading === true ? (
          <span className="inline-flex items-center gap-2 text-2xs text-muted">
            <Spinner size={12} label={`${workspace.name} is loading`} />
            Warming up
          </span>
        ) : warm ? (
          <Badge variant="online" dot>
            Warm
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

/** Gradient veil so a hidden native view never leaves a black hole. */
function StageVeil({ rect, activeId }: { rect: Rect; activeId: WorkspaceId }) {
  const workspace = getWorkspace(activeId)
  return (
    <div
      className="pointer-events-none absolute grid place-items-center"
      style={{
        ...rectStyle(rect),
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg) 72%, transparent), color-mix(in srgb, var(--bg) 88%, transparent))'
      }}
      aria-hidden
    >
      <div className="anim-fade-up flex flex-col items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-fg">
          <WorkspaceGlyph icon={workspace.icon} size={14} className="text-accent" />
          {workspace.name}
        </span>
        <p className="text-2xs text-muted">Workspace paused behind overlay</p>
      </div>
    </div>
  )
}

/**
 * Chrome-only stage. Native WebContentsViews are positioned by main at the
 * exact rects computed here; the renderer never embeds web content.
 */
export function Stage() {
  const runtime = useShell((state) => state.runtime)
  const zen = useShell((state) => state.zen)
  const railExpanded = useShell((state) => state.railExpanded)
  const splitRatio = useShell((state) => state.splitRatio)
  const overlayOpen = useShell(selectOverlayOpen)
  const { width, height } = useWindowSize()

  const activeId = runtime?.activeId ?? null
  const secondaryId = runtime?.secondaryId ?? null
  const railWidth = railExpanded ? 220 : 56
  const chromeHeight = activeId === 'browser' ? BROWSER_CHROME_HEIGHT : 0
  const layout = computeWorkspaceLayout({
    windowWidth: width,
    windowHeight: height,
    railWidth,
    browserChromeHeight: chromeHeight,
    split: runtime?.split === true,
    ratio: splitRatio,
    zen
  })

  const isWebActive = activeId !== null && activeId !== 'cloud'
  const primaryState = activeId ? workspaceState(runtime, activeId) : null
  const secondaryState = secondaryId ? workspaceState(runtime, secondaryId) : null
  const primaryFailed = primaryState?.crashed === true || Boolean(primaryState?.error)
  const secondaryFailed = secondaryState?.crashed === true || Boolean(secondaryState?.error)

  const veilRect: Rect | null =
    isWebActive && layout.primary.width > 0
      ? {
          x: layout.primary.x,
          y: layout.primary.y,
          width:
            (layout.secondary
              ? layout.secondary.x + layout.secondary.width
              : layout.primary.x + layout.primary.width) - layout.primary.x,
          height: layout.primary.height
        }
      : null

  return (
    <div className="absolute inset-0 z-0">
      {activeId === null ? (
        <div className="absolute overflow-hidden" style={rectStyle(layout.primary)}>
          <Home />
        </div>
      ) : null}
      {activeId === 'cloud' ? (
        <div className="absolute overflow-hidden" style={rectStyle(layout.primary)}>
          <CloudSync />
        </div>
      ) : null}

      {isWebActive && activeId ? <StageFallback id={activeId} rect={layout.primary} /> : null}
      {layout.secondary && secondaryId ? (
        <StageFallback id={secondaryId} rect={layout.secondary} />
      ) : null}

      {overlayOpen && veilRect && activeId ? <StageVeil rect={veilRect} activeId={activeId} /> : null}

      {primaryFailed && activeId ? <CrashCard id={activeId} rect={layout.primary} /> : null}
      {secondaryFailed && secondaryId && layout.secondary ? (
        <CrashCard id={secondaryId} rect={layout.secondary} />
      ) : null}

      {layout.divider && layout.secondary ? (
        <SplitDivider
          rect={layout.divider}
          contentLeft={layout.primary.x}
          contentWidth={layout.primary.width + layout.secondary.width + SPLIT_GAP}
        />
      ) : null}
    </div>
  )
}
