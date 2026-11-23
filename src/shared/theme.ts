/**
 * Shared theme engine. Mirrors the 12 official Antigravity presets and the
 * Android app's WCAG AA+ accent adjustment (HSL lightness search, >= 4.8:1).
 * Pure functions only so the renderer, main process, and Vitest all agree.
 */

export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK'
export type ContrastMode = 'DEFAULT' | 'STRONG'

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

export interface ThemePreset {
  name: string
  background: string
  foreground: string
  accent: string
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { name: 'Default Dark', background: '#000000', foreground: '#FFFFFF', accent: '#FFC799' },
  { name: 'Legacy Dark', background: '#0B0E14', foreground: '#F1F5F9', accent: '#38BDF8' },
  { name: 'Catppuccin', background: '#1E1E2E', foreground: '#CDD6F4', accent: '#CBA6F7' },
  { name: 'Dracula', background: '#282A36', foreground: '#F8F8F2', accent: '#BD93F9' },
  { name: 'Everforest', background: '#2D353B', foreground: '#D3C6AA', accent: '#A7C080' },
  { name: 'Gruvbox Material', background: '#282828', foreground: '#D4BE98', accent: '#E78A4E' },
  { name: 'Monokai', background: '#272822', foreground: '#F8F8F2', accent: '#A6E22E' },
  { name: 'Nord', background: '#2E3440', foreground: '#ECEFF4', accent: '#88C0D0' },
  { name: 'One Dark Pro', background: '#282C34', foreground: '#ABB2BF', accent: '#61AFEF' },
  { name: 'Tokyo Night', background: '#1A1B26', foreground: '#C0CAF5', accent: '#7AA2F7' },
  { name: 'Solarized Dark', background: '#002B36', foreground: '#839496', accent: '#2AA198' },
  { name: 'Vesper', background: '#101010', foreground: '#FFFFFF', accent: '#FFC799' }
]

export const PRESET_NAMES = THEME_PRESETS.map((preset) => preset.name)

export const FONT_FAMILIES = [
  'Google Sans',
  'Space Grotesk',
  'Inter',
  'JetBrains Mono',
  'Fira Code',
  'Roboto Mono'
] as const

export type FontFamily = (typeof FONT_FAMILIES)[number]
export const FONT_SIZES = [12, 13, 14, 15, 16, 18] as const

export const LIGHT_BACKGROUND = '#EFF3F8'
export const LIGHT_SURFACE = '#FFFFFF'
export const LIGHT_SURFACE_ELEVATED = '#E2E8F0'
export const LIGHT_FOREGROUND = '#0F172A'
export const LIGHT_MUTED = '#334155'
export const STATUS_ONLINE = '#10B981'
export const STATUS_ERROR = '#EF4444'
export const STATUS_WARNING = '#F59E0B'
export const AI_STUDIO_ACCENT = '#7DD3FC'
export const MIN_ACCENT_CONTRAST = 4.8

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export function isPresetName(value: unknown): value is string {
  return typeof value === 'string' && PRESET_NAMES.includes(value)
}

export function getPreset(name: string): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.name === name) ?? (THEME_PRESETS[0] as ThemePreset)
}

/** Normalizes #rgb/#rrggbb to uppercase #RRGGBB, or null when malformed. */
export function normalizeHex(input: string): string | null {
  if (typeof input !== 'string') return null
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!match) return null
  const raw = match[1] as string
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw
  return `#${full.toUpperCase()}`
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex)
  if (!normalized) throw new Error(`Invalid hex color: ${hex}`)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number): string =>
    Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0').toUpperCase()
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const linear = (channel: number): number => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio between two hex colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

export function rgbToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex)
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const l = (max + min) / 2
  if (delta === 0) return { h: 0, s: 0, l }
  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === red) h = ((green - blue) / delta) % 6
  else if (max === green) h = (blue - red) / delta + 2
  else h = (red - green) / delta + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360
  const saturation = clamp(s, 0, 1)
  const lightness = clamp(l, 0, 1)
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = hue / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  let red = 0
  let green = 0
  let blue = 0
  if (section < 1) [red, green, blue] = [chroma, x, 0]
  else if (section < 2) [red, green, blue] = [x, chroma, 0]
  else if (section < 3) [red, green, blue] = [0, chroma, x]
  else if (section < 4) [red, green, blue] = [0, x, chroma]
  else if (section < 5) [red, green, blue] = [x, 0, chroma]
  else [red, green, blue] = [chroma, 0, x]
  const m = lightness - chroma / 2
  return { r: (red + m) * 255, g: (green + m) * 255, b: (blue + m) * 255 }
}

export function hslToHex(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb(h, s, l))
}

