import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, body, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center ${className}`}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent" aria-hidden>
        {icon}
      </span>
      <p className="font-display text-sm font-semibold">{title}</p>
      {body ? <p className="max-w-sm text-xs text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
