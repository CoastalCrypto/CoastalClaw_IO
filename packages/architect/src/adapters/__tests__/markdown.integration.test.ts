import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { WorkItemStore } from '@coastal-ai/core/architect/store'
import { startMarkdownAdapter } from '../markdown.js'

let tempDir: string
let db: Database.Database
let store: WorkItemStore
let stopAdapter: (() => void) | undefined

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-md-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  store = new WorkItemStore(db)
  stopAdapter = undefined
})

afterEach(() => {
  // Stop the watcher BEFORE closing db / rm tempDir to avoid Windows
  // file-handle race (fs.watch keeps a handle on the file).
  if (stopAdapter) stopAdapter()
  if (db && db.open) db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('markdown adapter watcher', () => {
  it('inserts items from initial file, then on edit', async () => {
    const filePath = join(tempDir, 'queue.md')
    writeFileSync(filePath, '## A\nbody a\n')
    const { stop } = startMarkdownAdapter({ store, filePath })
    stopAdapter = stop
    expect(store.listPending().map(i => i.title)).toEqual(['A'])

    writeFileSync(filePath, '## A\nbody a\n\n## B\nbody b\n')
    await new Promise(r => setTimeout(r, 2200))
    expect(store.listPending().map(i => i.title).sort()).toEqual(['A', 'B'])
  })

  it('does not duplicate on identical content rewrite', async () => {
    const filePath = join(tempDir, 'queue.md')
    writeFileSync(filePath, '## X\nbody\n')
    const { stop } = startMarkdownAdapter({ store, filePath })
    stopAdapter = stop
    writeFileSync(filePath, '## X\nbody\n')
    await new Promise(r => setTimeout(r, 2200))
    expect(store.listPending()).toHaveLength(1)
  })
})
