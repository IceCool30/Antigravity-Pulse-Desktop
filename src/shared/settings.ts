import { FONT_FAMILIES, FONT_SIZES, isPresetName, normalizeHex, type ContrastMode, type FontFamily, type ThemeMode } from './theme'
import { isWorkspaceId, type WorkspaceId } from './workspaces'
import { MAX_T3_URL_LENGTH, normalizeAccentOverride, normalizeHttpUrl, stripUrlSecrets } from './validation'

export interface BrowserTabSeed {
  url: string
}

export interface Settings {
  version: 1
  themeMode: ThemeMode
  presetName: string
  contrastMode: ContrastMode
  accentOverride: string | null
  fontFamily: FontFamily
  fontSize: number
  smoothAnimations: boolean
  frostedGlass: boolean
  railExpanded: boolean
  splitRatio: number
  externalLinkBehavior: 'system' | 'pulse-browser'
  isolatedWorkspaces: string[]
  workspaceUrls: Record<string, string>
  /** Resume URLs, always credential-stripped. */
  lastUrls: Record<string, string>
  closeToTray: boolean
  launchMinimized: boolean
  notificationsEnabled: boolean
  updateChecks: boolean
  bridgeEnabled: boolean
  bridgePort: number
  lastWorkspaceId: WorkspaceId | null
  lastSecondaryId: WorkspaceId | null
  browserTabs: BrowserTabSeed[]
  browserActiveIndex: number
  zoom: Record<string, number>
  seenWelcome: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  themeMode: 'DARK',
  presetName: 'Default Dark',
  contrastMode: 'STRONG',
  accentOverride: null,
  fontFamily: 'Inter',
  fontSize: 14,
  smoothAnimations: true,
  frostedGlass: true,
  railExpanded: false,
  splitRatio: 0.5,
  externalLinkBehavior: 'system',
  isolatedWorkspaces: [],
  workspaceUrls: {},
  lastUrls: {},
  closeToTray: true,
  launchMinimized: false,
  notificationsEnabled: true,
  updateChecks: true,
  bridgeEnabled: false,
  bridgePort: 3847,
  lastWorkspaceId: null,
  lastSecondaryId: null,
  browserTabs: [{ url: 'https://www.google.com/' }],
  browserActiveIndex: 0,
  zoom: {},
  seenWelcome: false
}

export type SettingsPatch = Partial<Omit<Settings, 'version'>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const asNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function asThemeMode(value: unknown, fallback: ThemeMode): ThemeMode {
  return value === 'SYSTEM' || value === 'LIGHT' || value === 'DARK' ? value : fallback
}

function asContrastMode(value: unknown, fallback: ContrastMode): ContrastMode {
  return value === 'DEFAULT' || value === 'STRONG' ? value : fallback
}

function asFontFamily(value: unknown, fallback: FontFamily): FontFamily {
  return typeof value === 'string' && (FONT_FAMILIES as readonly string[]).includes(value)
    ? (value as FontFamily)
    : fallback
}

function asFontSize(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number.NaN
  return (FONT_SIZES as readonly number[]).includes(numeric) ? numeric : fallback
}

function asWorkspaceId(value: unknown): WorkspaceId | null {
  return isWorkspaceId(value) ? value : null
}

function sanitizeWorkspaceUrls(value: unknown, base: Record<string, string>): Record<string, string> {
  if (!isRecord(value)) return { ...base }
  const output: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!isWorkspaceId(key) || key === 'cloud') continue
    const normalized = normalizeHttpUrl(raw)
    if (normalized.ok) output[key] = normalized.value
  }
  return output
}

function sanitizeLastUrls(value: unknown, base: Record<string, string>): Record<string, string> {
  if (!isRecord(value)) return { ...base }
  const output: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!isWorkspaceId(key) || key === 'cloud' || typeof raw !== 'string') continue
    const clean = stripUrlSecrets(raw)
    if (!clean || clean.length > MAX_T3_URL_LENGTH) continue
    if (!/^https?:\/\//i.test(clean)) continue
    output[key] = clean
  }
  return output
}

function sanitizeIsolated(value: unknown, base: string[]): string[] {
  if (!Array.isArray(value)) return [...base]
  const output = new Set<string>()
  for (const entry of value) {
    if (isWorkspaceId(entry) && entry !== 'cloud') output.add(entry)
  }
  return [...output]
}

function sanitizeTabs(value: unknown, base: BrowserTabSeed[]): BrowserTabSeed[] {
  if (!Array.isArray(value)) return base.map((tab) => ({ ...tab }))
  const output: BrowserTabSeed[] = []
  for (const entry of value.slice(0, 20)) {
    if (!isRecord(entry) || typeof entry.url !== 'string') continue
    const clean = stripUrlSecrets(entry.url)
    if (!clean || clean.length > MAX_T3_URL_LENGTH) continue
    if (!/^https?:\/\//i.test(clean)) continue
    output.push({ url: clean })
  }
  return output.length > 0 ? output : base.map((tab) => ({ ...tab }))
}

function sanitizeZoom(value: unknown, base: Record<string, number>): Record<string, number> {
  if (!isRecord(value)) return { ...base }
  const output: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!isWorkspaceId(key)) continue
    const numeric = typeof raw === 'number' ? raw : Number.NaN
    if (!Number.isFinite(numeric)) continue
    output[key] = Math.round(Math.min(5, Math.max(-5, numeric)) * 2) / 2
  }
  return output
}

