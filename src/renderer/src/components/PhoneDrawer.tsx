import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Bell,
  Copy,
  Fingerprint,
  KeyRound,
  MonitorSmartphone,
  Play,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Square,
  Wifi,
  X
} from 'lucide-react'
import { TITLEBAR_HEIGHT } from '@shared/layout'
import type { BridgeDevice } from '@shared/ipc'
import { errorMessage, invoke } from '../lib/api'
import { formatDuration, formatRelativeTime } from '../lib/format'
import { useShell } from '../store/shell'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { EmptyState } from './ui/EmptyState'
import { Field, TextInput } from './ui/Field'
import { IconButton } from './ui/IconButton'
import { useDialogBehavior } from './ui/Modal'
import { Spinner } from './ui/Spinner'

function DeviceRow({ device, now }: { device: BridgeDevice; now: number }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span aria-hidden className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-online opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-online" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{device.label}</p>
        <p className="truncate font-mono text-2xs text-muted">{device.address}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-2xs text-fg">
          {device.pingMs !== null ? `${device.pingMs} ms` : '—'}
        </p>
        <p className="font-mono text-2xs text-muted">{formatDuration(now - device.connectedAt)}</p>
      </div>
    </li>
  )
}

export function PhoneDrawer() {
  const zen = useShell((state) => state.zen)
  const bridge = useShell((state) => state.bridge)
  const settings = useShell((state) => state.settings)
  const closePhone = useShell((state) => state.closePhone)
  const patchSettings = useShell((state) => state.patchSettings)
  const pushToast = useShell((state) => state.pushToast)
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogBehavior(panelRef, closePhone)

  const [portDraft, setPortDraft] = useState(String(settings.bridgePort))
  const [portError, setPortError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const devices = bridge?.devices ?? []
  const running = bridge?.running === true
  const starting = bridge?.starting === true

  useEffect(() => {
    setPortDraft(String(settings.bridgePort))
  }, [settings.bridgePort])

  useEffect(() => {
    if (devices.length === 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [devices.length])

  const copy = async (text: string, label: string): Promise<void> => {
    try {
      await invoke('app:copy', { text })
      pushToast({ title: `${label} copied`, body: 'Keep it private — it contains the pairing token.', kind: 'success' })
    } catch (caught) {
      pushToast({ title: 'Copy failed', body: errorMessage(caught), kind: 'error' })
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

  const regenerate = async (): Promise<void> => {
    setConfirmRegen(false)
    try {
      await invoke('bridge:regenerateToken', undefined)
      pushToast({ title: 'Token regenerated', body: 'Previously paired phones must scan again.', kind: 'success' })
    } catch (caught) {
      pushToast({ title: 'Regeneration failed', body: errorMessage(caught), kind: 'error' })
    }
  }

  const testNotification = (): void => {
    void invoke('app:notify', {
      title: 'Antigravity Pulse',
      body: 'Bridge test notification — everything is wired up.'
    }).catch((error: unknown) =>
      pushToast({ title: 'Notification failed', body: errorMessage(error), kind: 'error' })
    )
  }

  const safeDeepLink = bridge?.deepLink
    ? bridge.deepLink.replace(/token=[^&]*/, `token=${bridge.tokenPreview}`)
    : null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/24" onMouseDown={closePhone} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Phone Companion"
        tabIndex={-1}
        className="anim-slide-in absolute bottom-0 right-0 flex w-[440px] max-w-[94vw] flex-col border-l border-line bg-surface shadow-2xl"
        style={{ top: zen ? 0 : TITLEBAR_HEIGHT }}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
          <MonitorSmartphone size={17} className="text-accent" aria-hidden />
          <h2 className="font-display text-md font-semibold leading-[1.15]">Phone Companion</h2>
          {running ? (
            <Badge variant="online" dot>
              Running
            </Badge>
          ) : starting ? (
            <Badge variant="warning" dot>
              Starting
            </Badge>
          ) : (
            <Badge>Off</Badge>
          )}
          <span className="flex-1" />
          <IconButton label="Close Phone Companion" onClick={closePhone}>
            <X size={16} aria-hidden />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-5">
            {/* Controls */}
            <div className="flex items-end gap-2">
              {running ? (
                <Button
                  variant="outline"
                  icon={<Square size={13} aria-hidden />}
                  loading={busy}
                  onClick={() => void setRunning(false)}
                >
                  Stop bridge
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={<Play size={13} aria-hidden />}
                  loading={busy || starting}
                  onClick={() => void setRunning(true)}
                >
                  Start bridge
                </Button>
              )}
              <Field label="Port" htmlFor="phone-port" error={portError} className="w-28">
                <TextInput
                  id="phone-port"
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
              <Button variant="ghost" className="mb-0.5" disabled={busy} onClick={() => void applyPort()}>
                Apply & restart
              </Button>
            </div>

            {bridge?.error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-xs text-error">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                {bridge.error}
              </p>
            ) : null}

            {/* QR */}
            <section aria-label="Pairing QR code" className="flex flex-col items-center gap-2">
              {running && bridge?.qrDataUrl ? (
                <>
                  <span className="rounded-2xl bg-white p-3">
                    <img
                      src={bridge.qrDataUrl}
                      alt="Pairing QR code for Antigravity Pulse on Android"
                      width={220}
                      height={220}
                      className="block h-[220px] w-[220px]"
                    />
                  </span>
                  {safeDeepLink ? (
                    <p className="max-w-full truncate font-mono text-2xs text-muted" title="Deep link (token hidden)">
                      {safeDeepLink}
                    </p>
                  ) : null}
                </>
              ) : (
                <span className="grid h-[246px] w-[246px] place-items-center rounded-2xl border border-dashed border-line text-center">
                  <span className="flex flex-col items-center gap-2 px-6 text-muted">
                    {starting ? <Spinner size={22} label="Starting bridge" /> : <QrCode size={26} aria-hidden />}
                    <span className="text-xs">
                      {starting ? 'Starting the bridge…' : 'Start the bridge to generate a QR'}
                    </span>
                  </span>
                </span>
              )}
            </section>

            {/* Steps */}
            <section aria-label="Pairing steps">
              <h3 className="text-sm font-medium">Scan with Antigravity Pulse on Android</h3>
              <ol className="mt-2 flex flex-col gap-1.5 text-xs text-muted">
                {[
                  'Join the same Wi-Fi network, or connect both devices over Tailscale.',
                  'Scan the QR code with the Android app’s pairing screen.',
                  'Approve the token on this desktop to finish pairing.'
                ].map((step, index) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-2xs text-accent">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>

            {/* Addresses */}
            <section aria-label="Bridge addresses">
              <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
                Addresses
              </h3>
              {bridge && bridge.addresses.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {bridge.addresses.map((entry) => (
                    <li
                      key={`${entry.label}-${entry.address}`}
                      className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                    >
                      <Badge variant={entry.label === 'Tailscale' ? 'accent' : 'neutral'}>
                        {entry.label}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {entry.address}:{bridge.port}
                      </span>
                      <IconButton
                        label={`Copy ${entry.label} address`}
                        size="sm"
                        onClick={() => void copy(`http://${entry.address}:${bridge.port}`, 'Address')}
                      >
                        <Copy size={13} aria-hidden />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Addresses appear once the bridge is running.</p>
              )}
            </section>

            {/* Pairing payload */}
            <section aria-label="Pairing payload" className="panel rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Fingerprint size={15} className="text-accent" aria-hidden />
                <h3 className="text-sm font-medium">Pairing payload</h3>
              </div>
              <dl className="mt-3 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Fingerprint</dt>
                  <dd className="font-mono">{bridge?.fingerprint || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Token</dt>
                  <dd className="font-mono">{bridge?.tokenPreview || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Started</dt>
                  <dd className="font-mono">{formatRelativeTime(bridge?.startedAt)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Copy size={12} aria-hidden />}
                  disabled={!bridge?.deepLink}
                  onClick={() => bridge?.deepLink && void copy(bridge.deepLink, 'Deep link')}
                >
                  Copy deep link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Copy size={12} aria-hidden />}
                  disabled={!bridge?.fallbackUrl}
                  onClick={() => bridge?.fallbackUrl && void copy(bridge.fallbackUrl, 'Fallback URL')}
                >
                  Copy fallback URL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RefreshCw size={12} aria-hidden />}
                  disabled={!running}
                  onClick={() => setConfirmRegen(true)}
                >
                  Regenerate token
                </Button>
              </div>
            </section>

            {/* Devices */}
            <section aria-label="Connected devices">
              <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
                Devices ({devices.length})
              </h3>
              {devices.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {devices.map((device) => (
                    <DeviceRow key={device.id} device={device} now={now} />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<MonitorSmartphone size={20} />}
                  title="No phones yet"
                  body="Paired phones appear here with live ping and connection time."
                />
              )}
            </section>

            {/* Footer actions */}
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <Button
                variant="outline"
                size="sm"
                icon={<Bell size={13} aria-hidden />}
                onClick={testNotification}
                className="self-start"
              >
                Test notification
              </Button>
              <p className="flex items-start gap-2 text-2xs text-muted">
                <Wifi size={13} className="mt-0.5 shrink-0" aria-hidden />
                If pairing fails, allow port {bridge?.port ?? settings.bridgePort} through Windows
                Firewall for private networks.
              </p>
              <p className="flex items-start gap-2 text-2xs text-muted">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                Bridge listens only on your local network; every API call requires the 256-bit
                bearer token.
              </p>
            </div>
          </div>
        </div>
      </div>

      {confirmRegen ? (
        <ConfirmDialog
          title="Regenerate pairing token?"
          body="This disconnects every paired phone. Each device must scan the new QR code to reconnect."
          confirmLabel="Regenerate"
          danger
          onCancel={() => setConfirmRegen(false)}
          onConfirm={regenerate}
        />
      ) : null}
    </div>,
    document.body
  )
}
