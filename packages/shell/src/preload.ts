// packages/shell/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('coastalShell', {
  platform: process.platform,
  onNotification: (cb: (msg: string) => void) =>
    ipcRenderer.on('notification', (_e, msg: string) => cb(msg)),
})
