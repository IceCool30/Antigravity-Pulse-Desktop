import type { CSSProperties } from 'react'
import type { Rect } from '@shared/layout'

/** Positions a renderer layer at absolute window coordinates from shared layout math. */
export function rectStyle(rect: Rect): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
}
