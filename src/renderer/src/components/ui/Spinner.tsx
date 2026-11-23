export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label ?? 'Loading'}
      className="orbit-spinner inline-block shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`shimmer rounded-lg bg-elevated ${className}`} />
}
