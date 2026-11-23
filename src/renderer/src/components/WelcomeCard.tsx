import { ArrowUpRight, Check, X } from 'lucide-react'
import { useShell } from '../store/shell'
import { OrbitMark } from './BrandIcons'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { Kbd } from './ui/Kbd'

export function WelcomeCard() {
  const patchSettings = useShell((state) => state.patchSettings)
  const togglePalette = useShell((state) => state.togglePalette)

  const dismiss = (): void => patchSettings({ seenWelcome: true })

  return (
    <section
      aria-label="Welcome"
      className="anim-fade-up relative rounded-2xl border border-accent/30 bg-accent-soft p-5"
    >
      <IconButton label="Dismiss welcome card" className="absolute right-3 top-3" onClick={dismiss}>
        <X size={15} aria-hidden />
      </IconButton>
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface text-accent">
          <OrbitMark size={24} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-md font-semibold leading-[1.15]">
            Welcome to Antigravity Pulse
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Nine workspaces stay warm and pinned on the left. Press <Kbd>Ctrl K</Kbd> for the
            command palette, <Kbd>Ctrl 1–9</Kbd> to jump between consoles, and{' '}
            <Kbd>Ctrl Shift P</Kbd> to pair your phone. Everything is local-first.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={togglePalette}>
              Open command palette
            </Button>
            <Button variant="ghost" size="sm" icon={<Check size={13} aria-hidden />} onClick={dismiss}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
