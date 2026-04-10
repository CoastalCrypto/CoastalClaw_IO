// packages/core/src/agents/skill-gaps.ts
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export interface SkillGap {
  id: string
  sessionId: string
  agentId: string
  toolName: string
  failurePattern: string
  args: Record<string, unknown>
  timestamp: number
  reviewed: boolean
}

export class SkillGapsLog {
  private db: Database.Database

  constructor(dataDir: string) {
    this.db = new Database(join(dataDir, 'skill-gaps.db'))
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skill_gaps (
        id              TEXT PRIMARY KEY,
        session_id      TEXT NOT NULL,
        agent_id        TEXT NOT NULL,
        tool_name       TEXT NOT NULL,
        failure_pattern TEXT NOT NULL,
        args            TEXT NOT NULL DEFAULT '{}',
        timestamp       INTEGER NOT NULL,
        reviewed        INTEGER NOT NULL DEFAULT 0
      )
    `)
  }

  record(gap: Omit<SkillGap, 'id' | 'reviewed'>): void {
    this.db.prepare(`
      INSERT INTO skill_gaps
        (id, session_id, agent_id, tool_name, failure_pattern, args, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      gap.sessionId,
      gap.agentId,
      gap.toolName,
      gap.failurePattern.slice(0, 500),
      JSON.stringify(gap.args),
      gap.timestamp,
    )
  }

  listUnreviewed(): SkillGap[] {
    const rows = this.db
      .prepare('SELECT * FROM skill_gaps WHERE reviewed = 0 ORDER BY timestamp ASC')
      .all() as any[]
    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      agentId: r.agent_id,
      toolName: r.tool_name,
      failurePattern: r.failure_pattern,
      args: JSON.parse(r.args),
      timestamp: r.timestamp,
      reviewed: Boolean(r.reviewed),
    }))
  }

  listByAgent(agentId: string): SkillGap[] {
    return (this.db
      .prepare('SELECT * FROM skill_gaps WHERE agent_id = ? AND reviewed = 0 ORDER BY timestamp DESC LIMIT 50')
      .all(agentId) as any[]).map(r => ({
        id: r.id, sessionId: r.session_id, agentId: r.agent_id, toolName: r.tool_name,
        failurePattern: r.failure_pattern, args: JSON.parse(r.args), timestamp: r.timestamp, reviewed: Boolean(r.reviewed),
      }))
  }

  markReviewed(id: string): void {
    this.db.prepare('UPDATE skill_gaps SET reviewed = 1 WHERE id = ?').run(id)
  }

  close(): void {
    this.db.close()
  }
}
