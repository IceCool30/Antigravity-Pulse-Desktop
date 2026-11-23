import { useState } from 'react'
import { ArrowUpRight, Link2, ShieldCheck } from 'lucide-react'
import { DEVELOPER, WORKSPACES, isWorkspaceId, type WorkspaceDefinition } from '@shared/workspaces'
import { normalizePairingUrl } from '@shared/validation'
import { errorMessage, invoke } from '../lib/api'
import { displayUrl, formatBytes, formatDate, greetingForHour, hostFromUrl } from '../lib/format'
import { useShell, workspaceState } from '../store/shell'
import { GitHubMark, WorkspaceGlyph } from './BrandIcons'
import { WelcomeCard } from './WelcomeCard'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Field, TextInput } from './ui/Field'
import { KbdCombo } from './ui/Kbd'

function LaunchCard({ workspace }: { workspace: WorkspaceDefinition }) {
  const runtime = useShell((state) => state.runtime)
  const bridge = useShell((state) => state.bridge)
  const pushToast = useShell((state) => state.pushToast)
  const state = workspaceState(runtime, workspace.id)
  const active = runtime?.activeId === workspace.id
  const mounted = state?.mounted === true
  const loading = state?.loading === true
  const failed = state?.crashed === true || Boolean(state?.error)
  const splittable = workspace.kind === 'web' && workspace.id !== 'browser'

  const open = (secondary: boolean): void => {
    void invoke('workspace:activate', { id: workspace.id, secondary }).catch((error: unknown) =>
      pushToast({ title: `Could not open ${workspace.name}`, body: errorMessage(error), kind: 'error' })
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${workspace.name}`}
      onClick={(event) => open(event.altKey && splittable)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open(event.altKey && splittable)
        }
      }}
      className={`panel group cursor-pointer rounded-2xl p-4 transition-[background-color,border-color,transform] duration-150 hover:bg-hover active:scale-[0.99] ${
        active ? 'border-accent/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
          <WorkspaceGlyph icon={workspace.icon} size={20} />
        </span>
        {failed ? (
          <Badge variant="error" dot>
            Stopped
          </Badge>
        ) : loading ? (
          <Badge variant="warning" dot>
            Loading
          </Badge>
        ) : mounted ? (
          <Badge variant="online" dot>
            Pinned
          </Badge>
        ) : (
          <Badge>Cold</Badge>
        )}
      </div>
      <h3 className="mt-3 font-display text-md font-semibold leading-[1.15]">{workspace.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-muted">{workspace.description}</p>
      {workspace.id === 'cloud' ? (
        <p className="mt-2 text-2xs text-muted">
          Phone bridge:{' '}
          <span className={bridge?.running ? 'text-online' : 'text-muted'}>
            {bridge?.running ? 'running' : 'off'}
          </span>
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <KbdCombo combo={workspace.shortcut} />
          <span className="font-mono text-2xs text-muted">
            {formatBytes(state?.memoryBytes ?? 0)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent opacity-70 transition-opacity duration-150 group-hover:opacity-100">
          Open
          <ArrowUpRight size={13} aria-hidden />
        </span>
      </div>
    </div>
  )
}

function T3PairingCard() {
  const pushToast = useShell((state) => state.pushToast)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    const result = normalizePairingUrl(url)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setBusy(true)
    try {
      await invoke('workspace:openT3Pairing', { url: result.value })
      setUrl('')
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught))
      pushToast({ title: 'Pairing failed', body: errorMessage(caught), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="T3 pairing" className="panel rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Link2 size={15} className="text-accent" aria-hidden />
        <h3 className="font-display text-sm font-semibold">Pair a T3 session</h3>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <Field label="T3 link" htmlFor="home-t3-url" error={error} className="flex-1">
          <TextInput
            id="home-t3-url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submit()
              }
            }}
            placeholder="https://app.t3.codes/…#token=…"
            invalid={Boolean(error)}
            spellCheck={false}
          />
        </Field>
        <Button variant="primary" loading={busy} onClick={() => void submit()} className="sm:mt-6">
          Pair
        </Button>
      </div>
      <p className="mt-2 flex items-start gap-2 text-2xs text-muted">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        Handshake tokens stay in memory and are stripped before anything is saved.
      </p>
    </section>
  )
}

export function Home() {
  const bootstrap = useShell((state) => state.bootstrap)
  const settings = useShell((state) => state.settings)
  const runtime = useShell((state) => state.runtime)
  const pushToast = useShell((state) => state.pushToast)

  const now = new Date()
  const hostName = bootstrap?.hostName ?? 'this machine'
  const resumeEntries = Object.entries(settings.lastUrls)
    .filter(([id]) => isWorkspaceId(id))
    .slice(0, 3)

  const resume = (id: string, url: string): void => {
    if (!isWorkspaceId(id)) return
    void invoke('workspace:activate', { id })
      .then(() => invoke('workspace:navigate', { id, url }))
      .catch((error: unknown) =>
        pushToast({ title: 'Could not resume', body: errorMessage(error), kind: 'error' })
      )
  }

  const openExternal = (url: string): void => {
    void invoke('app:openExternal', { url }).catch((error: unknown) =>
      pushToast({ title: 'Could not open link', body: errorMessage(error), kind: 'error' })
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 py-8">
        {/* Greeting */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-semibold leading-[1.15]">
              {greetingForHour(now.getHours())}, {hostName}
            </h1>
            <p className="mt-1 text-sm text-muted">{formatDate(now)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="online" dot>
              All systems warm
            </Badge>
            <span className="font-mono text-2xs text-muted" title="App memory">
              {formatBytes(runtime?.appMemoryBytes ?? 0)}
            </span>
          </div>
        </header>

        {!settings.seenWelcome ? <WelcomeCard /> : null}

        {/* Resume strip */}
        {resumeEntries.length > 0 ? (
          <section aria-label="Resume" className="flex flex-col gap-2">
            <h2 className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
              Resume where you left off
            </h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {resumeEntries.map(([id, url]) => {
                const clean = displayUrl(url)
                return (
                  <div
                    key={id}
                    className="panel flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{hostFromUrl(clean) || clean}</p>
                      <p className="truncate font-mono text-2xs text-muted" title={clean}>
                        {clean}
                      </p>
                    </div>
                    <Button variant="soft" size="sm" onClick={() => resume(id, clean)}>
                      Resume
                    </Button>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Launchpad */}
        <section aria-label="Launchpad" className="flex flex-col gap-3">
          <h2 className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
            Launchpad
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {WORKSPACES.map((workspace) => (
              <LaunchCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
          <p className="text-2xs text-muted">
            Tip: <KbdCombo combo="Alt+click" /> a card to open it in split view.
          </p>
        </section>

        <T3PairingCard />

        {/* Keyboard strip */}
        <section
          aria-label="Keyboard shortcuts"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3"
        >
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <KbdCombo combo="Ctrl+K" /> palette
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <KbdCombo combo="Ctrl+1–9" /> workspaces
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <KbdCombo combo="Ctrl+\" /> zen
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <KbdCombo combo="Alt+click" /> split
          </span>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-2">
            Built by {DEVELOPER.name}
            <button
              type="button"
              onClick={() => openExternal(DEVELOPER.githubUrl)}
              aria-label={`GitHub profile (${DEVELOPER.github})`}
              title={DEVELOPER.githubUrl}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
            >
              <GitHubMark size={13} />
              {DEVELOPER.github}
            </button>
          </span>
          <span className="font-mono text-2xs">
            v{bootstrap?.appVersion ?? '1.0.0'} · Electron {bootstrap?.electronVersion ?? '—'}
          </span>
        </footer>
      </div>
    </div>
  )
}
