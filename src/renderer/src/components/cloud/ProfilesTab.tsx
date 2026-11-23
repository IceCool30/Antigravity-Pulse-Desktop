import { useMemo, useState } from 'react'
import { Copy, KeyRound, Pencil, Plus, Search, Server, ShieldCheck, Star, Trash2 } from 'lucide-react'
import {
  CONNECTION_MODES,
  validateServerProfileInput,
  type ConnectionMode,
  type NormalizedServerProfile
} from '@shared/validation'
import { errorMessage, invoke } from '../../lib/api'
import {
  createProfile,
  deleteProfile,
  updateProfile,
  type ServerProfileDoc
} from '../../lib/cloud'
import { getFirebase } from '../../lib/firebase'
import { formatRelativeTime } from '../../lib/format'
import { useShell } from '../../store/shell'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Field, TextInput } from '../ui/Field'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Spinner'
import { Toggle } from '../ui/Toggle'

const MODE_LABELS: Record<ConnectionMode, string> = {
  HYBRID_BRIDGE: 'Hybrid bridge',
  DIRECT_TUNNEL: 'Direct tunnel',
  PAIRING_TOKEN: 'Pairing token'
}

interface EditorState {
  mode: 'create' | 'edit'
  doc: ServerProfileDoc | null
}

function ProfileEditor({
  uid,
  editor,
  onClose
}: {
  uid: string
  editor: EditorState
  onClose: () => void
}) {
  const pushToast = useShell((state) => state.pushToast)
  const doc = editor.doc
  const [name, setName] = useState(doc?.name ?? '')
  const [endpointUrl, setEndpointUrl] = useState(doc?.endpointUrl ?? '')
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(doc?.connectionMode ?? 'HYBRID_BRIDGE')
  const [keepAlivePinned, setKeepAlivePinned] = useState(doc?.keepAlivePinned ?? false)
  const [latency, setLatency] = useState(String(doc?.lastLatencyMs ?? 0))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    const fb = getFirebase()
    if (!fb) return
    const result = validateServerProfileInput({
      name,
      endpointUrl,
      connectionMode,
      keepAlivePinned,
      lastLatencyMs: Number(latency)
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editor.mode === 'create') {
        await createProfile(fb.db, uid, result.value)
        pushToast({ title: 'Profile created', kind: 'success' })
      } else if (doc) {
        await updateProfile(fb.db, uid, doc.id, result.value)
        pushToast({ title: 'Profile updated', kind: 'success' })
      }
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editor.mode === 'create' ? 'New server profile' : 'Edit server profile'}
      subtitle="Synced to users/{uid}/serverProfiles · authToken is always empty."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {editor.mode === 'create' ? 'Create profile' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        {error ? (
          <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {error}
          </p>
        ) : null}
        <Field label="Name" htmlFor="profile-name">
          <TextInput
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Home lab relay"
            autoFocus
          />
        </Field>
        <Field
          label="Endpoint URL"
          htmlFor="profile-endpoint"
          hint="http(s) only — no credentials, query, or fragment."
        >
          <TextInput
            id="profile-endpoint"
            value={endpointUrl}
            onChange={(event) => setEndpointUrl(event.target.value)}
            placeholder="https://relay.example.com"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </Field>
        <Field label="Connection mode" htmlFor="profile-mode">
          <Select
            id="profile-mode"
            value={connectionMode}
            onChange={(event) => setConnectionMode(event.target.value as ConnectionMode)}
          >
            {CONNECTION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Last latency (ms)" htmlFor="profile-latency">
          <TextInput
            id="profile-latency"
            value={latency}
            onChange={(event) => setLatency(event.target.value)}
            inputMode="numeric"
            className="w-32 font-mono"
          />
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <Toggle label="Keep-alive pinned" checked={keepAlivePinned} onChange={setKeepAlivePinned} />
          Keep-alive pinned
        </label>
      </div>
    </Modal>
  )
}

function VaultDialog({ profile, onClose }: { profile: ServerProfileDoc; onClose: () => void }) {
  const pushToast = useShell((state) => state.pushToast)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    const trimmed = token.trim()
    if (!trimmed || trimmed.length > 512) {
      setError('Token must be 1–512 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await invoke('vault:setProfileToken', { profileId: profile.id, token: trimmed })
      setToken('')
      pushToast({ title: 'Token stored locally', body: 'Never written to Firestore.', kind: 'success' })
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const clear = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await invoke('vault:deleteProfileToken', { profileId: profile.id })
      pushToast({ title: 'Stored token cleared', kind: 'info' })
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Device token — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={() => void clear()} disabled={busy}>
            Clear stored token
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Store token
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <p className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-xs text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          Stored in Windows DPAPI via Electron safeStorage. Never written to Firestore.
        </p>
        {error ? (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        ) : null}
        <Field label="Device token" htmlFor="vault-token" hint="The token is never shown again after saving.">
          <TextInput
            id="vault-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the device token"
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  )
}

export interface ProfilesTabProps {
  uid: string
  profiles: ServerProfileDoc[]
  loading: boolean
  error: string | null
}

export function ProfilesTab({ uid, profiles, loading, error }: ProfilesTabProps) {
  const pushToast = useShell((state) => state.pushToast)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServerProfileDoc | null>(null)
  const [vaultTarget, setVaultTarget] = useState<ServerProfileDoc | null>(null)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return profiles
    return profiles.filter(
      (profile) =>
        profile.name.toLowerCase().includes(needle) ||
        profile.endpointUrl.toLowerCase().includes(needle)
    )
  }, [profiles, search])

  const copyEndpoint = async (url: string): Promise<void> => {
    try {
      await invoke('app:copy', { text: url })
      pushToast({ title: 'Endpoint copied', kind: 'success' })
    } catch (caught) {
      pushToast({ title: 'Copy failed', body: errorMessage(caught), kind: 'error' })
    }
  }

  const confirmDelete = async (): Promise<void> => {
    const fb = getFirebase()
    if (!fb || !deleteTarget) return
    try {
      await deleteProfile(fb.db, uid, deleteTarget.id)
      pushToast({ title: 'Profile deleted', kind: 'info' })
    } catch (caught) {
      pushToast({ title: 'Delete failed', body: errorMessage(caught), kind: 'error' })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex items-center gap-2">
        <span className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search profiles"
            aria-label="Search server profiles"
            className="pl-8"
          />
        </span>
        <Button variant="primary" icon={<Plus size={14} aria-hidden />} onClick={() => setEditor({ mode: 'create', doc: null })}>
          New profile
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Loading profiles">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Server size={20} />}
          title={profiles.length === 0 ? 'No server profiles yet' : 'No profiles match your search'}
          body={
            profiles.length === 0
              ? 'Profiles sync with Antigravity Pulse for Android in realtime.'
              : 'Try a different name or endpoint.'
          }
          action={
            profiles.length === 0 ? (
              <Button variant="soft" size="sm" icon={<Plus size={13} aria-hidden />} onClick={() => setEditor({ mode: 'create', doc: null })}>
                Create your first profile
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((profile) => (
            <li key={profile.id} className="panel flex items-center gap-3 rounded-xl px-4 py-3">
              <Star
                size={15}
                aria-label={profile.keepAlivePinned ? 'Pinned' : 'Not pinned'}
                className={profile.keepAlivePinned ? 'shrink-0 fill-accent text-accent' : 'shrink-0 text-muted/40'}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{profile.name}</p>
                  <Badge variant="accent">{MODE_LABELS[profile.connectionMode]}</Badge>
                </div>
                <p className="truncate font-mono text-2xs text-muted" title={profile.endpointUrl}>
                  {profile.endpointUrl}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="font-mono text-2xs text-fg">{profile.lastLatencyMs} ms</p>
                <p className="text-2xs text-muted">{formatRelativeTime(profile.updatedAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton label={`Copy endpoint for ${profile.name}`} size="sm" onClick={() => void copyEndpoint(profile.endpointUrl)}>
                  <Copy size={13} aria-hidden />
                </IconButton>
                <IconButton label={`Device token for ${profile.name}`} size="sm" onClick={() => setVaultTarget(profile)}>
                  <KeyRound size={13} aria-hidden />
                </IconButton>
                <IconButton label={`Edit ${profile.name}`} size="sm" onClick={() => setEditor({ mode: 'edit', doc: profile })}>
                  <Pencil size={13} aria-hidden />
                </IconButton>
                <IconButton label={`Delete ${profile.name}`} size="sm" onClick={() => setDeleteTarget(profile)}>
                  <Trash2 size={13} aria-hidden />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor ? <ProfileEditor uid={uid} editor={editor} onClose={() => setEditor(null)} /> : null}
      {vaultTarget ? <VaultDialog profile={vaultTarget} onClose={() => setVaultTarget(null)} /> : null}
      {deleteTarget ? (
        <ConfirmDialog
          title="Delete server profile?"
          body={`“${deleteTarget.name}” will be removed from Firestore on every synced device. The local vault token is not deleted automatically.`}
          confirmLabel="Delete profile"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  )
}
