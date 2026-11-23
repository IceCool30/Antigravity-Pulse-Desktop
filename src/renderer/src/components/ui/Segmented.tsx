import { useRef, type ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

/** Segmented control implemented as a keyboard-complete radio group. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = ''
}: SegmentedProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement | null>())

  const move = (direction: 1 | -1, from: T): void => {
    const index = options.findIndex((option) => option.value === from)
    if (index === -1) return
    const next = options[(index + direction + options.length) % options.length]
    if (!next) return
    onChange(next.value)
    refs.current.get(next.value)?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-surface p-0.5 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current.set(option.value, node)
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(1, option.value)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(-1, option.value)
              }
            }}
            className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors duration-150 ${
              selected ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-fg'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
