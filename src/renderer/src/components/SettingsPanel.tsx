import {
  AppWindow,
  Compass,
  Info,
  Keyboard,
  MonitorSmartphone,
  Palette,
  Settings2
} from 'lucide-react'
import { resolveTheme } from '@shared/theme'
import { useShell, type SettingsSection } from '../store/shell'
import { Modal } from './ui/Modal'
import { AboutSection } from './settings/AboutSection'
import { AppearanceSection } from './settings/AppearanceSection'
import { BrowserSection } from './settings/BrowserSection'
import { PhoneCloudSection } from './settings/PhoneCloudSection'
import { ShortcutsSection } from './settings/ShortcutsSection'
import { SystemSection } from './settings/SystemSection'
import { WorkspacesSection } from './settings/WorkspacesSection'

const NAV: readonly { id: SettingsSection; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'workspaces', label: 'Workspaces', icon: AppWindow },
  { id: 'browser', label: 'Browser', icon: Compass },
  { id: 'phone', label: 'Phone & Cloud', icon: MonitorSmartphone },
  { id: 'system', label: 'System', icon: Settings2 },
  { id: 'about', label: 'About', icon: Info },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard }
]

export function SettingsPanel() {
  const settings = useShell((state) => state.settings)
  const systemPrefersDark = useShell((state) => state.systemPrefersDark)
  const section = useShell((state) => state.settingsSection)
  const openSettings = useShell((state) => state.openSettings)
  const closeSettings = useShell((state) => state.closeSettings)

  const resolved = resolveTheme({
    presetName: settings.presetName,
    themeMode: settings.themeMode,
    contrastMode: settings.contrastMode,
    systemPrefersDark,
    accentOverride: settings.accentOverride
  })

  return (
    <Modal
      title="Settings"
      onClose={closeSettings}
      panelClassName="h-[680px] max-h-[88vh] w-[960px] max-w-[94vw] min-h-[520px] min-w-[720px]"
      footer={<span className="mr-auto text-2xs text-muted">Changes save automatically.</span>}
    >
      <div className="flex h-full min-h-0">
        <nav aria-label="Settings sections" className="flex w-[200px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line p-3">
          {NAV.map((item) => {
            const Icon = item.icon
            const selected = section === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => openSettings(item.id)}
                className={`flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-left text-sm transition-colors duration-150 ${
                  selected ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover hover:text-fg'
                }`}
              >
                <Icon size={15} aria-hidden />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {section === 'appearance' ? <AppearanceSection resolvedAccent={resolved.accent} /> : null}
          {section === 'workspaces' ? <WorkspacesSection /> : null}
          {section === 'browser' ? <BrowserSection /> : null}
          {section === 'phone' ? <PhoneCloudSection /> : null}
          {section === 'system' ? <SystemSection /> : null}
          {section === 'about' ? <AboutSection /> : null}
          {section === 'shortcuts' ? <ShortcutsSection /> : null}
        </div>
      </div>
    </Modal>
  )
}
