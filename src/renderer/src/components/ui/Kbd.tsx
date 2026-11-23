import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 shrink-0 items-center rounded-md border border-line bg-surface px-1.5 font-mono text-2xs text-muted">
      {children}
    </kbd>
  )
}

/** Renders "Ctrl+Shift+K" as individual key caps. */
export function KbdCombo({ combo }: { combo: string }) {
  const parts = combo.split('+')
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-2xs text-muted/60">+</span> : null}
          <Kbd>{part}</Kbd>
        </span>
      ))}
    </span>
  )
}
