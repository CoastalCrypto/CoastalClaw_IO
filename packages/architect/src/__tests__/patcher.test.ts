// packages/architect/src/__tests__/patcher.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { Patcher } from '../patcher.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'architect-test-'))
  execSync('git init', { cwd: tmpDir })
  execSync('git config user.email "test@test.com"', { cwd: tmpDir })
  execSync('git config user.name "Test"', { cwd: tmpDir })
  writeFileSync(join(tmpDir, 'hello.ts'), 'export function hello() { return "world" }\n')
  execSync('git add .', { cwd: tmpDir })
  execSync('git commit -m "init"', { cwd: tmpDir })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('Patcher', () => {
  it('creates a branch and applies a valid diff', async () => {
    const patcher = new Patcher(tmpDir)
    const branchName = 'feature/self-improve-test'
    const diff = `--- a/hello.ts\n+++ b/hello.ts\n@@ -1 +1 @@\n-export function hello() { return "world" }\n+export function hello() { return "coastal" }\n`
    await patcher.createBranch(branchName)
    await patcher.applyDiff(diff)
    await patcher.commitChange('feat: improve hello')
    const content = readFileSync(join(tmpDir, 'hello.ts'), 'utf8')
    expect(content).toContain('coastal')
  })

  it('deleteBranch removes the branch', async () => {
    const patcher = new Patcher(tmpDir)
    await patcher.createBranch('feature/to-delete')
    await patcher.checkoutMain()
    await patcher.deleteBranch('feature/to-delete')
    const branches = execSync('git branch', { cwd: tmpDir }).toString()
    expect(branches).not.toContain('to-delete')
  })

  it('mergeBranch fast-forwards with --no-ff', async () => {
    const patcher = new Patcher(tmpDir)
    const branchName = 'feature/merge-test'
    const diff = `--- a/hello.ts\n+++ b/hello.ts\n@@ -1 +1 @@\n-export function hello() { return "world" }\n+export function hello() { return "merged" }\n`
    await patcher.createBranch(branchName)
    await patcher.applyDiff(diff)
    await patcher.commitChange('feat: merge test')
    await patcher.checkoutMain()
    await patcher.mergeBranch(branchName)
    const content = readFileSync(join(tmpDir, 'hello.ts'), 'utf8')
    expect(content).toContain('merged')
  })
})
