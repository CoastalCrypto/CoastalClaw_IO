import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { WorkItemStore } from '@coastal-ai/core/architect/store'
import { startSkillMdAdapter } from '../skill-md.js'

let tempDir: string
let skillsDir: string
let db: Database.Database
let store: WorkItemStore
let stopAdapter: (() => void) | undefined

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-skill-'))
  skillsDir = join(tempDir, 'skills')
  mkdirSync(skillsDir, { recursive: true })
  db = openArchitectDb(join(tempDir, 'architect.db'))
  store = new WorkItemStore(db)
  stopAdapter = undefined
})

afterEach(() => {
  // Stop the watcher BEFORE closing db / rm tempDir to avoid Windows
  // file-handle race (fs.watch keeps a handle on the directory).
  if (stopAdapter) stopAdapter()
  if (db && db.open) db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('startSkillMdAdapter', () => {
  it('inserts a work item per .md file in the directory', () => {
    writeFileSync(join(skillsDir, 'a.md'), '---\nname: A\ndescription: d\n---\nbody a\n')
    writeFileSync(join(skillsDir, 'b.md'), '---\nname: B\ndescription: d\n---\nbody b\n')
    const { stop } = startSkillMdAdapter({ store, dirPath: skillsDir })
    stopAdapter = stop
    const titles = store.listPending().map(i => i.title).sort()
    expect(titles).toEqual(['A', 'B'])
  })

  it('skips files with invalid frontmatter (logs but does not throw)', () => {
    writeFileSync(join(skillsDir, 'bad.md'), '# no frontmatter\n')
    writeFileSync(join(skillsDir, 'good.md'), '---\nname: G\ndescription: d\n---\n')
    const logs: string[] = []
    const { stop } = startSkillMdAdapter({ store, dirPath: skillsDir, log: (m) => logs.push(m) })
    stopAdapter = stop
    expect(store.listPending().map(i => i.title)).toEqual(['G'])
    expect(logs.some(l => l.includes('bad.md') && l.includes('frontmatter'))).toBe(true)
  })
})
