import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentConfig } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BUILT_IN_AGENTS: Omit<AgentConfig, 'createdAt'>[] = [
  {
    id: 'coo',
    name: 'Chief Operating Officer',
    role: 'Operations, workflows, team coordination, OKRs',
    soulPath: '',  // resolved at runtime
    tools: ['read_file', 'list_dir', 'http_get', 'query_db'],
    builtIn: true,
    active: true,
  },
  {
    id: 'cfo',
    name: 'Chief Financial Officer',
    role: 'Finance, budgets, forecasting, financial reporting',
    soulPath: '',
    tools: ['read_file', 'list_dir', 'query_db', 'http_get'],
    builtIn: true,
    active: true,
  },
  {
    id: 'cto',
    name: 'Chief Technology Officer',
    role: 'Engineering, architecture, infrastructure, security',
    soulPath: '',
    tools: ['read_file', 'write_file', 'list_dir', 'delete_file', 'run_command', 'git_status', 'git_diff', 'git_commit', 'git_log', 'query_db', 'http_get'],
    builtIn: true,
    active: true,
  },
  {
    id: 'general',
    name: 'General Assistant',
    role: 'General-purpose assistant for all topics',
    soulPath: '',
    tools: ['read_file', 'list_dir', 'http_get'],
    builtIn: true,
    active: true,
  },
  {
    id: 'product_manager',
    name: 'Product Manager',
    role: 'Product discovery, scoping, prioritization, roadmap',
    soulPath: '',
    tools: ['read_file', 'list_dir', 'http_get'],
    builtIn: true,
    active: true,
  },
  {
    id: 'frontend_wizard',
    name: 'Frontend Wizard',
    role: 'UI/UX development, accessibility, web performance',
    soulPath: '',
    tools: ['read_file', 'write_file', 'list_dir', 'delete_file', 'git_status', 'git_diff'],
    builtIn: true,
    active: true,
  },
  {
    id: 'ux_architect',
    name: 'UX Architect',
    role: 'User journey mapping, friction auditing, information architecture',
    soulPath: '',
    tools: ['read_file', 'list_dir', 'http_get'],
    builtIn: true,
    active: true,
  },
  {
    id: 'qa_lead',
    name: 'QA Lead',
    role: 'Integration testing, edge case discovery, verification',
    soulPath: '',
    tools: ['read_file', 'run_command', 'http_get'],
    builtIn: true,
    active: true,
  },
  {
    id: 'system_integrator',
    name: 'System Integrator',
    role: 'CLI-Anything execution, GUI software control, local machine orchestration',
    soulPath: '',
    tools: ['read_file', 'run_command', 'list_dir'],
    builtIn: true,
    active: true,
  },
]

export type CreateAgentInput = {
  name: string
  role: string
  soulPath: string
  tools: string[]
  modelPref?: string
}

export class AgentRegistry {
  private db: Database.Database
  private builtInSoulsDir: string

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.builtInSoulsDir = join(__dirname, 'souls')
    this.init()
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        role       TEXT NOT NULL,
        soul_path  TEXT NOT NULL,
        tools      TEXT NOT NULL,
        model_pref TEXT,
        built_in   INTEGER DEFAULT 0,
        active     INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      )
    `)

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO agents (id, name, role, soul_path, tools, built_in, active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?)
    `)
    const now = Date.now()
    for (const agent of BUILT_IN_AGENTS) {
      const soulPath = join(this.builtInSoulsDir, `SOUL_${agent.id.toUpperCase()}.md`)
      insert.run(agent.id, agent.name, agent.role, soulPath, JSON.stringify(agent.tools), now)
    }
  }

  list(): AgentConfig[] {
    const rows = this.db.prepare('SELECT * FROM agents WHERE active = 1 ORDER BY built_in DESC, created_at ASC').all() as any[]
    return rows.map(row => this.rowToConfig(row))
  }

  get(id: string): AgentConfig | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any
    return row ? this.rowToConfig(row) : null
  }

  getByDomain(domain: string): AgentConfig | null {
    return this.get(domain) ?? this.get('general')
  }

  create(input: CreateAgentInput): string {
    const id = randomUUID()
    this.db.prepare(`
      INSERT INTO agents (id, name, role, soul_path, tools, model_pref, built_in, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)
    `).run(id, input.name, input.role, input.soulPath, JSON.stringify(input.tools), input.modelPref ?? null, Date.now())
    return id
  }

  update(id: string, fields: Partial<Pick<AgentConfig, 'name' | 'role' | 'soulPath' | 'tools' | 'modelPref' | 'active'>>): void {
    const sets: string[] = []
    const values: unknown[] = []
    if (fields.name !== undefined) { sets.push('name = ?'); values.push(fields.name) }
    if (fields.role !== undefined) { sets.push('role = ?'); values.push(fields.role) }
    if (fields.soulPath !== undefined) { sets.push('soul_path = ?'); values.push(fields.soulPath) }
    if (fields.tools !== undefined) { sets.push('tools = ?'); values.push(JSON.stringify(fields.tools)) }
    if (fields.modelPref !== undefined) { sets.push('model_pref = ?'); values.push(fields.modelPref) }
    if (fields.active !== undefined) { sets.push('active = ?'); values.push(fields.active ? 1 : 0) }
    if (sets.length === 0) return
    values.push(id)
    const result = this.db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    if (result.changes === 0) throw new Error(`Agent not found: ${id}`)
  }

  delete(id: string): void {
    const row = this.db.prepare('SELECT built_in FROM agents WHERE id = ?').get(id) as any
    if (!row) throw new Error(`Agent not found: ${id}`)
    if (row.built_in) throw new Error('Cannot delete built-in agent')
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(id)
  }

  close(): void { this.db.close() }

  private rowToConfig(row: any): AgentConfig {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      soulPath: row.soul_path,
      tools: this.parseTools(row.id, row.tools),
      modelPref: row.model_pref ?? undefined,
      builtIn: Boolean(row.built_in),
      active: Boolean(row.active),
      createdAt: row.created_at,
    }
  }

  private parseTools(agentId: string, raw: string): string[] {
    try {
      return JSON.parse(raw) as string[]
    } catch {
      console.error(`[AgentRegistry] Failed to parse tools for agent ${agentId}, defaulting to []`)
      return []
    }
  }
}
