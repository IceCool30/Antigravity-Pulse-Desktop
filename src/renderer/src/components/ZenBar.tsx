import { Minimize2 } from 'lucide-react'
import { ZEN_BAR_HEIGHT } from '@shared/layout'
import { useShell } from '../store/shell'
import { IconButton } from './ui/IconButton'

/**
 * Zen mode hides the normal chrome, so the only discoverable way out should not
 * be a forgotten keyboard shortcut. This 28px strip stays above every workspace.
 */
export function ZenBar() {
  const zen = useShell((state) => state.zen)
  const toggleZen = useShell((state) => state.toggleZen)

  if (!zen) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-end border-b border-line bg-surface/85 px-2 backdrop-blur-md"
      style={{ height: ZEN_BAR_HEIGHT }}
    >
      <IconButton size="sm" label="Exit Zen mode (Ctrl+\)" onClick={toggleZen}>
        <Minimize2 size={13} aria-hidden />
      </IconButton>
    </div>
  )
}
