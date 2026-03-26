import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileTools } from '../file.js'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'cc-file-')) })
afterEach(() => rmSync(tmpDir, { recursive: true }))

describe('fileTools', () => {
  it('read_file returns file contents', async () => {
    writeFileSync(join(tmpDir, 'test.txt'), 'hello world')
    const exec = fileTools.find(t => t.definition.name === 'read_file')!.execute
    const result = await exec({ path: join(tmpDir, 'test.txt') })
    expect(result).toBe('hello world')
  })

  it('write_file creates file with content', async () => {
    const exec = fileTools.find(t => t.definition.name === 'write_file')!.execute
    await exec({ path: join(tmpDir, 'new.txt'), content: 'written' })
    const { readFileSync } = await import('node:fs')
    expect(readFileSync(join(tmpDir, 'new.txt'), 'utf8')).toBe('written')
  })

  it('list_dir returns directory entries', async () => {
    writeFileSync(join(tmpDir, 'a.txt'), '')
    writeFileSync(join(tmpDir, 'b.txt'), '')
    const exec = fileTools.find(t => t.definition.name === 'list_dir')!.execute
    const result = await exec({ path: tmpDir })
    expect(result).toContain('a.txt')
    expect(result).toContain('b.txt')
  })

  it('delete_file removes a file', async () => {
    writeFileSync(join(tmpDir, 'del.txt'), 'x')
    const exec = fileTools.find(t => t.definition.name === 'delete_file')!.execute
    await exec({ path: join(tmpDir, 'del.txt') })
    const { existsSync } = await import('node:fs')
    expect(existsSync(join(tmpDir, 'del.txt'))).toBe(false)
  })

  it('read_file returns error string for missing file', async () => {
    const exec = fileTools.find(t => t.definition.name === 'read_file')!.execute
    const result = await exec({ path: '/nonexistent/file.txt' })
    expect(result).toContain('Error')
  })
})
