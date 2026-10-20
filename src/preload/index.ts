import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Bridge, RepoChangedEvent } from '../shared/types'

const bridge: Bridge = {
  invoke: (method, args) => ipcRenderer.invoke('codyken:api', method, args),
  onRepoChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: RepoChangedEvent): void => callback(payload)
    ipcRenderer.on('codyken:repo-changed', listener)
    return () => ipcRenderer.removeListener('codyken:repo-changed', listener)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('codyken', bridge)