/** Mixes `b` into `a`. `amount` is the weight of `b` (0..1). */
export function mix(a: string, b: string, amount: number): string {
  const first = hexToRgb(a)
  const second = hexToRgb(b)
  const weight = clamp(amount, 0, 1)
  return rgbToHex({
    r: first.r + (second.r - first.r) * weight,
    g: first.g + (second.g - first.g) * weight,
    b: first.b + (second.b - first.b) * weight
  })
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

/**
 * Preserves a vivid accent when it already clears `minContrast`, otherwise
 * walks HSL lightness toward the direction with headroom (darker on light
 * surfaces, lighter on dark surfaces) until WCAG AA+ is met. Hue is preserved.
 */
export function ensureReadableAccent(
  rawAccent: string,
  againstSurface: string,
  isLightMode: boolean,
  minContrast: number = MIN_ACCENT_CONTRAST
): string {
  const accent = normalizeHex(rawAccent)
  const surface = normalizeHex(againstSurface)
  if (!accent || !surface) return isLightMode ? '#7C3D0A' : '#FFC799'
  if (contrastRatio(accent, surface) >= minContrast) return accent

  const { h, s, l } = rgbToHsl(accent)
  const targetS = s > 0.12 ? (isLightMode ? clamp(s, 0.68, 0.92) : clamp(s, 0.55, 0.95)) : s
  const surfaceLuminance = relativeLuminance(surface)
  const darken = surfaceLuminance > 0.18

  let best = accent

  if (darken) {
    // Keep the highest lightness that still clears the threshold (closest to raw).
    let low = 0
    let high = clamp(l, 0.02, 0.98)
    for (let index = 0; index < 20; index += 1) {
      const mid = (low + high) / 2
      const candidate = hslToHex(h, targetS, mid)
      if (contrastRatio(candidate, surface) >= minContrast) {
        best = candidate
        low = mid
      } else {
        high = mid
      }
    }
  } else {
    // Keep the lowest lightness that still clears the threshold (closest to raw).
    let low = clamp(l, 0.02, 0.98)
    let high = 1
    for (let index = 0; index < 20; index += 1) {
      const mid = (low + high) / 2
      const candidate = hslToHex(h, targetS, mid)
      if (contrastRatio(candidate, surface) >= minContrast) {
        best = candidate
        high = mid
      } else {
        low = mid
      }
    }
  }

  if (contrastRatio(best, surface) < minContrast) {
    return contrastRatio('#000000', surface) >= contrastRatio('#FFFFFF', surface) ? '#000000' : '#FFFFFF'
  }
  return best
}

export interface ResolvedTheme {
  isLight: boolean
  presetName: string
  background: string
  surface: string
  surfaceElevated: string
  surfaceHover: string
  foreground: string
  muted: string
  accent: string
  accentRaw: string
  accentSoft: string
  onAccent: string
  border: string
  borderStrong: string
  glass: string
  statusOnline: string
  statusError: string
  statusWarning: string
  aiAccent: string
  shadow: string
}

export interface ThemeRequest {
  presetName: string
  themeMode: ThemeMode
  contrastMode: ContrastMode
  systemPrefersDark: boolean
  accentOverride?: string | null
}

export function resolveTheme(request: ThemeRequest): ResolvedTheme {
  const isLight =
    request.themeMode === 'LIGHT' || (request.themeMode === 'SYSTEM' && !request.systemPrefersDark)
  const preset = getPreset(request.presetName)
  const strong = request.contrastMode === 'STRONG'
  const accentRaw = normalizeHex(request.accentOverride ?? '') ?? preset.accent

  if (isLight) {
    const background = LIGHT_BACKGROUND
    const surface = LIGHT_SURFACE
    const surfaceElevated = LIGHT_SURFACE_ELEVATED
    let accent = ensureReadableAccent(accentRaw, surface, true)
    if (contrastRatio(accent, background) < MIN_ACCENT_CONTRAST) {
      accent = ensureReadableAccent(accent, background, true)
    }
    const foreground = LIGHT_FOREGROUND
    const onAccent =
      contrastRatio('#000000', accent) >= contrastRatio('#FFFFFF', accent) ? '#000000' : '#FFFFFF'
    return {
      isLight: true,
      presetName: preset.name,
      background,
      surface,
      surfaceElevated,
      surfaceHover: mix(surfaceElevated, '#FFFFFF', 0.55),
      foreground,
      muted: LIGHT_MUTED,
      accent,
      accentRaw,
      accentSoft: withAlpha(accent, 0.12),
      onAccent,
      border: strong ? 'rgba(15, 23, 42, 0.2)' : 'rgba(15, 23, 42, 0.12)',
      borderStrong: 'rgba(15, 23, 42, 0.28)',
      glass: 'rgba(255, 255, 255, 0.74)',
      statusOnline: '#047857',
      statusError: '#B91C1C',
      statusWarning: '#B45309',
      aiAccent: '#0369A1',
      shadow: '0 18px 48px rgba(15, 23, 42, 0.16)'
    }
  }

  const background = preset.background
  const surface = mix(background, '#FFFFFF', strong ? 0.06 : 0.04)
  const surfaceElevated = mix(background, '#FFFFFF', strong ? 0.11 : 0.085)
  let accent = ensureReadableAccent(accentRaw, surfaceElevated, false)
  if (contrastRatio(accent, background) < MIN_ACCENT_CONTRAST) {
    accent = ensureReadableAccent(accent, background, false)
  }
  const foreground = preset.foreground
  const muted = mix(foreground, background, 0.18)
  const onAccent =
    contrastRatio('#000000', accent) >= contrastRatio('#FFFFFF', accent) ? '#000000' : '#FFFFFF'
  return {
    isLight: false,
    presetName: preset.name,
    background,
    surface,
    surfaceElevated,
    surfaceHover: mix(background, '#FFFFFF', strong ? 0.1 : 0.075),
    foreground,
    muted: contrastRatio(muted, background) >= 4.5 ? muted : foreground,
    accent,
    accentRaw,
    accentSoft: withAlpha(accent, 0.12),
    onAccent,
    border: strong ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.13)',
    borderStrong: 'rgba(255, 255, 255, 0.3)',
    glass: 'rgba(8, 8, 9, 0.68)',
    statusOnline: STATUS_ONLINE,
    statusError: STATUS_ERROR,
    statusWarning: STATUS_WARNING,
    aiAccent: AI_STUDIO_ACCENT,
    shadow: '0 24px 64px rgba(0, 0, 0, 0.55)'
  }
}
