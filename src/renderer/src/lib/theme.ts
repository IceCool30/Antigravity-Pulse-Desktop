import type { ResolvedTheme } from '@shared/theme'
import { resolveWorkspaceFont, type Settings } from '@shared/settings'

/**
 * Writes the resolved theme onto document.documentElement as CSS custom
 * properties. styles.css maps these into Tailwind tokens, so the whole UI
 * re-themes without a remount.
 */
export function applyTheme(theme: ResolvedTheme, settings: Settings): void {
  const root = document.documentElement
  const vars: Record<string, string> = {
    '--bg': theme.background,
    '--surface': theme.surface,
    '--surface-elevated': theme.surfaceElevated,
    '--surface-hover': theme.surfaceHover,
    '--fg': theme.foreground,
    '--muted': theme.muted,
    '--accent': theme.accent,
    '--accent-raw': theme.accentRaw,
    '--accent-soft': theme.accentSoft,
    '--on-accent': theme.onAccent,
    '--border': theme.border,
    '--border-strong': theme.borderStrong,
    '--glass': theme.glass,
    '--glass-highlight': theme.isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.06)',
    '--status-online': theme.statusOnline,
    '--status-error': theme.statusError,
    '--status-warning': theme.statusWarning,
    '--ai-accent': theme.aiAccent,
    '--shadow': theme.shadow,
    '--shadow-soft': theme.isLight ? '0 10px 30px rgba(15, 23, 42, 0.08)' : '0 10px 30px rgba(0, 0, 0, 0.35)',
    '--font-ui': resolveWorkspaceFont(settings.fontFamily),
    '--app-font-size': `${settings.fontSize}px`
  }
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
  root.style.colorScheme = theme.isLight ? 'light' : 'dark'
  root.dataset.theme = theme.isLight ? 'light' : 'dark'
  root.dataset.frosted = settings.frostedGlass ? 'true' : 'false'
  if (settings.smoothAnimations) {
    delete root.dataset.reducedMotion
  } else {
    root.dataset.reducedMotion = 'true'
  }
}

/** Observes the OS color scheme for SYSTEM theme mode. Returns a cleanup fn. */
export function watchSystemDark(callback: (prefersDark: boolean) => void): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  callback(query.matches)
  const handler = (event: MediaQueryListEvent): void => callback(event.matches)
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}
