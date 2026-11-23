import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useShell, type Toast } from '../store/shell'

function ToastCard({ toast }: { toast: Toast }) {
  const dismissToast = useShell((state) => state.dismissToast)
  const icon =
    toast.kind === 'success' ? (
      <CheckCircle2 size={16} className="shrink-0 text-online" aria-hidden />
    ) : toast.kind === 'error' ? (
      <AlertCircle size={16} className="shrink-0 text-error" aria-hidden />
    ) : (
      <Info size={16} className="shrink-0 text-accent" aria-hidden />
    )
  return (
    <div className="glass anim-fade-up pointer-events-auto flex items-start gap-2.5 rounded-xl p-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{toast.title}</p>
        {toast.body ? <p className="mt-0.5 break-words text-xs text-muted">{toast.body}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        title="Dismiss"
        onClick={() => dismissToast(toast.id)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  )
}

/** Fixed stack — never shifts layout. Max 4 toasts, auto-dismiss after 5s. */
export function ToastStack() {
  const toasts = useShell((state) => state.toasts)
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
