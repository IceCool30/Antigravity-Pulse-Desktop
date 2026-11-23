import { useState } from 'react'
import { Download, FolderOpen, LogOut, Power, RefreshCw, Undo2 } from 'lucide-react'
import { errorMessage, invoke } from '../../lib/api'
import { useShell } from '../../store/shell'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Meter } from '../ui/Meter'
import { Toggle } from '../ui/Toggle'
import { SectionHint, SectionTitle, SettingRow } from './SettingRow'

export function SystemSection() {
  const settings = useShell((state) => state.settings)
  const update = useShell((state) => state.update)
  const patchSettings = useShell((state) => state.patchSettings)
  const resetSettings = useShell((state) => state.resetSettings)
  const pushToast = useShell((state) => state.pushToast)
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const checkNow = async (): Promise<void> => {
    setChecking(true)
    try {
      await invoke('app:checkUpdates', undefined)
    } catch (caught) {
      pushToast({ title: 'Update check failed', body: errorMessage(caught), kind: 'error' })
    } finally {
      setChecking(false)
    }
  }

  const downloadNow = async (): Promise<void> => {
    setDownloading(true)
    try {
      await invoke('app:downloadUpdate', undefined)
    } catch (caught) {
      pushToast({ title: 'Download failed', body: errorMessage(caught), kind: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  const installNow = async (): Promise<void> => {
    setInstalling(true)
    try {
      await invoke('app:installUpdate', undefined)
    } catch (caught) {
      pushToast({ title: 'Install failed', body: errorMessage(caught), kind: 'error' })
      setInstalling(false)
    }
  }

  const openPath = (target: 'userData' | 'downloads'): void => {
    void invoke('app:openPath', { target }).catch((error: unknown) =>
      pushToast({ title: 'Could not open folder', body: errorMessage(error), kind: 'error' })
    )
  }

  const progress = Math.round(update.progress ?? 0)
  const busy = checking || downloading || installing || update.state === 'downloading'
  const notes = update.releaseNotes?.trim()

  const updateBadge =
    update.state === 'available' ? (
      <Badge variant="accent" dot>
        {update.latestVersion ?? 'Update'} available
      </Badge>
    ) : update.state === 'downloading' ? (
      <Badge variant="warning" dot>
        Downloading {progress}%
      </Badge>
    ) : update.state === 'downloaded' ? (
      <Badge variant="online" dot>
        Ready to install
      </Badge>
    ) : update.state === 'installing' ? (
      <Badge variant="warning" dot>
        Installing
      </Badge>
    ) : update.state === 'current' ? (
      <Badge variant="online" dot>
        Up to date
      </Badge>
    ) : update.state === 'error' ? (
      <Badge variant="error" dot>
        Check failed
      </Badge>
    ) : update.state === 'checking' ? (
      <Badge variant="warning" dot>
        Checking
      </Badge>
    ) : (
      <Badge>Idle</Badge>
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2">
        <SectionTitle>System</SectionTitle>
        <SectionHint>Window behavior, updates, and local data.</SectionHint>
      </div>

      <SettingRow
        title="Close to tray"
        description="Closing the window keeps Pulse running in the tray."
        control={
          <Toggle
            label="Close to tray"
            checked={settings.closeToTray}
            onChange={(checked) => patchSettings({ closeToTray: checked })}
          />
        }
      />
      <SettingRow
        title="Launch minimized"
        description="Start hidden in the tray."
        control={
          <Toggle
            label="Launch minimized"
            checked={settings.launchMinimized}
            onChange={(checked) => patchSettings({ launchMinimized: checked })}
          />
        }
      />
      <SettingRow
        title="Notifications"
        control={
          <Toggle
            label="System notifications"
            checked={settings.notificationsEnabled}
            onChange={(checked) => patchSettings({ notificationsEnabled: checked })}
          />
        }
      />
      <SettingRow
        title="Update checks"
        description="Automatic check every 6 hours."
        control={
          <Toggle
            label="Automatic update checks"
            checked={settings.updateChecks}
            onChange={(checked) => patchSettings({ updateChecks: checked })}
          />
        }
      />
      <div className="flex flex-col">
        <SettingRow
          title="Updates"
          description={
            update.state === 'error'
              ? update.message ?? 'The update check failed.'
              : update.state === 'downloading'
                ? 'Downloading the latest installer…'
                : update.state === 'downloaded'
                  ? 'The installer is ready. Restart to apply the update.'
                  : update.message ?? 'Manual check against the latest release.'
          }
          control={
            <span className="flex items-center gap-2">
              {updateBadge}
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw size={12} aria-hidden />}
                loading={checking || update.state === 'checking'}
                disabled={busy}
                onClick={() => void checkNow()}
              >
                Check now
              </Button>
              {update.state === 'available' ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download size={12} aria-hidden />}
                  loading={downloading}
                  disabled={busy}
                  onClick={() => void downloadNow()}
                >
                  Download update
                </Button>
              ) : null}
              {update.state === 'downloaded' ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Power size={12} aria-hidden />}
                  loading={installing}
                  disabled={checking || installing}
                  onClick={() => void installNow()}
                >
                  Install &amp; restart
                </Button>
              ) : null}
              {update.state === 'error' ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw size={12} aria-hidden />}
                  disabled={busy}
                  onClick={() => void checkNow()}
                >
                  Retry
                </Button>
              ) : null}
            </span>
          }
        />
        {update.state === 'downloading' ? (
          <div className="flex items-center gap-3 py-2 text-xs text-muted">
            <Meter className="min-w-32 flex-1" value={progress / 100} label="Download progress" />
            <span className="tabular-nums">{progress}%</span>
          </div>
        ) : null}
        {update.state === 'available' && (update.latestVersion || notes) ? (
          <div className="py-1 text-xs text-muted">
            {update.latestVersion ? (
              <p>Version {update.latestVersion} is available to download.</p>
            ) : null}
            {notes ? <p className="mt-1 line-clamp-2 whitespace-pre-line">{notes}</p> : null}
          </div>
        ) : null}
      </div>
      <SettingRow
        title="Local folders"
        description="Settings, vault, and downloads live on this machine."
        control={
          <span className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<FolderOpen size={12} aria-hidden />}
              onClick={() => openPath('userData')}
            >
              Data folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download size={12} aria-hidden />}
              onClick={() => openPath('downloads')}
            >
              Downloads
            </Button>
          </span>
        }
      />
      <SettingRow
        title="Reset all settings"
        description="Restore defaults; workspaces and vault tokens are untouched."
        control={
          <Button
            variant="danger"
            size="sm"
            icon={<Undo2 size={12} aria-hidden />}
            onClick={() => setConfirmReset(true)}
          >
            Reset
          </Button>
        }
      />
      <SettingRow
        title="Quit Antigravity Pulse"
        description="Stops the bridge and closes every workspace."
        control={
          <Button
            variant="danger"
            size="sm"
            icon={<LogOut size={12} aria-hidden />}
            onClick={() => setConfirmQuit(true)}
          >
            Quit
          </Button>
        }
      />

      {confirmQuit ? (
        <ConfirmDialog
          title="Quit Antigravity Pulse?"
          body="The phone bridge stops and all workspaces close. Unsaved page state may be lost."
          confirmLabel="Quit"
          danger
          onCancel={() => setConfirmQuit(false)}
          onConfirm={() => {
            setConfirmQuit(false)
            void invoke('app:quit', undefined).catch((error: unknown) =>
              pushToast({ title: 'Quit failed', body: errorMessage(error), kind: 'error' })
            )
          }}
        />
      ) : null}
      {confirmReset ? (
        <ConfirmDialog
          title="Reset all settings?"
          body="Theme, workspace overrides, and preferences return to defaults. This cannot be undone."
          confirmLabel="Reset settings"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={async () => {
            setConfirmReset(false)
            await resetSettings()
          }}
        />
      ) : null}
    </div>
  )
}
