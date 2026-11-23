import { useEffect } from 'react'
import { resolveTheme } from '@shared/theme'
import { OrbitMark } from './components/BrandIcons'
import { BrowserChrome } from './components/BrowserChrome'
import { CommandPalette } from './components/CommandPalette'
import { PhoneDrawer } from './components/PhoneDrawer'
import { Rail } from './components/Rail'
import { SettingsPanel } from './components/SettingsPanel'
import { Stage } from './components/Stage'
import { T3PairingModal } from './components/T3PairingModal'
import { TitleBar } from './components/TitleBar'
import { ToastStack } from './components/ToastStack'
import { ZenBar } from './components/ZenBar'
import { Button } from './components/ui/Button'
import { Spinner } from './components/ui/Spinner'
import { errorMessage, hasPulseApi, invoke, subscribeEvents } from './lib/api'
import { applyTheme, watchSystemDark } from './lib/theme'
import { selectOverlayOpen, useShell } from './store/shell'

function BootScreen() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg text-fg">
      <div className="flex flex-col items-center gap-4">
        <OrbitMark size={40} className="text-accent" />
        <p className="font-display text-md font-semibold tracking-[0.02em]">Antigravity Pulse</p>
        <Spinner size={20} label="Starting Antigravity Pulse" />
      </div>
    </div>
  )
}

function FatalCard({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg p-6 text-fg">
      <div className="panel w-full max-w-md rounded-2xl p-6 text-center">
        <OrbitMark size={32} className="mx-auto text-accent" />
        <h1 className="mt-3 font-display text-md font-semibold">Pulse could not start</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
          Reload shell
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  const ready = useShell((state) => state.ready)
  const bootError = useShell((state) => state.bootError)
  const settings = useShell((state) => state.settings)
  const systemPrefersDark = useShell((state) => state.systemPrefersDark)
  const overlayOpen = useShell(selectOverlayOpen)
  const paletteOpen = useShell((state) => state.paletteOpen)
  const settingsOpen = useShell((state) => state.settingsOpen)
  const phoneOpen = useShell((state) => state.phoneOpen)
  const t3Open = useShell((state) => state.t3Open)

  /* Bootstrap once, seed the store, subscribe to main-process events. */
  useEffect(() => {
    if (!hasPulseApi()) {
      useShell
        .getState()
        .setBootError('The preload bridge (window.pulse) is unavailable. Launch the app through Electron.')
      return
    }
    let cancelled = false
    const unsubscribe = subscribeEvents((event) => useShell.getState().applyEvent(event))
    const stopWatching = watchSystemDark((dark) => useShell.getState().setSystemPrefersDark(dark))
    void invoke('app:bootstrap', undefined)
      .then((info) => {
        if (cancelled) return
        useShell.getState().seed(info)
        // Geometry contract: publish the renderer-owned layout once after bootstrap.
        useShell.getState().sendLayout()
      })
      .catch((error: unknown) => {
        if (!cancelled) useShell.getState().setBootError(errorMessage(error))
      })
    return () => {
      cancelled = true
      unsubscribe()
      stopWatching()
    }
  }, [])

  /* Resolve the shared theme into CSS custom properties. */
  useEffect(() => {
    const theme = resolveTheme({
      presetName: settings.presetName,
      themeMode: settings.themeMode,
      contrastMode: settings.contrastMode,
      systemPrefersDark,
      accentOverride: settings.accentOverride
    })
    applyTheme(theme, settings)
  }, [settings, systemPrefersDark])

  /* Overlay balance: true while any modal/palette/settings/phone drawer is open. */
  useEffect(() => {
    if (!ready || !hasPulseApi()) return
    void invoke('overlay:setVisible', { visible: overlayOpen }).catch(() => undefined)
  }, [overlayOpen, ready])

  if (!hasPulseApi()) {
    return <FatalCard message="The preload bridge (window.pulse) is unavailable. Launch the app through Electron." />
  }
  if (bootError) return <FatalCard message={bootError} />
  if (!ready) return <BootScreen />

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg text-fg">
      <Stage />
      <BrowserChrome />
      <Rail />
      <TitleBar />
      <ZenBar />
      {paletteOpen ? <CommandPalette /> : null}
      {settingsOpen ? <SettingsPanel /> : null}
      {phoneOpen ? <PhoneDrawer /> : null}
      {t3Open ? <T3PairingModal /> : null}
      <ToastStack />
    </div>
  )
}
