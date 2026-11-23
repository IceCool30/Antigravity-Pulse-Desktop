import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className = '', children, ...rest },
  ref
) {
  return (
    <span className={`relative inline-flex w-full items-center ${className}`}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`h-8 w-full appearance-none rounded-[10px] border bg-surface pl-3 pr-8 text-sm text-fg transition-colors duration-150 focus:border-accent/60 disabled:opacity-50 ${
          invalid ? 'border-error/60' : 'border-line'
        }`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 text-muted"
      />
    </span>
  )
})
