import { useState } from 'react'
import { Link2, ShieldCheck } from 'lucide-react'
import { normalizePairingUrl } from '@shared/validation'
import { errorMessage, invoke } from '../lib/api'
import { useShell } from '../store/shell'
import { Button } from './ui/Button'
import { Field, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

export function T3PairingModal() {
  const closeT3 = useShell((state) => state.closeT3)
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
    setError(null)
    setBusy(true)
    try {
      await invoke('workspace:openT3Pairing', { url: result.value })
      closeT3()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Open T3 pairing link"
      subtitle="Paste a T3 Code link, including a #token= handshake if you have one."
      onClose={closeT3}
      footer={
        <>
          <Button variant="ghost" onClick={closeT3} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Open workspace
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 px-6 py-5">
        <Field label="Pairing URL" htmlFor="t3-pairing-url" error={error}>
          <TextInput
            id="t3-pairing-url"
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
            autoFocus
          />
        </Field>
        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          Handshake tokens stay in memory and are stripped before anything is saved.
        </p>
        <p className="flex items-center gap-2 text-2xs text-muted">
          <Link2 size={12} aria-hidden />
          The link opens in the T3 Code Web workspace.
        </p>
      </div>
    </Modal>
  )
}
