import { useState } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

/** Inline confirmation modal — never window.confirm for cloud data. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      title={title}
      onClose={onCancel}
      panelClassName="w-[440px] max-w-[92vw]"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            onClick={() => {
              const result = onConfirm()
              if (result instanceof Promise) {
                setBusy(true)
                void result.finally(() => setBusy(false))
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="px-6 py-5 text-sm text-muted">{body}</p>
    </Modal>
  )
}
