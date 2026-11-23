import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SPLIT_GAP, clampSplitRatio, type Rect } from '@shared/layout'
import { rectStyle } from '../lib/rect'
import { useShell } from '../store/shell'

export interface SplitDividerProps {
  rect: Rect
  /** Window x of the content area's left edge (primary.x). */
  contentLeft: number
  /** Combined width of both panes plus the gap. */
  contentWidth: number
}

/**
 * 8px invisible hit area with a 2px visible line. Drag is rAF-throttled into
 * layout:update; release persists splitRatio through settings:update.
 */
export function SplitDivider({ rect, contentLeft, contentWidth }: SplitDividerProps) {
  const splitRatio = useShell((state) => state.splitRatio)
  const setSplitRatio = useShell((state) => state.setSplitRatio)
  const commitSplitRatio = useShell((state) => state.commitSplitRatio)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const pendingRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      document.body.style.cursor = ''
    }
  }, [])

  const ratioFromPointer = (clientX: number): number => {
    const usable = contentWidth - SPLIT_GAP
    if (usable <= 0) return 0.5
    const raw = (clientX - contentLeft - SPLIT_GAP / 2) / usable
    return clampSplitRatio(raw, contentWidth)
  }

  const schedule = (ratio: number): void => {
    pendingRef.current = ratio
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const next = pendingRef.current
      pendingRef.current = null
      if (next !== null) setSplitRatio(next)
    })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    schedule(ratioFromPointer(event.clientX))
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    schedule(ratioFromPointer(event.clientX))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    document.body.style.cursor = ''
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    pendingRef.current = null
    setSplitRatio(ratioFromPointer(event.clientX))
    commitSplitRatio()
  }

  const nudge = (delta: number): void => {
    setSplitRatio(clampSplitRatio(splitRatio + delta, contentWidth))
    commitSplitRatio()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split panes"
      aria-valuenow={Math.round(splitRatio * 100)}
      aria-valuemin={20}
      aria-valuemax={80}
      tabIndex={0}
      className="group absolute z-10 flex cursor-col-resize touch-none justify-center outline-offset-0"
      style={rectStyle(rect)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        setSplitRatio(0.5)
        commitSplitRatio()
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          nudge(-0.02)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          nudge(0.02)
        }
      }}
    >
      <span
        aria-hidden
        className={`h-full w-[2px] rounded-full transition-colors duration-150 ${
          dragging ? 'bg-accent' : 'bg-line-strong group-hover:bg-accent group-focus-visible:bg-accent'
        }`}
      />
    </div>
  )
}
