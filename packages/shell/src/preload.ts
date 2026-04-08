// packages/shell/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('coastalShell', {
  platform: process.platform,
  isElectron: true,
  minimize:  () => ipcRenderer.send('window:minimize'),
  maximize:  () => ipcRenderer.send('window:maximize'),
  close:     () => ipcRenderer.send('window:close'),
  onNotification: (cb: (msg: string) => void) =>
    ipcRenderer.on('notification', (_e, msg: string) => cb(msg)),
  onUpdateAvailable: (cb: (info: { version: string }) => void) =>
    ipcRenderer.on('update:available', (_e, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('update:install'),
})
