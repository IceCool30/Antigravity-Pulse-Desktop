import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Search,
  X
} from 'lucide-react'
import { errorMessage, invoke } from '../lib/api'
import { useShell } from '../store/shell'

const FIND_DEBOUNCE_MS = 150

/**
 * Floating find bar that lives inside the 72px chrome area (row 2, right side)
 * so it never covers the native page.
 */
export function FindBar() {
  const find = useShell((state) => state.find)
  const findUiOpen = useShell((state) => state.findUiOpen)
  const findFocusNonce = useShell((state) => state.findFocusNonce)
  const setFindUiOpen = useShell((state) => state.setFindUiOpen)
  const pushToast = useShell((state) => state.pushToast)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (findFocusNonce > 0) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [findFocusNonce])

  useEffect(() => {
    if (!findUiOpen) return
    const timer = setTimeout(() => {
      if (!text.trim()) {
        void invoke('browser:findStop', undefined).catch(() => undefined)
        return
      }
      void invoke('browser:find', { text, forward: true }).catch((error: unknown) =>
        pushToast({ title: 'Find failed', body: errorMessage(error), kind: 'error' })
      )
    }, FIND_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, findUiOpen, pushToast])

  // Leaving the browser workspace must always stop the native find session.
  useEffect(() => {
    return () => {
      void invoke('browser:findStop', undefined).catch(() => undefined)
    }
  }, [])

  if (!findUiOpen) return null

  const step = (forward: boolean): void => {
    if (!text.trim()) return
    void invoke('browser:find', { text, forward }).catch((error: unknown) =>
      pushToast({ title: 'Find failed', body: errorMessage(error), kind: 'error' })
    )
  }

  const close = (): void => {
    setText('')
    setFindUiOpen(false)
  }

  return (
    <div
      role="search"
      aria-label="Find in page"
      className="glass anim-scale-in absolute right-2 top-[42px] z-30 flex h-[28px] w-[280px] items-center gap-1 rounded-[10px] px-2"
    >
      <Search size={12} className="shrink-0 text-muted" aria-hidden />
      <input
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            step(!event.shiftKey)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
        placeholder="Find in page"
        aria-label="Find in page"
        className="h-full min-w-0 flex-1 bg-transparent text-xs text-fg placeholder:text-muted/50 focus:outline-none"
      />
      <span className="shrink-0 font-mono text-2xs text-muted" aria-live="polite">
        {text.trim() ? `${find.activeMatch}/${find.matches}` : ''}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        onClick={() => step(false)}
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-fg"
      >
        <ChevronUp size={12} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Next match"
        title="Next match (Enter)"
        onClick={() => step(true)}
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-fg"
      >
        <ChevronDown size={12} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Close find bar"
        title="Close (Esc)"
        onClick={close}
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-fg"
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  )
}
