import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useShell } from '../../store/shell'
import { IconButton } from './IconButton'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => node.offsetParent !== null || node === document.activeElement
  )
}

/**
 * Shared dialog behavior: Esc close, Tab focus trap, initial focus, and focus
 * restore on unmount. Used by Modal, the command palette, and the phone drawer.
 */
export function useDialogBehavior(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const initial = visibleFocusables(container)[0]
    if (initial) {
      initial.focus()
    } else {
      container.focus()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // Nested dialogs: only the topmost one should react to Esc.
        const dialogs = document.querySelectorAll('[aria-modal="true"]')
        const topmost = dialogs[dialogs.length - 1]
        if (topmost && topmost !== container) return
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = visibleFocusables(container)
      if (focusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previous?.focus()
    }
  }, [ref])
}

export interface ModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Tailwind width/height classes for the panel. */
  panelClassName?: string
  /** Hide the built-in header (palette-style surfaces). */
  bare?: boolean
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  panelClassName = 'w-[520px] max-w-[92vw]',
  bare = false
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogBehavior(panelRef, onClose)

  // Every modal counts as an overlay so native views stay hidden behind it.
  const beginSurfaceModal = useShell((state) => state.beginSurfaceModal)
  const endSurfaceModal = useShell((state) => state.endSurfaceModal)
  useEffect(() => {
    beginSurfaceModal()
    return () => endSurfaceModal()
  }, [beginSurfaceModal, endSurfaceModal])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/32 backdrop-blur-[2px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`glass anim-scale-in relative flex max-h-[88vh] flex-col overflow-hidden rounded-2xl ${panelClassName}`}
      >
        {bare ? (
          <span id={titleId} className="sr-only">
            {title}
          </span>
        ) : (
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-md font-semibold leading-[1.15]">
                {title}
              </h2>
              {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
            </div>
            <IconButton label="Close dialog" onClick={onClose}>
              <X size={16} aria-hidden />
            </IconButton>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
