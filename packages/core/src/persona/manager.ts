import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface Persona {
  /** The agent's display name — what it calls itself. */
  agentName: string
  /** One-line role description, e.g. "Executive Assistant" */
  agentRole: string
  /** Free-text personality traits, e.g. "Direct and concise. Prefer bullet points over prose." */
  personality: string
  /** Organization name, injected into all agent souls. */
  orgName: string
  /** 2–4 sentence description of the org — what it does, key context. */
  orgContext: string
  /** Optional: the human operator's name so the agent can address them personally. */
  ownerName: string
}

export const DEFAULT_PERSONA: Persona = {
  agentName: 'Assistant',
  agentRole: 'AI Assistant',
  personality: 'Helpful, concise, and honest.',
  orgName: 'Your Organization',
  orgContext: '',
  ownerName: '',
}

/**
 * Stores and retrieves the operator-configured agent persona.
 * One persona per deployment — stored in `persona.db`.
 *
 * Values are injected into soul templates via `{{persona.*}}` tokens
 * (resolved in AgentSession.systemPrompt).
 */
export class PersonaManager {
  private db: Database.Database

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS persona (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
  }

  get(): Persona {
    const rows = this.db.prepare('SELECT key, value FROM persona').all() as { key: string; value: string }[]
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
    return {
      agentName:   map.agentName   ?? DEFAULT_PERSONA.agentName,
      agentRole:   map.agentRole   ?? DEFAULT_PERSONA.agentRole,
      personality: map.personality ?? DEFAULT_PERSONA.personality,
      orgName:     map.orgName     ?? DEFAULT_PERSONA.orgName,
      orgContext:  map.orgContext  ?? DEFAULT_PERSONA.orgContext,
      ownerName:   map.ownerName   ?? DEFAULT_PERSONA.ownerName,
    }
  }

  /** Returns true if the user has done any configuration. */
  isConfigured(): boolean {
    const row = this.db.prepare('SELECT value FROM persona WHERE key = ?').get('agentName') as { value: string } | undefined
    return row !== undefined && row.value !== DEFAULT_PERSONA.agentName
  }

  set(updates: Partial<Persona>): Persona {
    const upsert = this.db.prepare(`
      INSERT INTO persona (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    const tx = this.db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) upsert.run(key, String(value))
      }
    })
    tx()
    return this.get()
  }

  getPersonaAgentId(): string | null {
    const row = this.db.prepare('SELECT value FROM persona WHERE key = ?').get('_personaAgentId') as { value: string } | undefined
    return row?.value ?? null
  }

  setPersonaAgentId(id: string): void {
    this.db.prepare(`
      INSERT INTO persona (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run('_personaAgentId', id)
  }

  /** Interpolates {{persona.*}} tokens in a soul template string. */
  static interpolate(template: string, persona: Persona): string {
    return template
      .replace(/\{\{persona\.agentName\}\}/g, persona.agentName)
      .replace(/\{\{persona\.agentRole\}\}/g, persona.agentRole)
      .replace(/\{\{persona\.personality\}\}/g, persona.personality)
      .replace(/\{\{persona\.orgName\}\}/g, persona.orgName)
      .replace(/\{\{persona\.orgContext\}\}/g, persona.orgContext || '(No additional context provided.)')
      .replace(/\{\{persona\.ownerName\}\}/g, persona.ownerName || 'the operator')
  }

  close(): void {
    this.db.close()
  }
}
