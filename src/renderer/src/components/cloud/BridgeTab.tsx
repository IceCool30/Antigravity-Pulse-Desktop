import { useState } from 'react'
import { Copy, MonitorSmartphone, Play, Square, Wifi } from 'lucide-react'
import { errorMessage, invoke } from '../../lib/api'
import { formatRelativeTime } from '../../lib/format'
import { useShell } from '../../store/shell'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { IconButton } from '../ui/IconButton'

export function BridgeTab() {
  const bridge = useShell((state) => state.bridge)
  const togglePhone = useShell((state) => state.togglePhone)
  const pushToast = useShell((state) => state.pushToast)
  const [busy, setBusy] = useState(false)

  const running = bridge?.running === true
  const devices = bridge?.devices ?? []

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

  const copyAddress = async (text: string): Promise<void> => {
    try {
      await invoke('app:copy', { text })
      pushToast({ title: 'Address copied', kind: 'success' })
    } catch (caught) {
      pushToast({ title: 'Copy failed', body: errorMessage(caught), kind: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="panel flex flex-wrap items-center gap-4 rounded-2xl p-5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Wifi size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold">Local phone bridge</h3>
            {running ? (
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
          </div>
          <p className="mt-1 font-mono text-2xs text-muted">
            port {bridge?.port ?? '—'} · started {formatRelativeTime(bridge?.startedAt)} ·{' '}
            {devices.length} device{devices.length === 1 ? '' : 's'}
          </p>
          {bridge?.error ? <p className="mt-1 text-xs text-error">{bridge.error}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="soft"
            icon={<MonitorSmartphone size={14} aria-hidden />}
            onClick={togglePhone}
          >
            Open Phone Companion
          </Button>
          {running ? (
            <Button
              variant="outline"
              icon={<Square size={13} aria-hidden />}
              loading={busy}
              onClick={() => void setRunning(false)}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<Play size={13} aria-hidden />}
              loading={busy}
              onClick={() => void setRunning(true)}
            >
              Start
            </Button>
          )}
        </div>
      </div>

      {bridge && bridge.addresses.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {bridge.addresses.map((entry) => (
            <li
              key={`${entry.label}-${entry.address}`}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
            >
              <Badge variant={entry.label === 'Tailscale' ? 'accent' : 'neutral'}>{entry.label}</Badge>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                http://{entry.address}:{bridge.port}
              </span>
              <IconButton
                label={`Copy ${entry.label} address`}
                size="sm"
                onClick={() => void copyAddress(`http://${entry.address}:${bridge.port}`)}
              >
                <Copy size={13} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<MonitorSmartphone size={20} />}
          title="Bridge is offline"
          body="Start the bridge to expose LAN and Tailscale addresses for your phone."
        />
      )}
    </div>
  )
}
