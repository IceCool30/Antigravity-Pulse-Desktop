import { describe, expect, it } from 'vitest'
import {
  BROWSER_CHROME_HEIGHT,
  MIN_PANE_WIDTH,
  RAIL_COLLAPSED_WIDTH,
  SPLIT_GAP,
  TITLEBAR_HEIGHT,
  clampSplitRatio,
  computeWorkspaceLayout,
  contentAreaRect
} from '../src/shared/layout'

const windowSize = { windowWidth: 1440, windowHeight: 900 }

describe('workspace bounds', () => {
  it('places a single workspace below the titlebar and beside the rail', () => {
    const layout = computeWorkspaceLayout({
      ...windowSize,
      railWidth: RAIL_COLLAPSED_WIDTH,
      split: false
    })
    expect(layout.primary).toEqual({
      x: 56,
      y: 36,
      width: 1384,
      height: 864
    })
    expect(layout.secondary).toBeNull()
    expect(layout.divider).toBeNull()
    expect(layout.split).toBe(false)
  })

  it('reserves browser chrome above the page', () => {
    const layout = computeWorkspaceLayout({
      ...windowSize,
      railWidth: 56,
      browserChromeHeight: BROWSER_CHROME_HEIGHT
    })
    expect(layout.primary).toEqual({
      x: 56,
      y: TITLEBAR_HEIGHT + BROWSER_CHROME_HEIGHT,
      width: 1384,
      height: 792
    })
  })

  it('removes titlebar and rail in Zen mode', () => {
    const layout = computeWorkspaceLayout({
      ...windowSize,
      railWidth: 220,
      zen: true
    })
    expect(layout.railWidth).toBe(0)
    expect(layout.primary).toEqual({ x: 0, y: 0, width: 1440, height: 900 })
  })

  it('never produces negative rects for tiny or zero-sized windows', () => {
    const empty = computeWorkspaceLayout({
      windowWidth: 0,
      windowHeight: 0,
      railWidth: 56
    })
    expect(empty.primary).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(empty.split).toBe(false)

    const tiny = computeWorkspaceLayout({
      windowWidth: 40,
      windowHeight: 20,
      railWidth: 56,
      split: true
    })
    expect(tiny.primary.width).toBe(0)
    expect(tiny.primary.height).toBe(0)
    expect(tiny.split).toBe(false)
  })
})

describe('split geometry', () => {
  it('splits with an 8px gutter and symmetric panes at 50%', () => {
    const layout = computeWorkspaceLayout({
      ...windowSize,
      railWidth: 56,
      split: true,
      ratio: 0.5
    })
    expect(layout.split).toBe(true)
    expect(layout.primary).toEqual({ x: 56, y: 36, width: 688, height: 864 })
    expect(layout.divider).toEqual({ x: 744, y: 36, width: SPLIT_GAP, height: 864 })
    expect(layout.secondary).toEqual({ x: 752, y: 36, width: 688, height: 864 })
  })

  it('clamps the ratio so each pane keeps at least 360px', () => {
    const usable = 1384 - SPLIT_GAP
    const minimum = MIN_PANE_WIDTH / usable
    const layout = computeWorkspaceLayout({
      ...windowSize,
      railWidth: 56,
      split: true,
      ratio: 0.99
    })
    expect(layout.primary.width).toBeGreaterThanOrEqual(MIN_PANE_WIDTH)
    expect(layout.secondary?.width).toBeGreaterThanOrEqual(MIN_PANE_WIDTH)
    expect(layout.primary.width).toBe(Math.round(usable * (1 - minimum)))
    expect(clampSplitRatio(0.99, 1384)).toBeCloseTo(1 - minimum, 6)
  })

  it('refuses to split when the window is too narrow', () => {
    const layout = computeWorkspaceLayout({
      windowWidth: 700,
      windowHeight: 800,
      railWidth: 56,
      split: true,
      ratio: 0.5
    })
    expect(layout.split).toBe(false)
    expect(layout.secondary).toBeNull()
    expect(layout.primary.width).toBe(644)
    expect(clampSplitRatio(0.5, 700)).toBe(0.5)
  })

  it('centers the divider relative to the right pane edge', () => {
    const layout = computeWorkspaceLayout({
      ...windowSize,
      railWidth: 56,
      split: true,
      ratio: 0.6
    })
    expect(layout.divider).not.toBeNull()
    const divider = layout.divider!
    const secondary = layout.secondary!
    expect(divider.x + divider.width).toBe(secondary.x)
    expect(secondary.x + secondary.width).toBe(1440)
    expect(layout.primary.width + SPLIT_GAP + secondary.width).toBe(1384)
  })
})

describe('content area helper', () => {
  it('matches the primary bounds of a single-pane layout', () => {
    expect(contentAreaRect(1440, 900, 56)).toEqual({
      x: 56,
      y: 36,
      width: 1384,
      height: 864
    })
  })
})
