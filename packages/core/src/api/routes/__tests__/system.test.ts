import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('restartServer', () => {
  // vi.resetModules() ensures each test gets a fresh module instance
  // with its own set of mocks — prevents cache bleeding between win32/linux tests
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('spawns a detached cmd.exe on win32 instead of calling systemctl', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const spawnMock = vi.fn().mockReturnValue({ unref: vi.fn() })
    vi.doMock('node:child_process', () => ({ execSync: vi.fn(), spawn: spawnMock }))
    vi.doMock('node:fs', () => ({ writeFileSync: vi.fn() }))
    vi.doMock('node:os', () => ({ tmpdir: () => '/tmp' }))
    vi.doMock('node:path', () => ({ join: (...p: string[]) => p.join('/') }))

    const { restartServer } = await import('../system-restart.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    restartServer('/install/dir')

    expect(spawnMock).toHaveBeenCalledWith(
      'cmd.exe',
      expect.arrayContaining(['/c', expect.stringContaining('coastal-ai-restart.cmd')]),
      expect.objectContaining({ detached: true }),
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('calls systemctl on linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    const execSyncMock = vi.fn()
    vi.doMock('node:child_process', () => ({ execSync: execSyncMock, spawn: vi.fn() }))
    vi.doMock('node:fs', () => ({ writeFileSync: vi.fn() }))
    vi.doMock('node:os', () => ({ tmpdir: () => '/tmp' }))
    vi.doMock('node:path', () => ({ join: (...p: string[]) => p.join('/') }))

    const { restartServer } = await import('../system-restart.js')

    restartServer('/install/dir')

    expect(execSyncMock).toHaveBeenCalledWith(
      'systemctl restart coastal-ai-server',
      expect.objectContaining({ timeout: 10_000 }),
    )
  })
})
