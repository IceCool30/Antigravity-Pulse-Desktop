import { useRef, type ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  icon?: ReactNode
}

export interface TabsProps {
  items: readonly TabItem[]
  active: string
  onChange: (id: string) => void
  label: string
}

/** role=tablist with roving tabindex and arrow/Home/End navigation. */
export function Tabs({ items, active, onChange, label }: TabsProps) {
  const refs = useRef(new Map<string, HTMLButtonElement | null>())

  const focusTab = (id: string): void => {
    onChange(id)
    refs.current.get(id)?.focus()
  }

  const move = (direction: 1 | -1, from: string): void => {
    const index = items.findIndex((item) => item.id === from)
    if (index === -1) return
    const next = items[(index + direction + items.length) % items.length]
    if (next) focusTab(next.id)
  }

  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-1 border-b border-line">
      {items.map((item) => {
        const selected = item.id === active
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current.set(item.id, node)
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                move(1, item.id)
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                move(-1, item.id)
              } else if (event.key === 'Home') {
                event.preventDefault()
                const first = items[0]
                if (first) focusTab(first.id)
              } else if (event.key === 'End') {
                event.preventDefault()
                const last = items[items.length - 1]
                if (last) focusTab(last.id)
              }
            }}
            className={`relative inline-flex h-9 items-center gap-2 px-3 text-sm font-medium transition-colors duration-150 ${
              selected ? 'text-accent' : 'text-muted hover:text-fg'
            }`}
          >
            {item.icon}
            {item.label}
            {selected ? (
              <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (id !== active) return null
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0}>
      {children}
    </div>
  )
}
