import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { AgentRegistry } from '../../agents/registry.js'

export interface MemorySummary {
  contexts: number   // context docs scoped to this agent
  toolsUsed: number  // distinct tools the agent has invoked (from action_log)
  actions: number    // total action_log entries (capped client-side for display)
  bindings: number   // routing rules attached to the agent
  lastActionAt: number | null
}

/**
 * Bulk per-agent "memory bloom" summary.
 *
 * Surfaces the slow-moving learning signal that drives the satellite
 * visualization on the agent graph. Three indexed SQL aggregates serve
 * the entire agent set in O(1) network round trips, regardless of fleet
 * size — this is meant to be polled, not pushed.
 */
export async function agentMemoryRoutes(
  fastify: FastifyInstance,
  opts: { registry: AgentRegistry; db: Database.Database },
) {
  fastify.get('/api/admin/agents/memory-summary', async () => {
    const agents = opts.registry.listAll()
    const summary: Record<string, MemorySummary> = {}

    // Initialize zeroed entries (so the client can render satellites for
    // brand-new agents whose tables haven't been written to yet).
    for (const a of agents) {
      summary[a.id] = {
        contexts: 0,
        toolsUsed: 0,
        actions: 0,
        bindings: a.bindings?.length ?? 0,
        lastActionAt: null,
      }
    }

    // Context docs: count docs where scope = agentId AND enabled = 1
    try {
      const rows = opts.db.prepare(`
        SELECT scope AS agent_id, COUNT(*) AS cnt
        FROM context_docs
        WHERE enabled = 1 AND scope != 'global'
        GROUP BY scope
      `).all() as Array<{ agent_id: string; cnt: number }>
      for (const r of rows) {
        if (summary[r.agent_id]) summary[r.agent_id].contexts = r.cnt
      }
    } catch { /* table may not exist yet on a fresh install */ }

    // Distinct tools used per agent + total action count + last action timestamp
    try {
      const rows = opts.db.prepare(`
        SELECT
          agent_id,
          COUNT(DISTINCT tool_name) AS distinct_tools,
          COUNT(*) AS total_actions,
          MAX(created_at) AS last_at
        FROM action_log
        GROUP BY agent_id
      `).all() as Array<{ agent_id: string; distinct_tools: number; total_actions: number; last_at: number | null }>
      for (const r of rows) {
        if (summary[r.agent_id]) {
          summary[r.agent_id].toolsUsed = r.distinct_tools
          summary[r.agent_id].actions = r.total_actions
          summary[r.agent_id].lastActionAt = r.last_at
        }
      }
    } catch { /* fresh install */ }

    return summary
  })
}
