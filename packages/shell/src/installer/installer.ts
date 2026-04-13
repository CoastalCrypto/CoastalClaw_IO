import { ipcMain, shell } from 'electron'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { BrowserWindow } from 'electron'

const execAsync = promisify(exec)

export type InstallerStep =
  | { id: 'node';   label: 'Checking Node.js';    status: 'pending' | 'ok' | 'error'; detail?: string }
  | { id: 'pnpm';   label: 'Checking pnpm';        status: 'pending' | 'ok' | 'error'; detail?: string }
  | { id: 'ollama'; label: 'Checking Ollama';       status: 'pending' | 'ok' | 'error'; detail?: string }
  | { id: 'model';  label: 'Pulling default model'; status: 'pending' | 'ok' | 'error' | 'progress'; detail?: string; progress?: number }
  | { id: 'launch'; label: 'Starting Coastal.AI';   status: 'pending' | 'ok' | 'error'; detail?: string }

export function registerInstallerHandlers(win: BrowserWindow): void {
  ipcMain.handle('installer:check', async () => {
    const steps: InstallerStep[] = []

    // Node check
    try {
      const { stdout } = await execAsync('node --version')
      const major = parseInt(stdout.trim().replace('v', '').split('.')[0], 10)
      steps.push({ id: 'node', label: 'Checking Node.js', status: major >= 22 ? 'ok' : 'error', detail: stdout.trim() })
    } catch {
      steps.push({ id: 'node', label: 'Checking Node.js', status: 'error', detail: 'Not found' })
    }

    // pnpm check
    try {
      const { stdout } = await execAsync('pnpm --version')
      steps.push({ id: 'pnpm', label: 'Checking pnpm', status: 'ok', detail: `v${stdout.trim()}` })
    } catch {
      steps.push({ id: 'pnpm', label: 'Checking pnpm', status: 'error', detail: 'Not found — run: npm i -g pnpm' })
    }

    // Ollama check
    try {
      const { stdout } = await execAsync('ollama --version')
      steps.push({ id: 'ollama', label: 'Checking Ollama', status: 'ok', detail: stdout.trim() })
    } catch {
      steps.push({ id: 'ollama', label: 'Checking Ollama', status: 'error', detail: 'Not found — install from ollama.com' })
    }

    return steps
  })

  ipcMain.handle('installer:pull-model', async (_e, modelName: string) => {
    return new Promise<void>((resolve, reject) => {
      const proc = execFile('ollama', ['pull', modelName], (err) => {
        if (err) reject(err.message)
        else resolve()
      })
      proc.stdout?.on('data', (chunk: Buffer) => {
        win.webContents.send('installer:pull-progress', chunk.toString())
      })
    })
  })

  ipcMain.handle('installer:open-browser', async (_e, url: string) => {
    await shell.openExternal(url)
  })
}
