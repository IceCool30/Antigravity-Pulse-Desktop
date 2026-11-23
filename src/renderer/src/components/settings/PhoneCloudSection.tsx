import { useEffect, useState } from 'react'
import { Cloud, MonitorSmartphone, Play, Square } from 'lucide-react'
import { errorMessage, invoke } from '../../lib/api'
import { useShell } from '../../store/shell'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import { SectionHint, SectionTitle, SettingRow } from './SettingRow'

export function PhoneCloudSection() {
  const settings = useShell((state) => state.settings)
  const bridge = useShell((state) => state.bridge)
  const cloudAccount = useShell((state) => state.cloudAccount)
  const patchSettings = useShell((state) => state.patchSettings)
  const togglePhone = useShell((state) => state.togglePhone)
  const closeSettings = useShell((state) => state.closeSettings)
  const pushToast = useShell((state) => state.pushToast)
  const [portDraft, setPortDraft] = useState(String(settings.bridgePort))
  const [portError, setPortError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPortDraft(String(settings.bridgePort))
  }, [settings.bridgePort])

  const applyPort = async (): Promise<void> => {
    const port = Number(portDraft)
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      setPortError('Port must be an integer between 1024 and 65535.')
      return
    }
    setPortError(null)
    setBusy(true)
    try {
      patchSettings({ bridgePort: port })
      await invoke('bridge:restart', { port })
    } catch (caught) {
      pushToast({ title: 'Bridge restart failed', body: errorMessage(caught), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const setRunning = async (start: boolean): Promise<void> => {
    setBusy(true)
    try {
      await invoke(start ? 'bridge:start' : 'bridge:stop', undefined)
    } catch (caught) {
      pushToast({ title: 'Bridge action failed', body: errorMessage(caught), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const openCloud = (): void => {
    closeSettings()
    void invoke('workspace:activate', { id: 'cloud' }).catch((error: unknown) =>
      pushToast({ title: 'Could not open Cloud Sync', body: errorMessage(error), kind: 'error' })
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2">
        <SectionTitle>Phone & Cloud</SectionTitle>
        <SectionHint>The local bridge and your Google connection.</SectionHint>
      </div>

      <SettingRow
        title="Phone bridge"
        description="Auto-start the LAN bridge with the app."
        control={
          <Toggle
            label="Enable phone bridge"
            checked={settings.bridgeEnabled}
            onChange={(checked) => patchSettings({ bridgeEnabled: checked })}
          />
        }
      />

      <div className="flex items-end gap-2 border-b border-line/60 py-3">
        <Field label="Bridge port" htmlFor="settings-bridge-port" error={portError} className="w-40">
          <TextInput
            id="settings-bridge-port"
            value={portDraft}
            onChange={(event) => {
              setPortDraft(event.target.value)
              if (portError) setPortError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void applyPort()
              }
            }}
            inputMode="numeric"
            invalid={Boolean(portError)}
            className="font-mono"
          />
        </Field>
        <Button variant="outline" size="sm" className="mb-0.5" loading={busy} onClick={() => void applyPort()}>
          Apply & restart
        </Button>
        <span className="mb-0.5 ml-auto flex items-center gap-2">
          {bridge?.running ? (
            <Badge variant="online" dot>
              Running
            </Badge>
          ) : bridge?.starting ? (
            <Badge variant="warning" dot>
              Starting
            </Badge>
          ) : (
            <Badge>Off</Badge>
          )}
          {bridge?.running ? (
            <Button
              variant="outline"
              size="sm"
              icon={<Square size={12} aria-hidden />}
              disabled={busy}
              onClick={() => void setRunning(false)}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Play size={12} aria-hidden />}
              disabled={busy}
              onClick={() => void setRunning(true)}
            >
              Start
            </Button>
          )}
        </span>
      </div>

      <SettingRow
        title="Phone Companion"
        description="QR pairing, addresses, and connected devices."
        control={
          <Button
            variant="soft"
            size="sm"
            icon={<MonitorSmartphone size={13} aria-hidden />}
            onClick={togglePhone}
          >
            Open Phone Companion
          </Button>
        }
      />
      <SettingRow
        title="Notifications"
        description="Native toasts for crashes, shares, and bridge events."
        control={
          <Toggle
            label="Notifications"
            checked={settings.notificationsEnabled}
            onChange={(checked) => patchSettings({ notificationsEnabled: checked })}
          />
        }
      />
      <SettingRow
        title="Google connection"
        description={cloudAccount?.email ?? 'Not connected'}
        control={
          <Button variant="soft" size="sm" icon={<Cloud size={13} aria-hidden />} onClick={openCloud}>
            Open Cloud Sync
          </Button>
        }
      />
    </div>
  )
}
