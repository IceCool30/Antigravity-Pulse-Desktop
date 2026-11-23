import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { WORKSPACES, type WorkspaceDefinition } from '@shared/workspaces'
import { normalizeHttpUrl } from '@shared/validation'
import { errorMessage, invoke } from '../../lib/api'
import { zoomPercent } from '../../lib/format'
import { useShell, workspaceState } from '../../store/shell'
import { WorkspaceGlyph } from '../BrandIcons'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { Kbd } from '../ui/Kbd'
import { Toggle } from '../ui/Toggle'
import { SectionHint, SectionTitle } from './SettingRow'

function WorkspaceRow({ workspace }: { workspace: WorkspaceDefinition }) {
  const settings = useShell((state) => state.settings)
  const runtime = useShell((state) => state.runtime)
  const patchSettings = useShell((state) => state.patchSettings)
  const pushToast = useShell((state) => state.pushToast)
  const override = settings.workspaceUrls[workspace.id] ?? ''
  const [draft, setDraft] = useState(override)
  const [error, setError] = useState<string | null>(null)
  const state = workspaceState(runtime, workspace.id)
  const zoom = state?.zoom ?? settings.zoom[workspace.id] ?? 0
  const isolated = settings.isolatedWorkspaces.includes(workspace.id)
  const isCloud = workspace.id === 'cloud'

  useEffect(() => {
    setDraft(override)
    setError(null)
  }, [override])

  const commit = (): void => {
    const trimmed = draft.trim()
    if (!trimmed) {
      if (override) {
        const next = { ...settings.workspaceUrls }
        delete next[workspace.id]
        patchSettings({ workspaceUrls: next })
      }
      setError(null)
      return
    }
    const result = normalizeHttpUrl(trimmed)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    patchSettings({ workspaceUrls: { ...settings.workspaceUrls, [workspace.id]: result.value } })
  }

  const setIsolated = (checked: boolean): void => {
    const next = checked
      ? [...settings.isolatedWorkspaces.filter((id) => id !== workspace.id), workspace.id]
      : settings.isolatedWorkspaces.filter((id) => id !== workspace.id)
    patchSettings({ isolatedWorkspaces: next })
  }

  const resetZoom = (): void => {
    void invoke('workspace:zoom', { id: workspace.id, direction: 'reset' }).catch((error: unknown) =>
      pushToast({ title: 'Zoom reset failed', body: errorMessage(error), kind: 'error' })
    )
  }

  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <WorkspaceGlyph icon={workspace.icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{workspace.name}</p>
          <p className="text-2xs text-muted">{workspace.shortName}</p>
        </div>
        <Kbd>{workspace.shortcut}</Kbd>
      </div>

      {isCloud ? (
        <div className="mt-3">
          <Badge variant="accent">Native surface</Badge>
          <p className="mt-2 text-xs text-muted">
            Cloud Sync is drawn by the app itself — no URL override.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <Field
              label="URL override"
              htmlFor={`ws-url-${workspace.id}`}
              error={error}
              className="flex-1"
            >
              <TextInput
                id={`ws-url-${workspace.id}`}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  if (error) setError(null)
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commit()
                  }
                }}
                placeholder={workspace.url}
                invalid={Boolean(error)}
                spellCheck={false}
                className="font-mono text-xs"
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              className="mb-0.5"
              disabled={!override}
              onClick={() => {
                const next = { ...settings.workspaceUrls }
                delete next[workspace.id]
                patchSettings({ workspaceUrls: next })
                setDraft('')
                setError(null)
              }}
            >
              Reset
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-xs text-muted">
              <Toggle
                label={`Isolate session for ${workspace.name}`}
                checked={isolated}
                onChange={setIsolated}
              />
              Isolate session
            </label>
            <span className="inline-flex items-center gap-2 text-xs text-muted">
              Zoom
              <span className="font-mono text-fg">{zoomPercent(zoom)}</span>
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={12} aria-hidden />}
                onClick={resetZoom}
                aria-label={`Reset zoom for ${workspace.name}`}
              >
                Reset
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function WorkspacesSection() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionTitle>Workspaces</SectionTitle>
        <SectionHint>
          Overrides apply on the next load. Isolated workspaces get their own session partition.
        </SectionHint>
      </div>
      {WORKSPACES.map((workspace) => (
        <WorkspaceRow key={workspace.id} workspace={workspace} />
      ))}
    </div>
  )
}