function sanitizeBrowserPort(value: unknown, fallback: number): number {
  const numeric = Math.round(asNumber(value, fallback, 1024, 65535))
  return numeric
}

/**
 * Coerces any persisted or IPC-supplied object into a valid Settings value.
 * Unknown keys are discarded; malformed values fall back rather than throw.
 */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const input = isRecord(raw) ? raw : {}
  const merged: Settings = {
    version: 1,
    themeMode: asThemeMode(input.themeMode, base.themeMode),
    presetName:
      isPresetName(input.presetName) && typeof input.presetName === 'string'
        ? input.presetName
        : base.presetName,
    contrastMode: asContrastMode(input.contrastMode, base.contrastMode),
    accentOverride:
      input.accentOverride === null
        ? null
        : typeof input.accentOverride === 'string'
          ? normalizeAccentOverride(input.accentOverride)
          : base.accentOverride,
    fontFamily: asFontFamily(input.fontFamily, base.fontFamily),
    fontSize: asFontSize(input.fontSize, base.fontSize),
    smoothAnimations: asBoolean(input.smoothAnimations, base.smoothAnimations),
    frostedGlass: asBoolean(input.frostedGlass, base.frostedGlass),
    railExpanded: asBoolean(input.railExpanded, base.railExpanded),
    splitRatio: asNumber(input.splitRatio, base.splitRatio, 0.2, 0.8),
    externalLinkBehavior:
      input.externalLinkBehavior === 'pulse-browser' || input.externalLinkBehavior === 'system'
        ? input.externalLinkBehavior
        : base.externalLinkBehavior,
    isolatedWorkspaces: sanitizeIsolated(input.isolatedWorkspaces, base.isolatedWorkspaces),
    workspaceUrls: sanitizeWorkspaceUrls(input.workspaceUrls, base.workspaceUrls),
    lastUrls: sanitizeLastUrls(input.lastUrls, base.lastUrls),
    closeToTray: asBoolean(input.closeToTray, base.closeToTray),
    launchMinimized: asBoolean(input.launchMinimized, base.launchMinimized),
    notificationsEnabled: asBoolean(input.notificationsEnabled, base.notificationsEnabled),
    updateChecks: asBoolean(input.updateChecks, base.updateChecks),
    bridgeEnabled: asBoolean(input.bridgeEnabled, base.bridgeEnabled),
    bridgePort: sanitizeBrowserPort(input.bridgePort, base.bridgePort),
    lastWorkspaceId:
      input.lastWorkspaceId === null ? null : (asWorkspaceId(input.lastWorkspaceId) ?? base.lastWorkspaceId),
    lastSecondaryId:
      input.lastSecondaryId === null
        ? null
        : (asWorkspaceId(input.lastSecondaryId) ?? base.lastSecondaryId),
    browserTabs: sanitizeTabs(input.browserTabs, base.browserTabs),
    browserActiveIndex: Math.round(asNumber(input.browserActiveIndex, base.browserActiveIndex, 0, 19)),
    zoom: sanitizeZoom(input.zoom, base.zoom),
    seenWelcome: asBoolean(input.seenWelcome, base.seenWelcome)
  }

  if (merged.lastSecondaryId && merged.lastSecondaryId === merged.lastWorkspaceId) {
    merged.lastSecondaryId = null
  }
  const activeTab = merged.browserTabs[merged.browserActiveIndex]
  if (!activeTab) merged.browserActiveIndex = 0
  return merged
}

/** Applies a shallow patch and sanitizes the result against the current value. */
export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  if (!isRecord(patch)) return current
  const allowed = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]
  const merged: Record<string, unknown> = { ...current }
  for (const key of allowed) {
    if (key === 'version') continue
    if (Object.prototype.hasOwnProperty.call(patch, key)) merged[key] = patch[key]
  }
  return sanitizeSettings(merged, current)
}

export function settingsPatchFrom(raw: unknown): SettingsPatch | null {
  if (!isRecord(raw)) return null
  return raw as SettingsPatch
}

export function resolveWorkspaceFont(font: FontFamily): string {
  switch (font) {
    case 'Space Grotesk':
      return "'Space Grotesk Variable', 'Space Grotesk', 'Inter Variable', sans-serif"
    case 'JetBrains Mono':
      return "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
    case 'Fira Code':
      return "'Fira Code Variable', 'Fira Code', ui-monospace, monospace"
    case 'Roboto Mono':
      return "'Roboto Mono Variable', 'Roboto Mono', ui-monospace, monospace"
    case 'Google Sans':
      return "'Google Sans', 'Product Sans', 'Inter Variable', 'Inter', sans-serif"
    case 'Inter':
    default:
      return "'Inter Variable', 'Inter', system-ui, sans-serif"
  }
}

export function displayAccent(override: string | null, presetAccent: string): string {
  return normalizeHex(override ?? '') ?? presetAccent
}
