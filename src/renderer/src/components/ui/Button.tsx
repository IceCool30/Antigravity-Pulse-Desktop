import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

export type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent border border-transparent hover:brightness-110',
  soft: 'bg-accent-soft text-accent border border-transparent hover:bg-hover',
  ghost: 'bg-transparent text-fg border border-transparent hover:bg-hover',
  outline: 'bg-surface text-fg border border-line hover:bg-hover',
  danger: 'bg-error/10 text-error border border-error/30 hover:bg-error/20'
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3.5 text-sm gap-2'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', loading = false, icon, children, className = '', disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap rounded-[10px] font-medium transition-[background-color,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})
