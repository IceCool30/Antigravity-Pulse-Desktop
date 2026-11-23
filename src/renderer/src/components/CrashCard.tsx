import { AlertTriangle, Copy, ExternalLink, RotateCw } from 'lucide-react'
import type { Rect } from '@shared/layout'
import { getWorkspace, type WorkspaceId } from '@shared/workspaces'
import { errorMessage, invoke } from '../lib/api'
import { displayUrl } from '../lib/format'
import { rectStyle } from '../lib/rect'
import { useShell, workspaceState } from '../store/shell'
import { Button } from './ui/Button'

export function CrashCard({ id, rect }: { id: WorkspaceId; rect: Rect }) {
  const runtime = useShell((state) => state.runtime)
  const pushToast = useShell((state) => state.pushToast)
  const workspace = getWorkspace(id)
  const state = workspaceState(runtime, id)
  const url = displayUrl(state?.url ?? workspace.url)
  const reason = state?.error ?? 'The workspace process stopped unexpectedly.'

  const run = (action: () => Promise<unknown>, failure: string): void => {
    void action().catch((error: unknown) =>
      pushToast({ title: failure, body: errorMessage(error), kind: 'error' })
    )
  }

  return (
    <div className="absolute grid place-items-center p-6" style={rectStyle(rect)}>
      <div
        role="alert"
        className="panel anim-fade-up w-full max-w-sm rounded-2xl border-error/30 p-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-error/10 text-error">
            <AlertTriangle size={17} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold leading-[1.15]">
              {workspace.name} stopped
            </h3>
            <p className="mt-1 break-words text-xs text-muted">{reason}</p>
          </div>
        </div>
        <p className="mt-3 truncate font-mono text-2xs text-muted" title={url}>
          {url}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<RotateCw size={13} aria-hidden />}
            onClick={() => run(() => invoke('workspace:reload', { id }), 'Reload failed')}
          >
            Reload workspace
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink size={13} aria-hidden />}
            onClick={() =>
              run(() => invoke('browser:newTab', { url }), 'Could not open Pulse Browser')
            }
          >
            Open URL in Pulse Browser
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Copy size={13} aria-hidden />}
            onClick={() => {
              run(async () => {
                await invoke('app:copy', { text: url })
                pushToast({ title: 'URL copied', kind: 'success' })
              }, 'Copy failed')
            }}
          >
            Copy URL
          </Button>
        </div>
        <p className="mt-3 text-2xs text-muted">Other workspaces are unaffected.</p>
      </div>
    </div>
  )
}
