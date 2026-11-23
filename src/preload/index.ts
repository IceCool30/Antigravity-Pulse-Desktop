import { contextBridge, ipcRenderer } from 'electron'
import type { CommandChannel, CommandMap, PreloadApi, PulseEvent } from '@shared/ipc'

const api: PreloadApi = {
  invoke<K extends CommandChannel>(
    channel: K,
    payload: CommandMap[K]['req']
  ): Promise<CommandMap[K]['res']> {
    return ipcRenderer.invoke(channel, payload) as Promise<CommandMap[K]['res']>
  },
  onEvent(listener: (event: PulseEvent) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, event: PulseEvent): void => {
      listener(event)
    }
    ipcRenderer.on('pulse:event', handler)
    return () => {
      ipcRenderer.removeListener('pulse:event', handler)
    }
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('pulse', api)
