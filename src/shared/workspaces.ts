/** The nine pinned workspaces, shared by main, preload, and the renderer. */

export type WorkspaceId =
  | 'antigravity'
  | 't3'
  | 'aistudio'
  | 'gemini'
  | 'github'
  | 'vercel'
  | 'supabase'
  | 'browser'
  | 'cloud'

export type WorkspaceIcon =
  | 'orbit'
  | 'terminal'
  | 'sparkles'
  | 'gemini'
  | 'github'
  | 'triangle'
  | 'database'
  | 'compass'
  | 'cloud'

export interface WorkspaceDefinition {
  id: WorkspaceId
  name: string
  shortName: string
  description: string
  url: string
  icon: WorkspaceIcon
  shortcut: string
  actionShortcut?: string
  actionLabel?: string
  kind: 'web' | 'native'
  /** Browser chrome (tab strip + address bar) is drawn above this workspace. */
  browserChrome?: boolean
}

export const WORKSPACES: readonly WorkspaceDefinition[] = [
  {
    id: 'antigravity',
    name: 'Antigravity Remote',
    shortName: 'Remote',
    description: 'Your Google Antigravity agent host, pinned and warm.',
    url: 'https://antigravity.google.com/',
    icon: 'orbit',
    shortcut: 'Ctrl+1',
    actionShortcut: 'Ctrl+Shift+O',
    actionLabel: 'Open Antigravity Remote',
    kind: 'web'
  },
  {
    id: 't3',
    name: 'T3 Code Web',
    shortName: 'T3 Code',
    description: 'Cloud or paired T3 Code sessions with token handshakes kept in RAM.',
    url: 'https://app.t3.codes/',
    icon: 'terminal',
    shortcut: 'Ctrl+2',
    actionShortcut: 'Ctrl+Shift+T',
    actionLabel: 'Open T3 pairing link',
    kind: 'web'
  },
  {
    id: 'aistudio',
    name: 'Google AI Studio',
    shortName: 'AI Studio',
    description: 'Prompts, models, and live streams without a tab reload.',
    url: 'https://aistudio.google.com/',
    icon: 'sparkles',
    shortcut: 'Ctrl+3',
    actionShortcut: 'Ctrl+Shift+A',
    actionLabel: 'New AI Studio prompt',
    kind: 'web'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    shortName: 'Gemini',
    description: 'A persistent Gemini thread, always one shortcut away.',
    url: 'https://gemini.google.com/app',
    icon: 'gemini',
    shortcut: 'Ctrl+4',
    actionShortcut: 'Ctrl+Shift+G',
    actionLabel: 'New Gemini chat',
    kind: 'web'
  },
  {
    id: 'github',
    name: 'GitHub',
    shortName: 'GitHub',
    description: 'Repos, reviews, and Actions for IceCool30.',
    url: 'https://github.com/',
    icon: 'github',
    shortcut: 'Ctrl+5',
    actionShortcut: 'Ctrl+Shift+H',
    actionLabel: 'GitHub notifications',
    kind: 'web'
  },
  {
    id: 'vercel',
    name: 'Vercel',
    shortName: 'Vercel',
    description: 'Deployments live, with the dashboard already signed in.',
    url: 'https://vercel.com/dashboard',
    icon: 'triangle',
    shortcut: 'Ctrl+6',
    actionShortcut: 'Ctrl+Shift+V',
    actionLabel: 'New Vercel project',
    kind: 'web'
  },
  {
    id: 'supabase',
    name: 'Supabase',
    shortName: 'Supabase',
    description: 'Projects, SQL, and auth logs in your shared session.',
    url: 'https://supabase.com/dashboard',
    icon: 'database',
    shortcut: 'Ctrl+7',
    actionShortcut: 'Ctrl+Shift+S',
    actionLabel: 'Supabase projects',
    kind: 'web'
  },
  {
    id: 'browser',
    name: 'Pulse Browser',
    shortName: 'Pulse',
    description: 'A focused multi-tab browser with the same persistent session.',
    url: 'https://www.google.com/',
    icon: 'compass',
    shortcut: 'Ctrl+8',
    actionShortcut: 'Ctrl+T',
    actionLabel: 'New Pulse Browser tab',
    kind: 'web',
    browserChrome: true
  },
  {
    id: 'cloud',
    name: 'Cloud Sync & Phone Companion',
    shortName: 'Cloud Sync',
    description: 'Google sign-in, Firestore parity, and the local phone bridge.',
    url: 'pulse://cloud',
    icon: 'cloud',
    shortcut: 'Ctrl+9',
    actionShortcut: 'Ctrl+Shift+P',
    actionLabel: 'Phone Companion',
    kind: 'native'
  }
]

export const WORKSPACE_IDS = WORKSPACES.map((workspace) => workspace.id) as readonly WorkspaceId[]

export function isWorkspaceId(value: unknown): value is WorkspaceId {
  return typeof value === 'string' && (WORKSPACE_IDS as readonly string[]).includes(value)
}

export function getWorkspace(id: WorkspaceId): WorkspaceDefinition {
  const workspace = WORKSPACES.find((candidate) => candidate.id === id)
  if (!workspace) throw new Error(`Unknown workspace: ${id}`)
  return workspace
}

export function shortcutIndexFromDigit(digit: string): WorkspaceId | null {
  if (!/^[1-9]$/.test(digit)) return null
  return WORKSPACE_IDS[Number.parseInt(digit, 10) - 1] ?? null
}

/** URL used for a workspace's first load, honoring a user override. */
export function workspaceUrl(id: WorkspaceId, overrides: Record<string, string> = {}): string {
  const override = overrides[id]
  if (override && override.trim()) return override
  return getWorkspace(id).url
}

/** Fast action URLs reachable through Ctrl+Shift+* shortcuts. */
export const WORKSPACE_ACTIONS: Record<
  WorkspaceId,
  { label: string; shortcut: string; url?: string }
> = {
  antigravity: { label: 'Open Antigravity Remote', shortcut: 'Ctrl+Shift+O' },
  t3: { label: 'Open T3 pairing link', shortcut: 'Ctrl+Shift+T' },
  aistudio: {
    label: 'New AI Studio prompt',
    shortcut: 'Ctrl+Shift+A',
    url: 'https://aistudio.google.com/prompts/new_chat'
  },
  gemini: { label: 'New Gemini chat', shortcut: 'Ctrl+Shift+G', url: 'https://gemini.google.com/app' },
  github: {
    label: 'GitHub notifications',
    shortcut: 'Ctrl+Shift+H',
    url: 'https://github.com/notifications'
  },
  vercel: { label: 'New Vercel project', shortcut: 'Ctrl+Shift+V', url: 'https://vercel.com/new' },
  supabase: {
    label: 'Supabase projects',
    shortcut: 'Ctrl+Shift+S',
    url: 'https://supabase.com/dashboard/projects'
  },
  browser: { label: 'New Pulse Browser tab', shortcut: 'Ctrl+T' },
  cloud: { label: 'Phone Companion', shortcut: 'Ctrl+Shift+P' }
}

export const DEVELOPER = {
  name: 'Solomon Bukie',
  email: 'solomonogarbukie@gmail.com',
  github: 'IceCool30',
  githubUrl: 'https://github.com/IceCool30',
  repoUrl: 'https://github.com/IceCool30/Antigravity-Pulse-Desktop'
} as const
