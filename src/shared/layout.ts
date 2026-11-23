/** Pure geometry used by the main-process Workspace Host and Vitest. */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const TITLEBAR_HEIGHT = 36
export const RAIL_COLLAPSED_WIDTH = 56
export const RAIL_EXPANDED_WIDTH = 220
export const BROWSER_CHROME_HEIGHT = 72
export const SPLIT_GAP = 8
export const MIN_PANE_WIDTH = 360

export interface WorkspaceLayoutInput {
  windowWidth: number
  windowHeight: number
  railWidth: number
  titlebarHeight?: number
  browserChromeHeight?: number
  split?: boolean
  ratio?: number
  zen?: boolean
}

export interface WorkspaceLayout {
  railWidth: number
  primary: Rect
  secondary: Rect | null
  divider: Rect | null
  split: boolean
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const finite = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback)

export function clampSplitRatio(
  ratio: number,
  contentWidth: number,
  gap: number = SPLIT_GAP,
  minPane: number = MIN_PANE_WIDTH
): number {
  const usable = contentWidth - gap
  if (usable <= 0) return 0.5
  const minimum = minPane / usable
  if (minimum >= 0.5) return 0.5
  return clamp(finite(ratio, 0.5), minimum, 1 - minimum)
}

export function computeWorkspaceLayout(input: WorkspaceLayoutInput): WorkspaceLayout {
  const zen = input.zen === true
  const titlebarHeight = zen ? 0 : Math.max(0, finite(input.titlebarHeight ?? TITLEBAR_HEIGHT, TITLEBAR_HEIGHT))
  const browserChromeHeight = Math.max(0, finite(input.browserChromeHeight ?? 0, 0))
  const railWidth = zen ? 0 : Math.max(0, finite(input.railWidth, RAIL_COLLAPSED_WIDTH))
  const windowWidth = Math.max(0, finite(input.windowWidth, 0))
  const windowHeight = Math.max(0, finite(input.windowHeight, 0))

  const x = Math.min(railWidth, windowWidth)
  const y = Math.min(titlebarHeight + browserChromeHeight, windowHeight)
  const width = Math.max(0, windowWidth - x)
  const height = Math.max(0, windowHeight - y)

  const empty: Rect = { x, y, width: 0, height: 0 }
  if (width === 0 || height === 0) {
    return { railWidth, primary: empty, secondary: null, divider: null, split: false }
  }

  const wantsSplit = input.split === true
  const canSplit = width >= MIN_PANE_WIDTH * 2 + SPLIT_GAP
  if (!wantsSplit || !canSplit) {
    return { railWidth, primary: { x, y, width, height }, secondary: null, divider: null, split: false }
  }

  const ratio = clampSplitRatio(input.ratio ?? 0.5, width)
  const usable = width - SPLIT_GAP
  const leftWidth = Math.round(usable * ratio)
  const rightWidth = usable - leftWidth
  return {
    railWidth,
    primary: { x, y, width: leftWidth, height },
    secondary: { x: x + leftWidth + SPLIT_GAP, y, width: rightWidth, height },
    divider: { x: x + leftWidth, y, width: SPLIT_GAP, height },
    split: true
  }
}

/** Rect for renderer-drawn chrome when a modal must float above web views. */
export function contentAreaRect(
  windowWidth: number,
  windowHeight: number,
  railWidth: number,
  titlebarHeight: number = TITLEBAR_HEIGHT
): Rect {
  return computeWorkspaceLayout({
    windowWidth,
    windowHeight,
    railWidth,
    titlebarHeight
  }).primary
}
