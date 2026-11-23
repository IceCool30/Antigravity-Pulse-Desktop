import { useEffect, useState } from 'react'

export interface WindowSize {
  width: number
  height: number
}

/** Live window content size; matches BrowserWindow.getContentSize() in main. */
export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))
  useEffect(() => {
    const onResize = (): void => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}
