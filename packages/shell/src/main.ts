// packages/shell/src/main.ts
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { registerInstallerHandlers } from './installer/installer'

const isDev = process.env.CC_DEV === '1'
const UI_URL = isDev ? 'http://localhost:5173' : (process.env.CC_SERVER_URL ?? 'http://localhost:4747')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#050d1a',
    show: false,
  })

  // In dev, open DevTools
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // Retry loading until Vite dev server is ready
  const load = () => {
    mainWindow?.loadURL(UI_URL).catch(() => {
      setTimeout(load, 500)
    })
  }
  load()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => { mainWindow = null })

  registerInstallerHandlers(mainWindow)
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Coastal.AI')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show',   click: () => mainWindow?.show() },
    { label: 'Reload', click: () => mainWindow?.webContents.reload() },
    { type: 'separator' },
    { label: 'Quit',   click: () => app.quit() },
  ]))
  tray.on('double-click', () => mainWindow?.show())
}

// Window controls via IPC (since frame: false)
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

app.whenReady().then(() => {
  createWindow()
  createTray()
  app.on('activate', () => { if (!mainWindow) createWindow() })

  if (!isDev) {
    autoUpdater.checkForUpdates().catch(() => {})

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update:available', { version: info.version })
    })

    autoUpdater.on('update-downloaded', () => {
      ipcMain.once('update:install', () => {
        autoUpdater.quitAndInstall()
      })
    })

    // Recheck every 4 hours
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1_000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
