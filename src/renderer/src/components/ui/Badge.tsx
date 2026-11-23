import type { ReactNode } from 'react'

export type BadgeVariant = 'neutral' | 'accent' | 'online' | 'error' | 'warning'

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-elevated text-muted',
  accent: 'border-accent/30 bg-accent-soft text-accent',
  online: 'border-online/30 bg-online/10 text-online',
  error: 'border-error/30 bg-error/10 text-error',
  warning: 'border-warning/30 bg-warning/10 text-warning'
}

export interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
  dot?: boolean
  title?: string
}

export function Badge({ variant = 'neutral', children, className = '', dot = false, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-2xs font-medium ${VARIANTS[variant]} ${className}`}
    >
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}
