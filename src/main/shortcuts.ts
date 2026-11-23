import { Menu, type MenuItemConstructorOptions, type WebContents } from 'electron'
import type { ShellAction } from '@shared/ipc'
import { WORKSPACE_ACTIONS, WORKSPACES, type WorkspaceId } from '@shared/workspaces'

/** Every shortcut is a callback: the menu never reaches into the host itself. */
export interface ShortcutOptions {
  activate: (id: WorkspaceId | null) => void
  workspaceAction: (id: WorkspaceId) => void
  shellAction: (action: ShellAction) => void
  newTab: () => void
  closeTab: () => void
  reload: () => void
  back: () => void
  forward: () => void
  zoom: (direction: 'in' | 'out' | 'reset') => void
  devtools: () => void
  clearSplit: () => void
  isBrowserActive: () => boolean
  quit: () => void
}

const FAST_ACTION_IDS: readonly WorkspaceId[] = [
  'antigravity',
  't3',
  'aistudio',
  'gemini',
  'github',
  'vercel',
  'supabase'
]

function action(
  label: string,
  accelerator: string,
  click: () => void
): MenuItemConstructorOptions {
  return { label, accelerator, click: () => click() }
}

/**
 * Builds the application menu whose accelerators are authoritative for the
 * whole app. The menu bar itself stays hidden on frameless windows; Electron
 * still dispatches accelerators when the bar is invisible.
 */
export function installApplicationMenu(options: ShortcutOptions): void {
  const template: MenuItemConstructorOptions[] = []
  const isMac = process.platform === 'darwin'

  if (isMac) {
    template.push({
      label: 'Antigravity Pulse',
      submenu: [
        { label: 'About Antigravity Pulse', role: 'about' },
        { type: 'separator' },
        { label: 'Hide Antigravity Pulse', role: 'hide' },
        { label: 'Hide Others', role: 'hideOthers' },
        { label: 'Unhide', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit Antigravity Pulse', click: () => options.quit() }
      ]
    })
    template.push({
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Select All', role: 'selectAll' }
      ]
    })
  }

  template.push({
    label: 'Workspace',
    submenu: [
      ...WORKSPACES.map((workspace, index) =>
        action(workspace.name, `Ctrl+${index + 1}`, () => options.activate(workspace.id))
      ),
      { type: 'separator' },
      action('Command palette', 'Ctrl+K', () => options.shellAction('palette')),
      action('Toggle zen', 'Ctrl+\\', () => options.shellAction('zen')),
      action('Toggle zen (F11)', 'F11', () => options.shellAction('zen')),
      action('Close split', 'Ctrl+Shift+W', () => options.clearSplit())
    ]
  })

  template.push({
    label: 'Actions',
    submenu: [
      ...FAST_ACTION_IDS.map((id) => {
        const shortcut = WORKSPACE_ACTIONS[id]
        return action(shortcut.label, shortcut.shortcut, () => options.workspaceAction(id))
      }),
      { type: 'separator' },
      action('New Pulse Browser tab', 'Ctrl+T', () => options.newTab()),
      action('Close browser tab', 'Ctrl+W', () => options.closeTab()),
      action('Find in page', 'Ctrl+F', () => options.shellAction('find')),
      action('Focus address bar', 'Ctrl+L', () => options.shellAction('address'))
    ]
  })

  template.push({
    label: 'View',
    submenu: [
      action('Settings', 'Ctrl+,', () => options.shellAction('settings')),
      action('Phone Companion', 'Ctrl+Shift+P', () => options.shellAction('phone')),
      { type: 'separator' },
      action('Reload workspace', 'Ctrl+R', () => options.reload()),
      action('Reload workspace (F5)', 'F5', () => options.reload()),
      action('Back', 'Alt+Left', () => options.back()),
      action('Forward', 'Alt+Right', () => options.forward()),
      { type: 'separator' },
      action('Zoom in', 'Ctrl++', () => options.zoom('in')),
      action('Zoom in (=)', 'Ctrl+Equal', () => options.zoom('in')),
      action('Zoom in (numpad)', 'Ctrl+Add', () => options.zoom('in')),
      action('Zoom out', 'Ctrl+-', () => options.zoom('out')),
      action('Zoom out (-)', 'Ctrl+Minus', () => options.zoom('out')),
      action('Zoom reset', 'Ctrl+0', () => options.zoom('reset')),
      { type: 'separator' },
      action('Developer tools', 'Ctrl+Shift+I', () => options.devtools())
    ]
  })

  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'Keyboard shortcuts',
        click: () => options.shellAction('shortcuts')
      }
    ]
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Minimal per-webContents guard. Menu accelerators remain authoritative; this
 * only stops a web page from using Ctrl/Cmd+W to close the host window while a
 * workspace other than Pulse Browser is active.
 */
export function bindShortcuts(contents: WebContents, options: ShortcutOptions): void {
  contents.on('before-input-event', (event, input) => {
    if (!input.control && !input.meta) return
    if (input.shift || input.alt) return
    if (input.key.toLowerCase() !== 'w') return
    if (!options.isBrowserActive()) event.preventDefault()
  })
}
