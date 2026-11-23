import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name; also used as the native tooltip. */
  label: string
  children: ReactNode
  size?: 'sm' | 'md'
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, size = 'md', active = false, className = '', type = 'button', ...rest },
  ref
) {
  const dimension = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] border border-transparent transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-fg'
      } ${dimension} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})
