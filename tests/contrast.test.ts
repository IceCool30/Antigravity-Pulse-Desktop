import { describe, expect, it } from 'vitest'
import {
  MIN_ACCENT_CONTRAST,
  PRESET_NAMES,
  contrastRatio,
  ensureReadableAccent,
  getPreset,
  normalizeHex,
  resolveTheme,
  rgbToHsl
} from '../src/shared/theme'

const circularHueDistance = (a: number, b: number): number => {
  const difference = Math.abs(a - b) % 360
  return Math.min(difference, 360 - difference)
}

describe('WCAG contrast engine', () => {
  it('computes the canonical black/white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFC799', '#FFC799')).toBeCloseTo(1, 5)
  })

  it('normalizes short and long hex values', () => {
    expect(normalizeHex('#ffc799')).toBe('#FFC799')
    expect(normalizeHex('abc')).toBe('#AABBCC')
    expect(normalizeHex('not-a-color')).toBeNull()
  })

  it.each(PRESET_NAMES)('keeps %s readable in dark mode', (presetName) => {
    const theme = resolveTheme({
      presetName,
      themeMode: 'DARK',
      contrastMode: 'STRONG',
      systemPrefersDark: true
    })
    expect(theme.isLight).toBe(false)
    expect(contrastRatio(theme.accent, theme.surfaceElevated)).toBeGreaterThanOrEqual(
      MIN_ACCENT_CONTRAST
    )
    expect(contrastRatio(theme.accent, theme.background)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST)
    expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(theme.muted, theme.background)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(PRESET_NAMES)('keeps %s readable in adaptive light mode', (presetName) => {
    const theme = resolveTheme({
      presetName,
      themeMode: 'LIGHT',
      contrastMode: 'STRONG',
      systemPrefersDark: false
    })
    expect(theme.isLight).toBe(true)
    expect(theme.background).toBe('#EFF3F8')
    expect(theme.surface).toBe('#FFFFFF')
    expect(theme.foreground).toBe('#0F172A')
    expect(contrastRatio(theme.accent, theme.surface)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST)
    expect(contrastRatio(theme.accent, theme.background)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST)
    expect(contrastRatio(theme.foreground, theme.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('preserves the hue of the chosen preset accent', () => {
    for (const presetName of PRESET_NAMES) {
      const preset = getPreset(presetName)
      for (const themeMode of ['DARK', 'LIGHT'] as const) {
        const theme = resolveTheme({
          presetName,
          themeMode,
          contrastMode: 'DEFAULT',
          systemPrefersDark: true
        })
        expect(circularHueDistance(rgbToHsl(preset.accent).h, rgbToHsl(theme.accent).h)).toBeLessThan(
          14
        )
      }
    }
  })

  it('leaves an already-contrasting accent untouched', () => {
    expect(ensureReadableAccent('#FFC799', '#000000', false)).toBe('#FFC799')
  })

  it('honors accent overrides and SYSTEM mode via the caller preference', () => {
    const theme = resolveTheme({
      presetName: 'Default Dark',
      themeMode: 'SYSTEM',
      contrastMode: 'STRONG',
      systemPrefersDark: false,
      accentOverride: '#FFC799'
    })
    expect(theme.isLight).toBe(true)
    expect(theme.accentRaw).toBe('#FFC799')
    expect(theme.accent).not.toBe('#FFC799')
    expect(contrastRatio(theme.accent, theme.surface)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST)
  })
})
