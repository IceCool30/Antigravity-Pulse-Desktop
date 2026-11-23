import { Menu, Tray, nativeImage } from 'electron'
import type { BridgeStatus, RuntimeSnapshot } from '@shared/ipc'
import { WORKSPACES, type WorkspaceId } from '@shared/workspaces'

interface TrayOptions {
  iconPath: string
  showWindow: () => void
  toggleWindow: () => void
  quit: () => void
  activate: (id: WorkspaceId | null) => void
  openCloud: () => void
  openPhone: () => void
  toggleBridge: () => void
  checkUpdates: () => void
}

export class PulseTray {
  private readonly tray: Tray
  private readonly options: TrayOptions
  private signature = ''

  constructor(options: TrayOptions) {
    this.options = options
    const image = nativeImage.createFromPath(options.iconPath)
    const sized = image.isEmpty() ? image : image.resize({ width: 16, height: 16, quality: 'best' })
    this.tray = new Tray(sized)
    this.tray.setToolTip('Antigravity Pulse')
    this.tray.on('click', () => this.options.toggleWindow())
    this.tray.on('double-click', () => this.options.showWindow())
    this.update(
      {
        activeId: null,
        secondaryId: null,
        states: {},
        appMemoryBytes: 0,
        split: false,
        zen: false,
        pinnedCount: 0,
        startedAt: Date.now()
      },
      {
        enabled: false,
        running: false,
        starting: false,
        port: 3847,
        addresses: [],
        deepLink: null,
        fallbackUrl: null,
        qrDataUrl: null,
        tokenPreview: '',
        fingerprint: '',
        devices: [],
        error: null,
        startedAt: null
      }
    )
  }

  update(runtime: RuntimeSnapshot, bridge: BridgeStatus): void {
    const activeName = runtime.activeId
      ? (WORKSPACES.find((workspace) => workspace.id === runtime.activeId)?.name ?? 'Home')
      : 'Home'
    const bridgeLabel = bridge.running ? 'Phone bridge ready' : 'Phone bridge off'
    this.tray.setToolTip(`Antigravity Pulse — ${activeName}\n${runtime.pinnedCount} pinned • ${bridgeLabel}`)

    const nextSignature = [
      runtime.activeId ?? 'home',
      runtime.pinnedCount,
      Object.keys(runtime.states)
        .filter((id) => runtime.states[id]?.mounted)
        .sort()
        .join(','),
      bridge.running ? 'on' : 'off',
      bridge.devices.length
    ].join('|')
    if (nextSignature === this.signature) return
    this.signature = nextSignature

    const pinnedStates = Object.values(runtime.states).filter((state) => state.mounted)
    const menu = Menu.buildFromTemplate([
      {
        label: 'Show Antigravity Pulse',
        click: () => this.options.showWindow()
      },
      { type: 'separator' },
      {
        label: `Active: ${activeName}`,
        enabled: false
      },
      {
        label: 'Workspaces',
        submenu: [
          ...WORKSPACES.map((workspace) => ({
            label: `${workspace.name}  ·  ${workspace.shortcut}`,
            type: 'radio' as const,
            checked: runtime.activeId === workspace.id,
            click: () => this.options.activate(workspace.id)
          })),
          { type: 'separator' as const },
          {
            label: 'Home',
            type: 'radio' as const,
            checked: runtime.activeId === null,
            click: () => this.options.activate(null)
          }
        ]
      },
      {
        label: `Pinned (${pinnedStates.length})`,
        enabled: false
      },
      ...pinnedStates.map((state) => ({
        label: `${state.title || state.id}${state.crashed ? ' — crashed' : state.loading ? ' — loading' : ''}`,
        click: () => this.options.activate(state.id)
      })),
      { type: 'separator' },
      {
        label: bridge.running ? 'Stop Phone Bridge' : 'Start Phone Bridge',
        click: () => this.options.toggleBridge()
      },
      {
        label: 'Phone Companion…',
        click: () => this.options.openPhone()
      },
      {
        label: 'Cloud Sync…',
        click: () => this.options.openCloud()
      },
      { type: 'separator' },
      {
        label: 'Check for Updates…',
        click: () => this.options.checkUpdates()
      },
      { type: 'separator' },
      {
        label: 'Quit Antigravity Pulse',
        click: () => this.options.quit()
      }
    ])
    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    this.tray.destroy()
  }
}
