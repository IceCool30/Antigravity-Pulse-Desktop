import { useEffect, useState } from 'react'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { FONT_FAMILIES, FONT_SIZES, THEME_PRESETS, normalizeHex } from '@shared/theme'
import { resolveWorkspaceFont, type Settings } from '@shared/settings'
import { normalizeAccentOverride } from '@shared/validation'
import { useShell } from '../../store/shell'
import { Field, TextInput } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { Select } from '../ui/Select'
import { Toggle } from '../ui/Toggle'
import { Button } from '../ui/Button'
import { SectionHint, SectionTitle, SettingRow } from './SettingRow'

export function AppearanceSection({ resolvedAccent }: { resolvedAccent: string }) {
  const settings = useShell((state) => state.settings)
  const patchSettings = useShell((state) => state.patchSettings)
  const [hexDraft, setHexDraft] = useState(settings.accentOverride ?? '')

  useEffect(() => {
    setHexDraft(settings.accentOverride ?? '')
  }, [settings.accentOverride])

  const commitHex = (): void => {
    const normalized = normalizeAccentOverride(hexDraft)
    patchSettings({ accentOverride: normalized })
    setHexDraft(normalized ?? '')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionTitle>Appearance</SectionTitle>
        <SectionHint>Presets mirror the Android app. Accents are contrast-clamped to 4.8:1.</SectionHint>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">Theme preset</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {THEME_PRESETS.map((preset) => {
            const selected = settings.presetName === preset.name
            return (
              <button
                key={preset.name}
                type="button"
                aria-pressed={selected}
                onClick={() => patchSettings({ presetName: preset.name })}
                className={`flex flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-colors duration-150 hover:bg-hover ${
                  selected ? 'border-accent/60 ring-2 ring-accent/40' : 'border-line'
                }`}
              >
                <span className="flex gap-1" aria-hidden>
                  <span className="h-4 flex-1 rounded border border-line" style={{ background: preset.background }} />
                  <span className="h-4 flex-1 rounded border border-line" style={{ background: preset.foreground }} />
                  <span className="h-4 flex-1 rounded border border-line" style={{ background: preset.accent }} />
                </span>
                <span className="text-2xs font-medium">{preset.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <SettingRow
        title="Mode"
        description="System follows your OS preference."
        control={
          <Segmented
            label="Theme mode"
            value={settings.themeMode}
            onChange={(value) => patchSettings({ themeMode: value })}
            options={[
              { value: 'SYSTEM', label: 'System', icon: <SunMoon size={13} aria-hidden /> },
              { value: 'LIGHT', label: 'Light', icon: <Sun size={13} aria-hidden /> },
              { value: 'DARK', label: 'Dark', icon: <Moon size={13} aria-hidden /> }
            ]}
          />
        }
      />
      <SettingRow
        title="Contrast"
        description="Strong raises border and surface separation."
        control={
          <Segmented
            label="Contrast mode"
            value={settings.contrastMode}
            onChange={(value) => patchSettings({ contrastMode: value })}
            options={[
              { value: 'DEFAULT', label: 'Default' },
              { value: 'STRONG', label: 'Strong' }
            ]}
          />
        }
      />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">Accent override</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Accent color picker"
            value={normalizeHex(settings.accentOverride ?? '') ?? resolvedAccent}
            onChange={(event) => patchSettings({ accentOverride: normalizeHex(event.target.value) })}
            className="h-8 w-10 cursor-pointer rounded-[10px] border border-line bg-surface p-1"
          />
          <TextInput
            aria-label="Accent hex value"
            value={hexDraft}
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitHex()
              }
            }}
            placeholder="#FFC799"
            className="w-32 font-mono"
            spellCheck={false}
          />
          <Button variant="ghost" size="sm" onClick={() => patchSettings({ accentOverride: null })}>
            Reset
          </Button>
          <span className="ml-auto inline-flex items-center gap-2 text-2xs text-muted">
            Resolved
            <span
              aria-hidden
              className="h-5 w-5 rounded-md border border-line"
              style={{ background: resolvedAccent }}
            />
            <span className="font-mono">{resolvedAccent}</span>
          </span>
        </div>
      </div>

      <SettingRow
        title="Font family"
        description="Google Sans falls back to Inter (proprietary, not bundled)."
        control={
          <Select
            aria-label="Font family"
            value={settings.fontFamily}
            onChange={(event) => {
              const value = event.target.value
              if ((FONT_FAMILIES as readonly string[]).includes(value)) {
                patchSettings({ fontFamily: value as Settings['fontFamily'] })
              }
            }}
            className="w-48"
          >
            {FONT_FAMILIES.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </Select>
        }
      />
      <SettingRow
        title="Font size"
        control={
          <Segmented
            label="Font size"
            value={String(settings.fontSize)}
            onChange={(value) => patchSettings({ fontSize: Number(value) })}
            options={FONT_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
          />
        }
      />
      <SettingRow
        title="Smooth animations"
        description="Also honors your OS reduced-motion preference."
        control={
          <Toggle
            label="Smooth animations"
            checked={settings.smoothAnimations}
            onChange={(checked) => patchSettings({ smoothAnimations: checked })}
          />
        }
      />
      <SettingRow
        title="Frosted glass"
        description="Translucent blurred panels; off uses solid surfaces."
        control={
          <Toggle
            label="Frosted glass"
            checked={settings.frostedGlass}
            onChange={(checked) => patchSettings({ frostedGlass: checked })}
          />
        }
      />
      <p className="text-2xs text-muted">
        UI font stack: <span className="font-mono">{resolveWorkspaceFont(settings.fontFamily)}</span>
      </p>
    </div>
  )
}
