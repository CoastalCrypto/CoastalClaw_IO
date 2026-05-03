// packages/architect/src/patcher.ts
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export class Patcher {
  constructor(private repoRoot: string) {}

  async createBranch(name: string): Promise<void> {
    execFileSync('git', ['checkout', '-b', name], { cwd: this.repoRoot })
  }

  async checkoutMain(): Promise<void> {
    try {
      execFileSync('git', ['checkout', 'master'], { cwd: this.repoRoot })
    } catch {
      // 'master' branch not found; try 'main' (git default varies by version)
      execFileSync('git', ['checkout', 'main'], { cwd: this.repoRoot })
    }
  }

  async applyDiff(diff: string): Promise<void> {
    const tmpFile = join(tmpdir(), `architect-${randomBytes(4).toString('hex')}.patch`)
    writeFileSync(tmpFile, diff)
    try {
      execFileSync('git', ['apply', '--whitespace=nowarn', tmpFile], { cwd: this.repoRoot })
    } finally {
      if (existsSync(tmpFile)) unlinkSync(tmpFile)
    }
  }

  async applyMultiFileDiff(diff: string): Promise<void> {
    return this.applyDiff(diff)
  }

  async commitChange(message: string): Promise<void> {
    execFileSync('git', ['add', '-A'], { cwd: this.repoRoot })
    execFileSync('git', ['commit', '-m', message], { cwd: this.repoRoot })
  }

  async deleteBranch(name: string): Promise<void> {
    execFileSync('git', ['branch', '-D', name], { cwd: this.repoRoot })
  }

  async mergeBranch(name: string): Promise<void> {
    execFileSync('git', [
      'merge', '--no-ff', name,
      '-m', `chore(architect): merge self-improvement branch ${name}`,
    ], { cwd: this.repoRoot })
  }

  currentBranch(): string {
    return execFileSync('git', ['branch', '--show-current'], { cwd: this.repoRoot, encoding: 'utf8' }).trim()
  }

  async pushBranch(branchName: string): Promise<void> {
    execFileSync('git', ['push', '-u', 'origin', branchName], { cwd: this.repoRoot, stdio: 'pipe' })
  }

  branchExistsOnRemote(branchName: string): boolean {
    try {
      const result = execFileSync('git', ['ls-remote', '--heads', 'origin', branchName], {
        cwd: this.repoRoot, encoding: 'utf8', stdio: 'pipe',
      })
      return result.trim().length > 0
    } catch {
      return false
    }
  }
}
