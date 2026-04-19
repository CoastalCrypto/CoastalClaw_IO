import type Database from 'better-sqlite3'

export interface EdgeFeedbackRecord {
  agentId: string
  toolName: string
  score: number
  lastAt: number
}

/**
 * Stores user reinforcement on (agent, tool) edges. Each thumbs-up adds +1,
 * thumbs-down subtracts 1. The score then modulates the visual edge weight
 * via a bounded transform so feedback can never starve an edge to zero or
 * blow it up — it nudges, it doesn't dictate.
 */
export class EdgeFeedbackStore {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edge_feedback (
        agent_id  TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        score     INTEGER NOT NULL DEFAULT 0,
        last_at   INTEGER NOT NULL,
        PRIMARY KEY (agent_id, tool_name)
      )
    `)
  }

  /** Apply a vote (+1 or -1) and return the new running score */
  vote(agentId: string, toolName: string, delta: 1 | -1): number {
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO edge_feedback (agent_id, tool_name, score, last_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(agent_id, tool_name) DO UPDATE SET
        score   = score + excluded.score,
        last_at = excluded.last_at
    `).run(agentId, toolName, delta, now)

    const row = this.db.prepare(
      'SELECT score FROM edge_feedback WHERE agent_id = ? AND tool_name = ?'
    ).get(agentId, toolName) as { score: number } | undefined
    return row?.score ?? 0
  }

  /** Return all feedback as a Map keyed `${agentId}->tool:${toolName}` */
  getAll(): Map<string, EdgeFeedbackRecord> {
    const out = new Map<string, EdgeFeedbackRecord>()
    try {
      const rows = this.db.prepare('SELECT agent_id, tool_name, score, last_at FROM edge_feedback').all() as Array<{
        agent_id: string; tool_name: string; score: number; last_at: number
      }>
      for (const r of rows) {
        out.set(`${r.agent_id}->tool:${r.tool_name}`, {
          agentId: r.agent_id,
          toolName: r.tool_name,
          score: r.score,
          lastAt: r.last_at,
        })
      }
    } catch { /* fresh install */ }
    return out
  }

  get(agentId: string, toolName: string): EdgeFeedbackRecord | null {
    const row = this.db.prepare(
      'SELECT agent_id, tool_name, score, last_at FROM edge_feedback WHERE agent_id = ? AND tool_name = ?'
    ).get(agentId, toolName) as { agent_id: string; tool_name: string; score: number; last_at: number } | undefined
    if (!row) return null
    return { agentId: row.agent_id, toolName: row.tool_name, score: row.score, lastAt: row.last_at }
  }
}

/**
 * Map a raw feedback score to a multiplier in [0.4, 1.6].
 * tanh saturates so trolls / bugs / outliers can't destroy or balloon an edge.
 */
export function feedbackMultiplier(score: number): number {
  return 1 + Math.tanh(score / 5) * 0.6
}
