export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name for the switch. */
  label: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${
        checked ? 'border-transparent bg-accent' : 'border-line bg-elevated'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform duration-150 ${
          checked ? 'translate-x-[18px] bg-on-accent' : 'translate-x-[3px] bg-muted'
        }`}
      />
    </button>
  )
}
