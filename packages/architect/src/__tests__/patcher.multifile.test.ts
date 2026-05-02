import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { Patcher } from '../patcher.js'

let tempRepo: string

beforeEach(() => {
  tempRepo = mkdtempSync(join(tmpdir(), 'arch-patch-'))
  execSync('git init -q && git config user.email a@b && git config user.name x', { cwd: tempRepo })
  writeFileSync(join(tempRepo, 'a.txt'), 'A1\n')
  writeFileSync(join(tempRepo, 'b.txt'), 'B1\n')
  execSync('git add . && git commit -qm initial', { cwd: tempRepo })
})

afterEach(() => { rmSync(tempRepo, { recursive: true, force: true }) })

describe('applyMultiFileDiff', () => {
  it('applies a diff that touches two files', async () => {
    const diff = `--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-A1
+A2
--- a/b.txt
+++ b/b.txt
@@ -1 +1 @@
-B1
+B2
`
    const patcher = new Patcher(tempRepo)
    await patcher.applyMultiFileDiff(diff)
    expect(readFileSync(join(tempRepo, 'a.txt'), 'utf8').replace(/\r\n/g, '\n')).toBe('A2\n')
    expect(readFileSync(join(tempRepo, 'b.txt'), 'utf8').replace(/\r\n/g, '\n')).toBe('B2\n')
  })

  it('throws when diff does not apply cleanly', async () => {
    const diff = `--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-NOT_THE_REAL_CONTENT
+X
`
    const patcher = new Patcher(tempRepo)
    await expect(patcher.applyMultiFileDiff(diff)).rejects.toThrow()
  })
})
