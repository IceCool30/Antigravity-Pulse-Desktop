import { ExternalLink, Mail } from 'lucide-react'
import { DEVELOPER } from '@shared/workspaces'
import { errorMessage, invoke } from '../../lib/api'
import { firebaseDatabaseId, firebaseProjectId } from '../../lib/firebase'
import { useShell } from '../../store/shell'
import { GitHubMark, OrbitMark } from '../BrandIcons'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SectionHint, SectionTitle } from './SettingRow'

export function AboutSection() {
  const bootstrap = useShell((state) => state.bootstrap)
  const pushToast = useShell((state) => state.pushToast)

  const openExternal = (url: string): void => {
    void invoke('app:openExternal', { url }).catch((error: unknown) =>
      pushToast({ title: 'Could not open link', body: errorMessage(error), kind: 'error' })
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionTitle>About</SectionTitle>
        <SectionHint>Version and project information.</SectionHint>
      </div>

      <div className="panel flex items-center gap-4 rounded-2xl p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <OrbitMark size={30} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-[1.15]">Antigravity Pulse</p>
          <p className="mt-0.5 text-xs text-muted">Desktop cockpit · v{bootstrap?.appVersion ?? '1.0.0'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>MIT License</Badge>
            <Badge variant="accent">Local-first</Badge>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface px-3 py-2">
          <dt className="text-2xs text-muted">Electron</dt>
          <dd className="font-mono text-xs">{bootstrap?.electronVersion ?? '—'}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface px-3 py-2">
          <dt className="text-2xs text-muted">Chrome</dt>
          <dd className="font-mono text-xs">{bootstrap?.chromeVersion ?? '—'}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface px-3 py-2">
          <dt className="text-2xs text-muted">Platform</dt>
          <dd className="font-mono text-xs">
            {bootstrap ? `${bootstrap.platform} · ${bootstrap.arch}` : '—'}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface px-3 py-2">
          <dt className="text-2xs text-muted">Packaged</dt>
          <dd className="font-mono text-xs">{bootstrap?.isPackaged ? 'yes' : 'development'}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Built by <span className="font-medium">{DEVELOPER.name}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Mail size={12} aria-hidden />}
            onClick={() => openExternal(`mailto:${DEVELOPER.email}`)}
          >
            {DEVELOPER.email}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<GitHubMark size={12} />}
            onClick={() => openExternal(DEVELOPER.githubUrl)}
          >
            {DEVELOPER.github}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink size={12} aria-hidden />}
            onClick={() => openExternal(`${DEVELOPER.repoUrl}/issues`)}
          >
            Report an issue
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-xs text-muted">Firestore database: shared with Antigravity Pulse Android</p>
        <p className="mt-1 font-mono text-2xs text-fg">
          {firebaseDatabaseId || 'not configured'}
          {firebaseProjectId ? (
            <span className="text-muted"> · project {firebaseProjectId}</span>
          ) : null}
        </p>
      </div>
    </div>
  )
}
