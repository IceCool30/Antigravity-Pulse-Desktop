import { useMemo, useState } from 'react'
import { Copy, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { validatePromptInput } from '@shared/validation'
import { errorMessage, invoke } from '../../lib/api'
import { createPrompt, deletePrompt, updatePrompt, type CopilotPromptDoc } from '../../lib/cloud'
import { getFirebase } from '../../lib/firebase'
import { formatRelativeTime } from '../../lib/format'
import { useShell } from '../../store/shell'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Field, TextArea, TextInput } from '../ui/Field'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { Skeleton } from '../ui/Spinner'

interface EditorState {
  mode: 'create' | 'edit'
  doc: CopilotPromptDoc | null
}

function PromptEditor({
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
  const [title, setTitle] = useState(doc?.title ?? '')
  const [promptText, setPromptText] = useState(doc?.promptText ?? '')
  const [rolePersona, setRolePersona] = useState(doc?.rolePersona ?? '')
  const [preferredModel, setPreferredModel] = useState(doc?.preferredModel ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    const fb = getFirebase()
    if (!fb) return
    const result = validatePromptInput({ title, promptText, rolePersona, preferredModel })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editor.mode === 'create') {
        await createPrompt(fb.db, uid, result.value)
        pushToast({ title: 'Prompt created', kind: 'success' })
      } else if (doc) {
        await updatePrompt(fb.db, uid, doc.id, result.value)
        pushToast({ title: 'Prompt updated', kind: 'success' })
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
      title={editor.mode === 'create' ? 'New copilot prompt' : 'Edit copilot prompt'}
      subtitle="Synced to users/{uid}/copilotPrompts."
      onClose={onClose}
      panelClassName="w-[640px] max-w-[92vw]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {editor.mode === 'create' ? 'Create prompt' : 'Save changes'}
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
        <Field label={`Title (${title.length}/120)`} htmlFor="prompt-title">
          <TextInput
            id="prompt-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Release notes writer"
            autoFocus
          />
        </Field>
        <Field label={`Prompt body (${promptText.length}/5000)`} htmlFor="prompt-body">
          <TextArea
            id="prompt-body"
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            maxLength={5000}
            rows={8}
            placeholder="You are…"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Role persona (${rolePersona.length}/80)`} htmlFor="prompt-persona">
            <TextInput
              id="prompt-persona"
              value={rolePersona}
              onChange={(event) => setRolePersona(event.target.value)}
              maxLength={80}
              placeholder="Senior release engineer"
            />
          </Field>
          <Field label={`Preferred model (${preferredModel.length}/80)`} htmlFor="prompt-model">
            <TextInput
              id="prompt-model"
              value={preferredModel}
              onChange={(event) => setPreferredModel(event.target.value)}
              maxLength={80}
              placeholder="gemini-2.5-pro"
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export interface PromptsTabProps {
  uid: string
  prompts: CopilotPromptDoc[]
  loading: boolean
  error: string | null
}

export function PromptsTab({ uid, prompts, loading, error }: PromptsTabProps) {
  const pushToast = useShell((state) => state.pushToast)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CopilotPromptDoc | null>(null)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return prompts
    return prompts.filter(
      (prompt) =>
        prompt.title.toLowerCase().includes(needle) ||
        prompt.rolePersona.toLowerCase().includes(needle) ||
        prompt.preferredModel.toLowerCase().includes(needle)
    )
  }, [prompts, search])

  const copyBody = async (text: string): Promise<void> => {
    try {
      await invoke('app:copy', { text })
      pushToast({ title: 'Prompt copied', kind: 'success' })
    } catch (caught) {
      pushToast({ title: 'Copy failed', body: errorMessage(caught), kind: 'error' })
    }
  }

  const confirmDelete = async (): Promise<void> => {
    const fb = getFirebase()
    if (!fb || !deleteTarget) return
    try {
      await deletePrompt(fb.db, uid, deleteTarget.id)
      pushToast({ title: 'Prompt deleted', kind: 'info' })
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
            placeholder="Search prompts"
            aria-label="Search copilot prompts"
            className="pl-8"
          />
        </span>
        <Button variant="primary" icon={<Plus size={14} aria-hidden />} onClick={() => setEditor({ mode: 'create', doc: null })}>
          New prompt
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Loading prompts">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={20} />}
          title={prompts.length === 0 ? 'No copilot prompts yet' : 'No prompts match your search'}
          body={
            prompts.length === 0
              ? 'Prompts sync with Antigravity Pulse for Android in realtime.'
              : 'Try a different title, persona, or model.'
          }
          action={
            prompts.length === 0 ? (
              <Button variant="soft" size="sm" icon={<Plus size={13} aria-hidden />} onClick={() => setEditor({ mode: 'create', doc: null })}>
                Create your first prompt
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((prompt) => (
            <li key={prompt.id} className="panel flex flex-col rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 truncate text-sm font-medium" title={prompt.title}>
                  {prompt.title}
                </h3>
                <span className="flex shrink-0 items-center gap-0.5">
                  <IconButton label={`Copy body of ${prompt.title}`} size="sm" onClick={() => void copyBody(prompt.promptText)}>
                    <Copy size={13} aria-hidden />
                  </IconButton>
                  <IconButton label={`Edit ${prompt.title}`} size="sm" onClick={() => setEditor({ mode: 'edit', doc: prompt })}>
                    <Pencil size={13} aria-hidden />
                  </IconButton>
                  <IconButton label={`Delete ${prompt.title}`} size="sm" onClick={() => setDeleteTarget(prompt)}>
                    <Trash2 size={13} aria-hidden />
                  </IconButton>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="accent">{prompt.rolePersona}</Badge>
                <Badge>{prompt.preferredModel}</Badge>
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs text-muted">
                {prompt.promptText}
              </p>
              <p className="mt-auto pt-3 text-2xs text-muted">
                Updated {formatRelativeTime(prompt.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {editor ? <PromptEditor uid={uid} editor={editor} onClose={() => setEditor(null)} /> : null}
      {deleteTarget ? (
        <ConfirmDialog
          title="Delete copilot prompt?"
          body={`“${deleteTarget.title}” will be removed from Firestore on every synced device.`}
          confirmLabel="Delete prompt"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  )
}
