import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

export interface FieldProps {
  label: string
  htmlFor?: string
  error?: string | null
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, error, hint, children, className = '' }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted/80">{hint}</p>
      ) : null}
    </div>
  )
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

const INPUT_BASE =
  'h-8 w-full rounded-[10px] border bg-surface px-3 text-sm text-fg placeholder:text-muted/50 transition-colors duration-150 focus:border-accent/60 disabled:opacity-50'

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid = false, className = '', ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${INPUT_BASE} ${invalid ? 'border-error/60' : 'border-line'} ${className}`}
      {...rest}
    />
  )
})

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { invalid = false, className = '', ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full rounded-[10px] border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/50 transition-colors duration-150 focus:border-accent/60 disabled:opacity-50 ${
        invalid ? 'border-error/60' : 'border-line'
      } ${className}`}
      {...rest}
    />
  )
})
