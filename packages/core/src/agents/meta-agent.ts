import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

export interface SkillGap {
  id: string
  description: string
  file: string
}

export interface MetaResult {
  iterationId: string
  gapId: string
  merged: boolean
  testSummary: string
  diff: string
}

export interface MetaPlanner {
  propose(gap: SkillGap): Promise<{ diff: string; targetFile: string }>
}

export interface MetaPatcher {
  apply(diff: string, branch: string): Promise<{ branch: string; merged: boolean }>
}

export interface MetaValidator {
  run(): Promise<{ passed: boolean; summary: string }>
}

/**
 * MetaAgent — runs a self-improvement iteration for a given skill gap.
 * Pattern adapted from HyperAgents (facebookresearch, arxiv 2603.19461).
 * Original architecture: meta-agent writes/tests/merges code patches iteratively.
 *
 * Depends on packages/architect's Planner, Patcher, Validator — injected via interfaces.
 * Archives every attempt to meta-archive.db for analysis.
 */
export class MetaAgent {
  private db: Database.Database

  constructor(
    private planner: MetaPlanner,
    private patcher: MetaPatcher,
    private validator: MetaValidator,
    dbPath = './data/meta-archive.db',
  ) {
    this.db = new Database(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta_archive (
        id TEXT PRIMARY KEY,
        gap_id TEXT NOT NULL,
        gap_description TEXT NOT NULL,
        diff TEXT NOT NULL,
        test_summary TEXT NOT NULL,
        merged INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
  }

  async improve(gap: SkillGap): Promise<MetaResult> {
    const iterationId = randomUUID()
    const { diff } = await this.planner.propose(gap)
    const branch = `meta/${gap.id.slice(0, 8)}-${Date.now()}`
    const { merged } = await this.patcher.apply(diff, branch)
    const { summary: testSummary } = await this.validator.run()

    this.db.prepare(`
      INSERT INTO meta_archive (id, gap_id, gap_description, diff, test_summary, merged, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(iterationId, gap.id, gap.description, diff, testSummary, merged ? 1 : 0, Date.now())

    return { iterationId, gapId: gap.id, merged, testSummary, diff }
  }

  close(): void {
    this.db.close()
  }
}
