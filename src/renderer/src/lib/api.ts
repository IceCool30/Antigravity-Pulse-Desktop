import type { CommandChannel, CommandMap, PulseEvent } from '@shared/ipc'

/** True when the preload bridge is available (false in a plain browser tab). */
export function hasPulseApi(): boolean {
  return typeof window !== 'undefined' && typeof window.pulse?.invoke === 'function'
}

/** Typed, promise-based IPC invoke. Errors reject with human-readable messages. */
export function invoke<K extends CommandChannel>(
  channel: K,
  payload: CommandMap[K]['req']
): Promise<CommandMap[K]['res']> {
  return window.pulse.invoke(channel, payload)
}

export function subscribeEvents(listener: (event: PulseEvent) => void): () => void {
  return window.pulse.onEvent(listener)
}

/** Strips Electron's IPC wrapper so toasts show the router's human message. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
      .replace(/^Error invoking remote method '[^']*':\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim() || 'Something went wrong.'
  }
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Something went wrong.'
}
