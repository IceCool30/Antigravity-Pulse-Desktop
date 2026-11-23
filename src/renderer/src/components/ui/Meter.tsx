export interface MeterProps {
  /** 0..1 */
  value: number
  className?: string
  label?: string
}

export function Meter({ value, className = '', label }: MeterProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`inline-block h-1 overflow-hidden rounded-full bg-elevated ${className}`}
    >
      <span
        className="block h-full rounded-full bg-accent transition-[width] duration-200"
        style={{ width: `${clamped * 100}%` }}
      />
    </span>
  )
}
