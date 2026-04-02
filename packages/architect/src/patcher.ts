// packages/architect/src/patcher.ts
import { execSync, execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export class Patcher {
  constructor(private repoRoot: string) {}

  private exec(cmd: string): string {
    return execSync(cmd, { cwd: this.repoRoot, encoding: 'utf8' })
  }

  async createBranch(name: string): Promise<void> {
    this.exec(`git checkout -b ${name}`)
  }

  async checkoutMain(): Promise<void> {
    // Try master then main — git init default varies by git version/config
    try {
      this.exec('git checkout master')
    } catch {
      this.exec('git checkout main')
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

  async commitChange(message: string): Promise<void> {
    this.exec('git add -A')
    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`)
  }

  async deleteBranch(name: string): Promise<void> {
    this.exec(`git branch -D ${name}`)
  }

  async mergeBranch(name: string): Promise<void> {
    this.exec(`git merge --no-ff ${name} -m "chore(architect): merge self-improvement branch ${name}"`)
  }

  currentBranch(): string {
    return this.exec('git branch --show-current').trim()
  }
}
