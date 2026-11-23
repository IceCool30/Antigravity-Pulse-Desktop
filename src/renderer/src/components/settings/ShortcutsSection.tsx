import { KbdCombo } from '../ui/Kbd'
import { SectionHint, SectionTitle } from './SettingRow'

const SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: 'Ctrl+1..9', action: 'Activate workspace 1..9' },
  { keys: 'Ctrl+\\', action: 'Toggle Zen (also F11)' },
  { keys: 'Ctrl+K', action: 'Command palette' },
  { keys: 'Ctrl+,', action: 'Settings' },
  { keys: 'Ctrl+Shift+P', action: 'Phone Companion' },
  { keys: 'Ctrl+Shift+O', action: 'Open Antigravity Remote' },
  { keys: 'Ctrl+Shift+T', action: 'Open T3 pairing link' },
  { keys: 'Ctrl+Shift+A', action: 'New AI Studio prompt' },
  { keys: 'Ctrl+Shift+G', action: 'New Gemini chat' },
  { keys: 'Ctrl+Shift+H', action: 'GitHub notifications' },
  { keys: 'Ctrl+Shift+V', action: 'New Vercel project' },
  { keys: 'Ctrl+Shift+S', action: 'Supabase projects' },
  { keys: 'Ctrl+T', action: 'New Pulse Browser tab' },
  { keys: 'Ctrl+W', action: 'Close active browser tab (browser only)' },
  { keys: 'Ctrl+F', action: 'Find in browser page' },
  { keys: 'Ctrl+L', action: 'Focus address bar' },
  { keys: 'Ctrl+R', action: 'Reload active workspace (also F5)' },
  { keys: 'Alt+Left', action: 'Back' },
  { keys: 'Alt+Right', action: 'Forward' },
  { keys: 'Ctrl++', action: 'Zoom in' },
  { keys: 'Ctrl+-', action: 'Zoom out' },
  { keys: 'Ctrl+0', action: 'Reset zoom' },
  { keys: 'Ctrl+Shift+I', action: 'DevTools for active workspace' },
  { keys: 'Ctrl+Shift+W', action: 'Close split (if any)' },
  { keys: 'Alt+click', action: 'Open workspace in split' }
]

export function ShortcutsSection() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionTitle>Keyboard shortcuts</SectionTitle>
        <SectionHint>Accelerators are owned by the application menu and work app-wide.</SectionHint>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4 font-medium">Keys</th>
            <th className="py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map((shortcut) => (
            <tr key={shortcut.keys} className="border-b border-line/50 last:border-0">
              <td className="py-2 pr-4">
                <KbdCombo combo={shortcut.keys} />
              </td>
              <td className="py-2 text-xs text-muted">{shortcut.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
