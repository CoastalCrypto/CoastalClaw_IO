import type Database from 'better-sqlite3'

/**
 * Two tools "co-activate" when one agent invokes both in the same session
 * within this window. 120s catches "Read then Edit on the same file" and
 * "git_status then git_diff then git_commit" without bridging unrelated
 * workflow segments inside long-lived sessions.
 */
const COACTIVATION_WINDOW_MS = 120_000

/**
 * Lookback horizon. Older signal still influences via the recency-weighted
 * agent→tool edges, but suggestions should reflect *recent* workflow shape.
 */
const SUGGESTION_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

/** Don't suggest more than this many growth edges per agent — keep the bloom curated */
const MAX_SUGGESTIONS_PER_AGENT = 3

/** Don't suggest a tool unless its co-occurrence count crosses this floor */
const MIN_COACTIVATION_COUNT = 2

export interface SuggestedEdge {
  agentId: string
  toolName: string
  /** Normalized 0-1 — strongest suggestion across the system = 1 */
  score: number
  /** Raw co-occurrence count (for tooltip / debugging) */
  rawCount: number
  /** A tool the agent already has that pairs strongly with the suggestion */
  pairedWith: string
}

interface CoocRow {
  tool_a: string
  tool_b: string
  cooc: number
}

/**
 * Mine the action_log for tool co-activation patterns and surface, per agent,
 * the tools they don't currently have but which are strongly used alongside
 * tools they do have — a data-driven "you might want to grow this connection"
 * recommendation.
 *
 * Returns an empty array on a fresh install (no action_log yet).
 */
export function findSuggestedToolEdges(
  db: Database.Database,
  agents: Array<{ id: string; tools: string[] }>,
): SuggestedEdge[] {
  if (agents.length === 0) return []

  let rows: CoocRow[] = []
  try {
    const since = Date.now() - SUGGESTION_LOOKBACK_MS
    // Self-join the action_log within each session, keyed on a1.id < a2.id
    // to dedupe pair orderings, then GROUP BY the unordered pair.
    rows = db.prepare(`
      SELECT
        MIN(a1.tool_name, a2.tool_name) AS tool_a,
        MAX(a1.tool_name, a2.tool_name) AS tool_b,
        COUNT(*) AS cooc
      FROM action_log a1
      JOIN action_log a2
        ON a1.session_id = a2.session_id
       AND a1.id < a2.id
       AND ABS(a1.created_at - a2.created_at) <= ?
       AND a1.tool_name != a2.tool_name
      WHERE a1.created_at >= ? AND a2.created_at >= ?
      GROUP BY tool_a, tool_b
      HAVING COUNT(*) >= ?
    `).all(COACTIVATION_WINDOW_MS, since, since, MIN_COACTIVATION_COUNT) as CoocRow[]
  } catch {
    return []  // Fresh install — table not yet created
  }

  if (rows.length === 0) return []

  // Pair lookup: tool → list of (partner tool, cooc count)
  const pairsByTool = new Map<string, Array<{ partner: string; count: number }>>()
  let maxCount = 0
  for (const r of rows) {
    if (r.cooc > maxCount) maxCount = r.cooc
    if (!pairsByTool.has(r.tool_a)) pairsByTool.set(r.tool_a, [])
    if (!pairsByTool.has(r.tool_b)) pairsByTool.set(r.tool_b, [])
    pairsByTool.get(r.tool_a)!.push({ partner: r.tool_b, count: r.cooc })
    pairsByTool.get(r.tool_b)!.push({ partner: r.tool_a, count: r.cooc })
  }

  const out: SuggestedEdge[] = []
  for (const agent of agents) {
    const owned = new Set(agent.tools)
    // For each owned tool, look up its strongest non-owned partner
    const candidates = new Map<string, { count: number; pairedWith: string }>()
    for (const tool of agent.tools) {
      const pairs = pairsByTool.get(tool)
      if (!pairs) continue
      for (const { partner, count } of pairs) {
        if (owned.has(partner)) continue
        const existing = candidates.get(partner)
        if (!existing || count > existing.count) {
          candidates.set(partner, { count, pairedWith: tool })
        }
      }
    }

    // Top-N by raw count
    const ranked = Array.from(candidates.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, MAX_SUGGESTIONS_PER_AGENT)

    for (const [toolName, { count, pairedWith }] of ranked) {
      out.push({
        agentId: agent.id,
        toolName,
        rawCount: count,
        score: maxCount === 0 ? 0 : count / maxCount,
        pairedWith,
      })
    }
  }

  return out
}
