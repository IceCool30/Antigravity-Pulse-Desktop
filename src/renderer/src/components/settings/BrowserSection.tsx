import { useShell } from '../../store/shell'
import { Segmented } from '../ui/Segmented'
import { SectionHint, SectionTitle, SettingRow } from './SettingRow'

export function BrowserSection() {
  const settings = useShell((state) => state.settings)
  const browser = useShell((state) => state.browser)
  const patchSettings = useShell((state) => state.patchSettings)
  const tabCount = browser?.tabs.length ?? settings.browserTabs.length

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2">
        <SectionTitle>Browser</SectionTitle>
        <SectionHint>Pulse Browser behavior and session sharing.</SectionHint>
      </div>
      <SettingRow
        title="External links"
        description="Where links opened from workspaces land."
        control={
          <Segmented
            label="External link behavior"
            value={settings.externalLinkBehavior}
            onChange={(value) => patchSettings({ externalLinkBehavior: value })}
            options={[
              { value: 'system', label: 'System browser' },
              { value: 'pulse-browser', label: 'Pulse Browser' }
            ]}
          />
        }
      />
      <SettingRow
        title="Open tabs"
        description="Maximum 20 tabs per session."
        control={<span className="font-mono text-sm">{tabCount}</span>}
      />
      <div className="mt-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
        Pulse Browser shares the persistent session with your workspaces, so sign-ins carry over.
        Isolate a workspace (or the browser) in the Workspaces section to give it a separate session.
      </div>
    </div>
  )
}
