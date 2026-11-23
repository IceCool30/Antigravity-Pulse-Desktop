import type { ReactNode } from 'react'

export function SettingRow({
  title,
  description,
  control
}: {
  title: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line/60 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display text-md font-semibold leading-[1.15]">{children}</h3>
  )
}

export function SectionHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>
}
