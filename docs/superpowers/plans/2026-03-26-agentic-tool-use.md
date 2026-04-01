# Agentic Tool Use Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full agentic tool-use layer to CoastalClaw — dynamic agent workforce with soul files, core tools (file/shell/git/db/web), MCP adapter, permission gate, and approval UI.

**Architecture:** New `packages/core/src/agents/` and `packages/core/src/tools/` modules hook into the existing `ModelRouter`. The `CascadeRouter` classifies domain; `AgentSession` loads the matching agent's soul + tool set; `AgenticLoop` iterates LLM ↔ tool calls until done. `chatRoutes` is updated to pass through the loop result.

**Tech Stack:** Node 22 ESM, TypeScript, vitest, better-sqlite3, Ollama tool-call API, Fastify 4, @fastify/websocket, React 19, Tailwind v4, @testing-library/react

---

## Chunk 1: Foundation

### Task 1: Agent Types

**Files:**
- Create: `packages/core/src/agents/types.ts`
- Create: `packages/core/src/agents/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/agents/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import type { ToolDefinition, ToolCall, ToolResult, AgentConfig, GateDecision } from '../types.js'

describe('agent types', () => {
  it('ToolDefinition has required shape', () => {
    const t: ToolDefinition = {
      name: 'read_file',
      description: 'Read a file',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path' } },
        required: ['path'],
      },
      reversible: true,
    }
    expect(t.name).toBe('read_file')
    expect(t.reversible).toBe(true)
  })

  it('AgentConfig has required shape', () => {
    const a: AgentConfig = {
      id: 'cto',
      name: 'Chief Technology Officer',
      role: 'Engineering',
      soulPath: '/data/souls/SOUL_CTO.md',
      tools: ['read_file', 'run_command'],
      builtIn: true,
      active: true,
      createdAt: Date.now(),
    }
    expect(a.builtIn).toBe(true)
    expect(a.tools).toContain('read_file')
  })

  it('GateDecision is a valid union string', () => {
    const d: GateDecision = 'allow'
    expect(['allow','block','queued','approved','denied','timeout']).toContain(d)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- agents/__tests__/types.test.ts
```

Expected: `Cannot find module '../types.js'`

- [ ] **Step 3: Create types.ts**

```typescript
// packages/core/src/agents/types.ts
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
  reversible: boolean
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  id: string
  name: string
  output: string
  error?: string
  durationMs: number
}

export type GateDecision = 'allow' | 'block' | 'queued' | 'approved' | 'denied' | 'timeout'

export interface AgentConfig {
  id: string
  name: string
  role: string
  soulPath: string
  tools: string[]
  modelPref?: string
  builtIn: boolean
  active: boolean
  createdAt: number
}

export interface LoopResult {
  reply: string
  actions: ActionSummary[]
  domain: string
}

export interface ActionSummary {
  tool: string
  decision: GateDecision
  durationMs: number
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test -- agents/__tests__/types.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/types.ts packages/core/src/agents/__tests__/types.test.ts
git commit -m "feat(agents): add core type definitions"
```

---

### Task 2: AgentRegistry

**Files:**
- Create: `packages/core/src/agents/registry.ts`
- Create: `packages/core/src/agents/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/agents/__tests__/registry.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AgentRegistry } from '../registry.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
let registry: AgentRegistry

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-agents-'))
  registry = new AgentRegistry(join(tmpDir, 'test.db'))
})

afterEach(() => {
  registry.close()
  rmSync(tmpDir, { recursive: true })
})

describe('AgentRegistry', () => {
  it('seeds four built-in agents on init', () => {
    const agents = registry.list()
    expect(agents).toHaveLength(4)
    const ids = agents.map(a => a.id)
    expect(ids).toContain('coo')
    expect(ids).toContain('cfo')
    expect(ids).toContain('cto')
    expect(ids).toContain('general')
  })

  it('get returns agent by id', () => {
    const cto = registry.get('cto')
    expect(cto).not.toBeNull()
    expect(cto!.name).toBe('Chief Technology Officer')
    expect(cto!.builtIn).toBe(true)
  })

  it('create adds a custom agent', () => {
    const id = registry.create({
      name: 'Legal Officer',
      role: 'Legal',
      soulPath: '/data/souls/legal.md',
      tools: ['read_file'],
    })
    expect(id).toBeTruthy()
    const agent = registry.get(id)
    expect(agent!.name).toBe('Legal Officer')
    expect(agent!.builtIn).toBe(false)
  })

  it('update changes agent fields', () => {
    const id = registry.create({ name: 'X', role: 'Y', soulPath: '/p', tools: [] })
    registry.update(id, { name: 'Z' })
    expect(registry.get(id)!.name).toBe('Z')
  })

  it('delete removes custom agent', () => {
    const id = registry.create({ name: 'X', role: 'Y', soulPath: '/p', tools: [] })
    registry.delete(id)
    expect(registry.get(id)).toBeNull()
  })

  it('delete throws on built-in agent', () => {
    expect(() => registry.delete('cto')).toThrow('Cannot delete built-in agent')
  })

  it('getByDomain returns matching agent or general fallback', () => {
    const agent = registry.getByDomain('cto')
    expect(agent!.id).toBe('cto')
    const fallback = registry.getByDomain('unknown-domain')
    expect(fallback!.id).toBe('general')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- agents/__tests__/registry.test.ts
```

- [ ] **Step 3: Implement AgentRegistry**

```typescript
// packages/core/src/agents/registry.ts
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { join, dirname } from 'node:path'
import type { AgentConfig } from './types.js'

const BUILT_IN_AGENTS: Omit<AgentConfig, 'createdAt'>[] = [
  {
    id: 'coo',
    name: 'Chief Operating Officer',
    role: 'Operations, workflows, team coordination, OKRs',
    soulPath: '',  // resolved at runtime relative to package
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
    this.builtInSoulsDir = join(dirname(new URL(import.meta.url).pathname), 'souls')
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

    // Seed built-in agents if not present
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
    return rows.map(this.rowToConfig)
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
    this.db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  delete(id: string): void {
    const row = this.db.prepare('SELECT built_in FROM agents WHERE id = ?').get(id) as any
    if (row?.built_in) throw new Error('Cannot delete built-in agent')
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(id)
  }

  close(): void { this.db.close() }

  private rowToConfig(row: any): AgentConfig {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      soulPath: row.soul_path,
      tools: JSON.parse(row.tools),
      modelPref: row.model_pref ?? undefined,
      builtIn: Boolean(row.built_in),
      active: Boolean(row.active),
      createdAt: row.created_at,
    }
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test -- agents/__tests__/registry.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/registry.ts packages/core/src/agents/__tests__/registry.test.ts
git commit -m "feat(agents): add AgentRegistry with SQLite backing and built-in agent seeding"
```

---

### Task 3: Soul Files

**Files:**
- Create: `packages/core/src/agents/souls/SOUL_COO.md`
- Create: `packages/core/src/agents/souls/SOUL_CFO.md`
- Create: `packages/core/src/agents/souls/SOUL_CTO.md`
- Create: `packages/core/src/agents/souls/SOUL_GENERAL.md`

- [ ] **Step 1: Write SOUL_COO.md**

```markdown
# Chief Operating Officer — CoastalClaw

You are the COO of this organization. You are responsible for keeping the business running smoothly across all operational dimensions.

## Responsibilities
- **People & Teams**: headcount planning, hiring processes, onboarding, HR workflows, team structure
- **Operations**: SOPs, process improvement, vendor relationships, supply chain, contractor management
- **Execution**: OKR tracking, sprint coordination, cross-team dependencies, milestone delivery
- **Communications**: internal announcements, all-hands preparation, stakeholder updates

## How You Work
You are organized and direct. You default to bullet points and action items. Every response involving a task or decision ends with a clear next step and an owner.

You check facts before stating them. If you need to look at a document, a calendar, or a database record — do it. Do not guess at operational state when you have tools to verify it.

When something is unclear, you ask one focused clarifying question before proceeding.

## Boundaries
You do not write code, modify infrastructure, or make financial commitments. Technical requests go to the CTO. Budget approvals go to the CFO.

## Tone
Direct, organized, action-oriented. No fluff. Use active voice.
```

- [ ] **Step 2: Write SOUL_CFO.md**

```markdown
# Chief Financial Officer — CoastalClaw

You are the CFO of this organization. You are responsible for the financial health, reporting accuracy, and fiscal discipline of the business.

## Responsibilities
- **Reporting**: P&L, cash flow, burn rate, runway, budget vs actuals
- **Forecasting**: revenue projections, cost modeling, scenario planning
- **Compliance**: tax obligations, regulatory filings, audit readiness
- **Procurement**: vendor contract review, cost optimization, payment approvals
- **Crypto Operations**: mining revenue tracking, wallet reconciliation, pool payout analysis

## How You Work
You are precise and evidence-based. Numbers must be sourced. When you cite a figure, state where it came from. When data is ambiguous, say so explicitly rather than rounding or estimating without disclosure.

You use your database and file access to pull actual figures rather than working from memory. If a report exists, read it. If a query will answer the question, run it.

## Boundaries
You do not approve payments over the threshold set by the organization without explicit human confirmation. You escalate operational decisions to the COO and technical decisions to the CTO.

## Tone
Measured, analytical, precise. Lead with the number, then the context.
```

- [ ] **Step 3: Write SOUL_CTO.md**

```markdown
# Chief Technology Officer — CoastalClaw

You are the CTO of this organization. You own the technical direction, engineering quality, and operational reliability of all systems.

## Responsibilities
- **Architecture**: system design, technology selection, technical standards, API design
- **Engineering**: code quality, CI/CD, deployment processes, dependency management
- **Infrastructure**: server health, uptime, monitoring, capacity planning
- **Security**: vulnerability management, access controls, secret rotation, audit logs
- **Mining Operations**: rig configuration, hashrate optimization, firmware, pool settings

## How You Work
You investigate before you answer. If a question touches system state — logs, configs, file contents, git history, running processes — you use your tools to check before responding. You show your work: if you ran a command, include its output.

You identify root causes before proposing fixes. A symptom is not a cause.

You are conservative with destructive operations. Before deleting a file or committing code, you confirm what will change. You prefer reversible actions.

## Boundaries
Financial decisions go to the CFO. People decisions go to the COO. You do not approve spend or headcount.

## Tone
Precise, analytical, technically rigorous. Use concrete examples. Avoid vague reassurances — if something is broken, say so clearly.
```

- [ ] **Step 4: Write SOUL_GENERAL.md**

```markdown
# General Assistant — CoastalClaw

You are a general-purpose AI executive assistant for this organization. You handle questions and tasks that span multiple domains or do not fit neatly into one specialist's remit.

## Responsibilities
- Answer general business questions across operations, finance, and technology
- Synthesize information from multiple domains
- Handle ad-hoc requests that do not require deep specialist knowledge
- Route complex domain-specific requests to the appropriate specialist agent

## How You Work
You are helpful, concise, and honest about what you know and do not know. When a question clearly belongs to a specialist domain (finance → CFO, engineering → CTO, operations → COO), you say so and suggest the user re-route.

You use your tools when they would improve your answer. You do not use tools unnecessarily.

## Tone
Friendly, clear, professional. Match the user's register — more casual for quick questions, more formal for formal requests.
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/souls/
git commit -m "feat(agents): add built-in SOUL identity files for COO, CFO, CTO, General"
```

---

### Task 4: AgentSession

**Files:**
- Create: `packages/core/src/agents/session.ts`
- Create: `packages/core/src/agents/__tests__/session.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/agents/__tests__/session.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AgentSession } from '../session.js'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ToolDefinition, AgentConfig } from '../types.js'

let tmpDir: string

beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'cc-session-')) })
afterEach(() => rmSync(tmpDir, { recursive: true }))

const mockTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read a file',
  parameters: { type: 'object', properties: { path: { type: 'string', description: 'path' } }, required: ['path'] },
  reversible: true,
}

const makeAgent = (soulPath: string): AgentConfig => ({
  id: 'cto',
  name: 'CTO',
  role: 'Engineering',
  soulPath,
  tools: ['read_file'],
  builtIn: true,
  active: true,
  createdAt: Date.now(),
})

describe('AgentSession', () => {
  it('builds system prompt with soul + tool descriptions', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# CTO\nYou are the CTO.')
    const agent = makeAgent(soulPath)
    const session = new AgentSession(agent, [mockTool])
    const prompt = session.systemPrompt
    expect(prompt).toContain('You are the CTO.')
    expect(prompt).toContain('read_file')
    expect(prompt).toContain('Read a file')
  })

  it('toolSchemas returns Ollama-format tool objects', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# test')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    const schemas = session.toolSchemas
    expect(schemas).toHaveLength(1)
    expect(schemas[0].type).toBe('function')
    expect(schemas[0].function.name).toBe('read_file')
  })

  it('buildMessages includes system prompt as first message', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# test')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    const msgs = session.buildMessages('hello', [])
    expect(msgs[0].role).toBe('system')
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'hello' })
  })

  it('actionSummary returns compact string', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# test')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    session.recordAction({ tool: 'read_file', decision: 'allow', durationMs: 12 })
    session.recordAction({ tool: 'run_command', decision: 'approved', durationMs: 300 })
    expect(session.actionSummary()).toContain('read_file')
  })

  it('reloads soul from disk on next access after file changes', async () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# original')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    expect(session.systemPrompt).toContain('original')
    writeFileSync(soulPath, '# updated')
    // Force reload by clearing cache
    session.invalidateSoulCache()
    expect(session.systemPrompt).toContain('updated')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- agents/__tests__/session.test.ts
```

- [ ] **Step 3: Implement AgentSession**

```typescript
// packages/core/src/agents/session.ts
import { readFileSync } from 'node:fs'
import type { AgentConfig, ToolDefinition, ActionSummary } from './types.js'

export interface OllamaToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: ToolDefinition['parameters']
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
  tool_call_id?: string
}

export class AgentSession {
  private _soulContent: string | null = null
  private _actions: ActionSummary[] = []

  constructor(
    readonly agent: AgentConfig,
    readonly allowedTools: ToolDefinition[],
  ) {}

  get systemPrompt(): string {
    if (!this._soulContent) {
      this._soulContent = readFileSync(this.agent.soulPath, 'utf8')
    }
    const toolLines = this.allowedTools
      .map(t => `- ${t.name}(${Object.keys(t.parameters.properties).join(', ')}): ${t.description}`)
      .join('\n')
    const now = new Date().toISOString()
    return `${this._soulContent}\n\nAvailable tools:\n${toolLines}\n\nCurrent date/time: ${now}`
  }

  get toolSchemas(): OllamaToolSchema[] {
    return this.allowedTools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  buildMessages(userMessage: string, history: ChatMessage[]): ChatMessage[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ]
  }

  recordAction(summary: ActionSummary): void {
    this._actions.push(summary)
  }

  actionSummary(): string {
    if (this._actions.length === 0) return ''
    const counts = new Map<string, number>()
    for (const a of this._actions) {
      counts.set(a.tool, (counts.get(a.tool) ?? 0) + 1)
    }
    const parts = [...counts.entries()].map(([tool, count]) => `${tool}×${count}`)
    return `\n\n---\n_Actions: ${parts.join(' · ')}_`
  }

  invalidateSoulCache(): void {
    this._soulContent = null
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test -- agents/__tests__/session.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/session.ts packages/core/src/agents/__tests__/session.test.ts
git commit -m "feat(agents): add AgentSession with soul loading, tool schemas, and action summary"
```

---

## Chunk 2: Core Tools + Gate + Loop

### Task 5: Extend OllamaClient for Tool Calls

**Files:**
- Modify: `packages/core/src/models/ollama.ts`
- Create: `packages/core/src/models/__tests__/ollama-tools.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/models/__tests__/ollama-tools.test.ts
import { describe, it, expect, vi } from 'vitest'
import { OllamaClient } from '../ollama.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OllamaClient.chatWithTools', () => {
  const client = new OllamaClient({ baseUrl: 'http://localhost:11434' })

  it('returns text reply when no tool calls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { role: 'assistant', content: 'hello', tool_calls: [] } }),
    })
    const result = await client.chatWithTools('llama3.1', [], [])
    expect(result.content).toBe('hello')
    expect(result.toolCalls).toHaveLength(0)
  })

  it('returns tool calls when model requests them', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'read_file', arguments: { path: '/tmp/x' } } }],
        },
      }),
    })
    const result = await client.chatWithTools('llama3.1', [], [])
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].name).toBe('read_file')
    expect(result.toolCalls[0].args).toEqual({ path: '/tmp/x' })
    expect(result.toolCalls[0].id).toBeTruthy()  // id is generated if missing
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- models/__tests__/ollama-tools.test.ts
```

- [ ] **Step 3: Add chatWithTools to OllamaClient**

Open `packages/core/src/models/ollama.ts` and add after the existing `chat` method:

```typescript
  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      message: {
        role: string
        content: string
        tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
      }
    }
    const toolCalls: ToolCall[] = (data.message.tool_calls ?? []).map((tc, i) => ({
      id: `tc-${i}-${Date.now()}`,
      name: tc.function.name,
      args: tc.function.arguments ?? {},
    }))
    return { content: data.message.content, toolCalls }
  }
```

Also add these imports at the top of `ollama.ts`:

```typescript
import type { OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test -- models/__tests__/ollama-tools.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/models/ollama.ts packages/core/src/models/__tests__/ollama-tools.test.ts
git commit -m "feat(ollama): add chatWithTools supporting Ollama tool-call API"
```

---

### Task 6: Core Tools — File

**Files:**
- Create: `packages/core/src/tools/core/file.ts`
- Create: `packages/core/src/tools/core/__tests__/file.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/tools/core/__tests__/file.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileTools } from '../file.js'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'cc-file-')) })
afterEach(() => rmSync(tmpDir, { recursive: true }))

describe('fileTools', () => {
  it('read_file returns file contents', async () => {
    writeFileSync(join(tmpDir, 'test.txt'), 'hello world')
    const exec = fileTools.find(t => t.definition.name === 'read_file')!.execute
    const result = await exec({ path: join(tmpDir, 'test.txt') })
    expect(result).toBe('hello world')
  })

  it('write_file creates file with content', async () => {
    const exec = fileTools.find(t => t.definition.name === 'write_file')!.execute
    await exec({ path: join(tmpDir, 'new.txt'), content: 'written' })
    const { readFileSync } = await import('node:fs')
    expect(readFileSync(join(tmpDir, 'new.txt'), 'utf8')).toBe('written')
  })

  it('list_dir returns directory entries', async () => {
    writeFileSync(join(tmpDir, 'a.txt'), '')
    writeFileSync(join(tmpDir, 'b.txt'), '')
    const exec = fileTools.find(t => t.definition.name === 'list_dir')!.execute
    const result = await exec({ path: tmpDir })
    expect(result).toContain('a.txt')
    expect(result).toContain('b.txt')
  })

  it('delete_file removes a file', async () => {
    writeFileSync(join(tmpDir, 'del.txt'), 'x')
    const exec = fileTools.find(t => t.definition.name === 'delete_file')!.execute
    await exec({ path: join(tmpDir, 'del.txt') })
    const { existsSync } = await import('node:fs')
    expect(existsSync(join(tmpDir, 'del.txt'))).toBe(false)
  })

  it('read_file returns error string for missing file', async () => {
    const exec = fileTools.find(t => t.definition.name === 'read_file')!.execute
    const result = await exec({ path: '/nonexistent/file.txt' })
    expect(result).toContain('Error')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- tools/core/__tests__/file.test.ts
```

- [ ] **Step 3: Implement file tools**

```typescript
// packages/core/src/tools/core/file.ts
import { readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import type { ToolDefinition } from '../../agents/types.js'

export interface CoreTool {
  definition: ToolDefinition
  execute: (args: Record<string, unknown>) => Promise<string>
}

export const fileTools: CoreTool[] = [
  {
    definition: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute or relative file path' } },
        required: ['path'],
      },
      reversible: true,
    },
    execute: async (args) => {
      try {
        return readFileSync(String(args.path), 'utf8')
      } catch (e: any) {
        return `Error reading file: ${e.message}`
      }
    },
  },
  {
    definition: {
      name: 'write_file',
      description: 'Write content to a file, creating it if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      reversible: false,
    },
    execute: async (args) => {
      try {
        writeFileSync(String(args.path), String(args.content), 'utf8')
        return `Written ${String(args.content).length} chars to ${args.path}`
      } catch (e: any) {
        return `Error writing file: ${e.message}`
      }
    },
  },
  {
    definition: {
      name: 'list_dir',
      description: 'List files and directories at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path' } },
        required: ['path'],
      },
      reversible: true,
    },
    execute: async (args) => {
      try {
        const entries = readdirSync(String(args.path), { withFileTypes: true })
        return entries.map(e => `${e.isDirectory() ? '[dir] ' : ''}${e.name}`).join('\n')
      } catch (e: any) {
        return `Error listing directory: ${e.message}`
      }
    },
  },
  {
    definition: {
      name: 'delete_file',
      description: 'Delete a file at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path to delete' } },
        required: ['path'],
      },
      reversible: false,
    },
    execute: async (args) => {
      try {
        const stat = statSync(String(args.path))
        if (stat.isDirectory()) return 'Error: path is a directory, not a file'
        unlinkSync(String(args.path))
        return `Deleted ${args.path}`
      } catch (e: any) {
        return `Error deleting file: ${e.message}`
      }
    },
  },
]
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test -- tools/core/__tests__/file.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/core/file.ts packages/core/src/tools/core/__tests__/file.test.ts
git commit -m "feat(tools): add file core tools (read, write, list, delete)"
```

---

### Task 7: Core Tools — Shell, Git, DB, Web

**Files:**
- Create: `packages/core/src/tools/core/shell.ts`
- Create: `packages/core/src/tools/core/git.ts`
- Create: `packages/core/src/tools/core/sqlite.ts`
- Create: `packages/core/src/tools/core/web.ts`
- Create: `packages/core/src/tools/core/__tests__/shell.test.ts`

- [ ] **Step 1: Write shell sandbox test**

```typescript
// packages/core/src/tools/core/__tests__/shell.test.ts
import { describe, it, expect } from 'vitest'
import { shellTools } from '../shell.js'

const exec = shellTools.find(t => t.definition.name === 'run_command')!.execute

describe('run_command', () => {
  it('runs a simple command and returns stdout', async () => {
    const result = await exec({ cmd: 'echo hello', workdir: process.cwd() })
    expect(result).toContain('hello')
  })

  it('returns stderr on error', async () => {
    const result = await exec({ cmd: 'cat /nonexistent_file_xyz', workdir: process.cwd() })
    expect(result).toMatch(/error|no such|Error/i)
  })

  it('blocks commands that escape the workdir via cd', async () => {
    const result = await exec({ cmd: 'cd /etc && cat passwd', workdir: '/tmp' })
    expect(result).toContain('Error: cwd escape')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- tools/core/__tests__/shell.test.ts
```

- [ ] **Step 3: Implement shell.ts**

```typescript
// packages/core/src/tools/core/shell.ts
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { CoreTool } from './file.js'

export const shellTools: CoreTool[] = [
  {
    definition: {
      name: 'run_command',
      description: 'Execute a shell command in the agent workspace directory. Returns stdout + stderr.',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string', description: 'Shell command to run' },
          workdir: { type: 'string', description: 'Working directory (must be within CC_AGENT_WORKDIR)' },
        },
        required: ['cmd'],
      },
      reversible: false,
    },
    execute: async (args) => {
      const agentWorkdir = resolve(process.env.CC_AGENT_WORKDIR ?? './data/workspace')
      const requestedCwd = resolve(String(args.workdir ?? agentWorkdir))

      // Block escape attempts
      if (!requestedCwd.startsWith(agentWorkdir)) {
        return `Error: cwd escape attempt blocked. Requested: ${requestedCwd}, allowed: ${agentWorkdir}`
      }

      // Block cd to outside workdir within the command
      const cmd = String(args.cmd)
      if (/cd\s+\//.test(cmd) && !cmd.includes(agentWorkdir)) {
        return `Error: cwd escape attempt blocked in command: ${cmd}`
      }

      try {
        const output = execSync(cmd, {
          cwd: requestedCwd,
          timeout: 30_000,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return output || '(no output)'
      } catch (e: any) {
        return `Error (exit ${e.status ?? '?'}): ${e.stderr || e.message}`
      }
    },
  },
]
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test -- tools/core/__tests__/shell.test.ts
```

- [ ] **Step 5: Implement git.ts**

```typescript
// packages/core/src/tools/core/git.ts
import { execSync } from 'node:child_process'
import type { CoreTool } from './file.js'

function git(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, { cwd: cwd ?? process.cwd(), encoding: 'utf8', timeout: 15_000 })
  } catch (e: any) {
    return `Git error: ${e.stderr || e.message}`
  }
}

export const gitTools: CoreTool[] = [
  {
    definition: {
      name: 'git_status',
      description: 'Show the working tree status.',
      parameters: {
        type: 'object',
        properties: { repo: { type: 'string', description: 'Optional repo path (defaults to cwd)' } },
      },
      reversible: true,
    },
    execute: async (args) => git('status', args.repo as string | undefined),
  },
  {
    definition: {
      name: 'git_diff',
      description: 'Show changes in the working tree or a specific file.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Optional file path to diff' } },
      },
      reversible: true,
    },
    execute: async (args) => git(args.path ? `diff -- ${args.path}` : 'diff'),
  },
  {
    definition: {
      name: 'git_log',
      description: 'Show recent commit history.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'string', description: 'Number of commits to show (default: 10)' } },
      },
      reversible: true,
    },
    execute: async (args) => git(`log --oneline -${Number(args.limit ?? 10)}`),
  },
  {
    definition: {
      name: 'git_commit',
      description: 'Stage specified files and create a commit.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
          files: { type: 'string', description: 'Space-separated file paths to stage (or "." for all)' },
        },
        required: ['message', 'files'],
      },
      reversible: false,
    },
    execute: async (args) => {
      git(`add ${args.files}`)
      return git(`commit -m ${JSON.stringify(args.message)}`)
    },
  },
]
```

- [ ] **Step 6: Implement sqlite.ts**

```typescript
// packages/core/src/tools/core/sqlite.ts
import Database from 'better-sqlite3'
import type { CoreTool } from './file.js'

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    const dataDir = process.env.CC_DATA_DIR ?? './data'
    _db = new Database(`${dataDir}/coastal-claw.db`, { readonly: false })
  }
  return _db
}

export const sqliteTools: CoreTool[] = [
  {
    definition: {
      name: 'query_db',
      description: 'Run a SQL query against the CoastalClaw database. Use mode="read" for SELECT, mode="write" for INSERT/UPDATE/DELETE.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'SQL query to execute' },
          mode: { type: 'string', description: '"read" or "write"' },
        },
        required: ['sql', 'mode'],
      },
      reversible: false,  // treated as reversible=true for reads in PermissionGate
    },
    execute: async (args) => {
      try {
        const db = getDb()
        const sql = String(args.sql).trim()
        if (args.mode === 'read') {
          const rows = db.prepare(sql).all()
          return JSON.stringify(rows, null, 2)
        } else {
          const info = db.prepare(sql).run()
          return `Changes: ${info.changes}, last insert rowid: ${info.lastInsertRowid}`
        }
      } catch (e: any) {
        return `DB error: ${e.message}`
      }
    },
  },
]
```

- [ ] **Step 7: Implement web.ts**

```typescript
// packages/core/src/tools/core/web.ts
import type { CoreTool } from './file.js'

export const webTools: CoreTool[] = [
  {
    definition: {
      name: 'http_get',
      description: 'Fetch a URL and return the response body as text.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to fetch' } },
        required: ['url'],
      },
      reversible: true,
    },
    execute: async (args) => {
      try {
        const res = await fetch(String(args.url), { signal: AbortSignal.timeout(10_000) })
        const text = await res.text()
        return text.slice(0, 4000)  // cap at tool result limit
      } catch (e: any) {
        return `Fetch error: ${e.message}`
      }
    },
  },
]
```

- [ ] **Step 8: Commit all tool implementations**

```bash
git add packages/core/src/tools/core/
git commit -m "feat(tools): add shell, git, sqlite, and web core tools"
```

---

### Task 8: ToolRegistry + PermissionGate + ActionLog

**Files:**
- Create: `packages/core/src/tools/registry.ts`
- Create: `packages/core/src/agents/permission-gate.ts`
- Create: `packages/core/src/agents/action-log.ts`
- Create: `packages/core/src/agents/__tests__/permission-gate.test.ts`
- Create: `packages/core/src/agents/__tests__/action-log.test.ts`

- [ ] **Step 1: Write PermissionGate test**

```typescript
// packages/core/src/agents/__tests__/permission-gate.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PermissionGate } from '../permission-gate.js'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
let db: Database.Database

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-gate-'))
  db = new Database(join(tmpDir, 'test.db'))
})
afterEach(() => { db.close(); rmSync(tmpDir, { recursive: true }) })

describe('PermissionGate.evaluate', () => {
  it('BLOCKs tool not in agent permitted list', () => {
    const gate = new PermissionGate(db)
    const decision = gate.evaluate('cto', 'unknown_tool', false)
    expect(decision).toBe('block')
  })

  it('ALLOWs reversible tool in permitted list', () => {
    const gate = new PermissionGate(db)
    const decision = gate.evaluate('cto', 'read_file', true, ['read_file'])
    expect(decision).toBe('allow')
  })

  it('QUEUEs irreversible tool not always-allowed', () => {
    const gate = new PermissionGate(db)
    const decision = gate.evaluate('cto', 'run_command', false, ['run_command'])
    expect(decision).toBe('queued')
  })

  it('ALLOWs irreversible tool after always-allow set', () => {
    const gate = new PermissionGate(db)
    gate.setAlwaysAllow('cto', 'run_command')
    const decision = gate.evaluate('cto', 'run_command', false, ['run_command'])
    expect(decision).toBe('allow')
  })

  it('query_db is ALLOW in read mode, QUEUE in write mode', () => {
    const gate = new PermissionGate(db)
    expect(gate.evaluate('cto', 'query_db', true, ['query_db'])).toBe('allow')
    expect(gate.evaluate('cto', 'query_db', false, ['query_db'])).toBe('queued')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- agents/__tests__/permission-gate.test.ts
```

- [ ] **Step 3: Implement PermissionGate**

```typescript
// packages/core/src/agents/permission-gate.ts
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { GateDecision } from './types.js'

const APPROVAL_TIMEOUT_MS = Number(process.env.CC_APPROVAL_TIMEOUT_MS ?? 300_000)

export class PermissionGate {
  private pendingApprovals = new Map<string, { resolve: (d: 'approved' | 'denied' | 'timeout') => void }>()

  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_always_allow (
        agent_id  TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        PRIMARY KEY (agent_id, tool_name)
      )
    `)
  }

  /**
   * Evaluate gate decision for a tool call.
   * @param agentId        The agent making the call
   * @param toolName       The tool being called
   * @param reversible     Whether this specific call is reversible (read=true for query_db)
   * @param permittedTools The agent's permitted tool list (if omitted, BLOCK)
   */
  evaluate(
    agentId: string,
    toolName: string,
    reversible: boolean,
    permittedTools?: string[],
  ): GateDecision {
    // Step 1: check permitted list
    if (!permittedTools || !permittedTools.includes(toolName)) return 'block'

    // Step 2: if reversible, allow
    if (reversible) return 'allow'

    // Step 3: check always-allow
    const alwaysAllow = this.db
      .prepare('SELECT 1 FROM agent_always_allow WHERE agent_id = ? AND tool_name = ?')
      .get(agentId, toolName)
    if (alwaysAllow) return 'allow'

    return 'queued'
  }

  setAlwaysAllow(agentId: string, toolName: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO agent_always_allow (agent_id, tool_name) VALUES (?, ?)')
      .run(agentId, toolName)
  }

  /** Creates a pending approval and returns { approvalId, promise }. Loop awaits the promise. */
  createPendingApproval(): { approvalId: string; promise: Promise<'approved' | 'denied' | 'timeout'> } {
    const approvalId = randomUUID()
    const promise = new Promise<'approved' | 'denied' | 'timeout'>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(approvalId)
        resolve('timeout')
      }, APPROVAL_TIMEOUT_MS)

      this.pendingApprovals.set(approvalId, {
        resolve: (decision) => {
          clearTimeout(timer)
          this.pendingApprovals.delete(approvalId)
          resolve(decision)
        },
      })
    })
    return { approvalId, promise }
  }

  resolveApproval(approvalId: string, decision: 'approved' | 'denied'): boolean {
    const pending = this.pendingApprovals.get(approvalId)
    if (!pending) return false
    pending.resolve(decision)
    return true
  }
}
```

- [ ] **Step 4: Run PermissionGate test — expect PASS**

```bash
cd packages/core && pnpm test -- agents/__tests__/permission-gate.test.ts
```

- [ ] **Step 5: Write ActionLog test**

```typescript
// packages/core/src/agents/__tests__/action-log.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ActionLog } from '../action-log.js'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
let db: Database.Database

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-log-'))
  db = new Database(join(tmpDir, 'test.db'))
})
afterEach(() => { db.close(); rmSync(tmpDir, { recursive: true }) })

describe('ActionLog', () => {
  it('records an action entry', () => {
    const log = new ActionLog(db)
    log.record({
      sessionId: 'sess-1',
      agentId: 'cto',
      toolName: 'read_file',
      args: { path: '/tmp/x' },
      result: 'file contents',
      decision: 'allow',
      durationMs: 42,
    })
    const entries = log.getForSession('sess-1')
    expect(entries).toHaveLength(1)
    expect(entries[0].toolName).toBe('read_file')
    expect(entries[0].decision).toBe('allow')
    expect(entries[0].result).toBe('file contents')
  })

  it('truncates result at 2000 chars for display but preserves full in result_full', () => {
    const log = new ActionLog(db)
    const longResult = 'x'.repeat(5000)
    log.record({
      sessionId: 'sess-2',
      agentId: 'cto',
      toolName: 'read_file',
      args: {},
      result: longResult,
      decision: 'allow',
      durationMs: 1,
    })
    const entries = log.getForSession('sess-2')
    expect(entries[0].result.length).toBeLessThanOrEqual(2000)
    expect(entries[0].resultFull.length).toBe(5000)
  })
})
```

- [ ] **Step 6: Implement ActionLog**

```typescript
// packages/core/src/agents/action-log.ts
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { GateDecision } from './types.js'

export interface ActionLogEntry {
  id: string
  sessionId: string
  agentId: string
  toolName: string
  args: Record<string, unknown>
  result: string
  resultFull: string
  decision: GateDecision
  durationMs: number
  createdAt: number
}

export class ActionLog {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS action_log (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        agent_id    TEXT NOT NULL,
        tool_name   TEXT NOT NULL,
        args        TEXT,
        result      TEXT,
        result_full TEXT,
        decision    TEXT,
        duration_ms INTEGER,
        created_at  INTEGER
      )
    `)
  }

  record(entry: Omit<ActionLogEntry, 'id' | 'createdAt' | 'resultFull'>): void {
    const display = entry.result.slice(0, 2000)
    this.db.prepare(`
      INSERT INTO action_log (id, session_id, agent_id, tool_name, args, result, result_full, decision, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      entry.sessionId,
      entry.agentId,
      entry.toolName,
      JSON.stringify(entry.args),
      display,
      entry.result,
      entry.decision,
      entry.durationMs,
      Date.now(),
    )
  }

  getForSession(sessionId: string): ActionLogEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM action_log WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as any[]
    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      agentId: r.agent_id,
      toolName: r.tool_name,
      args: JSON.parse(r.args ?? '{}'),
      result: r.result,
      resultFull: r.result_full,
      decision: r.decision,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
    }))
  }
}
```

- [ ] **Step 7: Implement ToolRegistry**

```typescript
// packages/core/src/tools/registry.ts
import { fileTools } from './core/file.js'
import { shellTools } from './core/shell.js'
import { gitTools } from './core/git.js'
import { sqliteTools } from './core/sqlite.js'
import { webTools } from './core/web.js'
import type { CoreTool } from './core/file.js'
import type { ToolDefinition } from '../agents/types.js'

const READ_ONLY_TOOLS = new Set(['read_file', 'list_dir', 'git_status', 'git_diff', 'git_log', 'http_get'])
const READ_ONLY_SQL_MODE = 'read'

export class ToolRegistry {
  private tools = new Map<string, CoreTool>()

  constructor() {
    for (const t of [...fileTools, ...shellTools, ...gitTools, ...sqliteTools, ...webTools]) {
      this.tools.set(t.definition.name, t)
    }
  }

  get(name: string): CoreTool | undefined {
    return this.tools.get(name)
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition
  }

  getDefinitionsFor(toolNames: string[]): ToolDefinition[] {
    return toolNames.flatMap(n => {
      const def = this.getDefinition(n)
      return def ? [def] : []
    })
  }

  /** Returns true if this specific call is reversible (considers query_db mode) */
  isReversible(toolName: string, args: Record<string, unknown>): boolean {
    if (toolName === 'query_db') return args.mode === READ_ONLY_SQL_MODE
    return READ_ONLY_TOOLS.has(toolName)
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) return `Error: unknown tool "${name}"`
    return tool.execute(args)
  }
}
```

- [ ] **Step 8: Run action-log test — expect PASS**

```bash
cd packages/core && pnpm test -- agents/__tests__/action-log.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/tools/registry.ts packages/core/src/agents/permission-gate.ts packages/core/src/agents/action-log.ts packages/core/src/agents/__tests__/
git commit -m "feat(agents): add ToolRegistry, PermissionGate, and ActionLog"
```

---

### Task 9: AgenticLoop

**Files:**
- Create: `packages/core/src/agents/loop.ts`
- Create: `packages/core/src/agents/__tests__/loop.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/agents/__tests__/loop.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgenticLoop } from '../loop.js'
import type { AgentSession } from '../session.js'
import type { ToolRegistry } from '../../tools/registry.js'
import type { PermissionGate } from '../permission-gate.js'
import type { ActionLog } from '../action-log.js'

const mockSession = (tools: string[] = ['read_file']) => ({
  agent: { id: 'cto', tools, builtIn: true, active: true, createdAt: 0, name: 'CTO', role: 'Eng', soulPath: '' },
  systemPrompt: '# CTO',
  toolSchemas: [],
  buildMessages: (msg: string, hist: any[]) => [{ role: 'system', content: '# CTO' }, ...hist, { role: 'user', content: msg }],
  recordAction: vi.fn(),
  actionSummary: () => '',
  invalidateSoulCache: vi.fn(),
}) as unknown as AgentSession

const mockRegistry = (executor?: (name: string, args: any) => Promise<string>) => ({
  get: vi.fn(),
  isReversible: (name: string) => name === 'read_file',
  execute: executor ?? (async () => 'file contents'),
  getDefinition: vi.fn(),
  getDefinitionsFor: () => [],
}) as unknown as ToolRegistry

const mockGate = (decision = 'allow') => ({
  evaluate: vi.fn().mockReturnValue(decision),
  setAlwaysAllow: vi.fn(),
  createPendingApproval: vi.fn().mockReturnValue({
    approvalId: 'test-id',
    promise: Promise.resolve('approved'),
  }),
  resolveApproval: vi.fn(),
}) as unknown as PermissionGate

const mockLog = () => ({
  record: vi.fn(),
  getForSession: vi.fn().mockReturnValue([]),
}) as unknown as ActionLog

describe('AgenticLoop', () => {
  it('returns reply when no tool calls', async () => {
    const ollama = { chatWithTools: vi.fn().mockResolvedValue({ content: 'hello', toolCalls: [] }) } as any
    const loop = new AgenticLoop(ollama, mockRegistry(), mockGate(), mockLog())
    const result = await loop.run(mockSession(), 'hi', 'sess-1', [])
    expect(result.reply).toBe('hello')
    expect(result.actions).toHaveLength(0)
  })

  it('executes one tool call and loops', async () => {
    const ollama = {
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'tc1', name: 'read_file', args: { path: '/x' } }] })
        .mockResolvedValueOnce({ content: 'done', toolCalls: [] }),
    } as any
    const loop = new AgenticLoop(ollama, mockRegistry(), mockGate('allow'), mockLog())
    const result = await loop.run(mockSession(['read_file']), 'check file', 'sess-1', [])
    expect(result.reply).toBe('done')
    expect(ollama.chatWithTools).toHaveBeenCalledTimes(2)
  })

  it('stops at CC_AGENT_MAX_TURNS', async () => {
    process.env.CC_AGENT_MAX_TURNS = '2'
    const ollama = {
      chatWithTools: vi.fn().mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'tc1', name: 'read_file', args: {} }],
      }),
    } as any
    const loop = new AgenticLoop(ollama, mockRegistry(), mockGate('allow'), mockLog())
    const result = await loop.run(mockSession(['read_file']), 'loop', 'sess-1', [])
    expect(result.reply).toContain('maximum turns')
    delete process.env.CC_AGENT_MAX_TURNS
  })

  it('returns BLOCK result to LLM without executing', async () => {
    const executor = vi.fn()
    const ollama = {
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'tc1', name: 'forbidden_tool', args: {} }] })
        .mockResolvedValueOnce({ content: 'understood', toolCalls: [] }),
    } as any
    const registry = mockRegistry(executor as any)
    const loop = new AgenticLoop(ollama, registry, mockGate('block'), mockLog())
    const result = await loop.run(mockSession([]), 'try forbidden', 'sess-1', [])
    expect(executor).not.toHaveBeenCalled()
    expect(result.reply).toBe('understood')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test -- agents/__tests__/loop.test.ts
```

- [ ] **Step 3: Implement AgenticLoop**

```typescript
// packages/core/src/agents/loop.ts
import type { OllamaClient } from '../models/ollama.js'
import type { AgentSession, ChatMessage } from './session.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { PermissionGate } from './permission-gate.js'
import type { ActionLog } from './action-log.js'
import type { LoopResult } from './types.js'

const MAX_TURNS = () => Number(process.env.CC_AGENT_MAX_TURNS ?? 10)
const MAX_RESULT_CHARS = () => Number(process.env.CC_TOOL_RESULT_MAX_CHARS ?? 4000)

export class AgenticLoop {
  constructor(
    private ollama: OllamaClient,
    private registry: ToolRegistry,
    private gate: PermissionGate,
    private log: ActionLog,
    private onApprovalNeeded?: (approvalId: string, agentName: string, toolName: string, cmd: string) => void,
  ) {}

  async run(
    session: AgentSession,
    userMessage: string,
    sessionId: string,
    history: ChatMessage[],
  ): Promise<LoopResult> {
    const messages: ChatMessage[] = session.buildMessages(userMessage, history)
    let turns = 0

    while (turns < MAX_TURNS()) {
      const { content, toolCalls } = await this.ollama.chatWithTools(
        session.agent.modelPref ?? process.env.CC_DEFAULT_MODEL ?? 'llama3.2',
        messages,
        session.toolSchemas,
      )

      if (!toolCalls.length) {
        return {
          reply: content + session.actionSummary(),
          actions: [],
          domain: session.agent.id,
        }
      }

      messages.push({ role: 'assistant', content, tool_calls: toolCalls.map(tc => ({ function: { name: tc.name, arguments: tc.args } })) })

      // Separate reads and writes for parallel vs sequential execution
      const hasWrite = toolCalls.some(tc => !this.registry.isReversible(tc.name, tc.args))

      if (!hasWrite) {
        // All reads — run concurrently
        const results = await Promise.all(toolCalls.map(tc => this.executeOne(tc, session, sessionId)))
        for (const { tc, output } of results) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: output })
        }
      } else {
        // Sequential
        for (const tc of toolCalls) {
          const { output } = await this.executeOne(tc, session, sessionId)
          messages.push({ role: 'tool', tool_call_id: tc.id, content: output })
        }
      }

      turns++
    }

    return {
      reply: `${session.actionSummary()}\n\n[Reached maximum turns (${MAX_TURNS()}). Stopping here.]`,
      actions: [],
      domain: session.agent.id,
    }
  }

  private async executeOne(
    tc: { id: string; name: string; args: Record<string, unknown> },
    session: AgentSession,
    sessionId: string,
  ): Promise<{ tc: typeof tc; output: string }> {
    const start = Date.now()
    const reversible = this.registry.isReversible(tc.name, tc.args)
    const decision = this.gate.evaluate(session.agent.id, tc.name, reversible, session.agent.tools)

    if (decision === 'block') {
      const duration = Date.now() - start
      this.log.record({ sessionId, agentId: session.agent.id, toolName: tc.name, args: tc.args, result: `Blocked: tool not permitted for this agent`, decision: 'block', durationMs: duration })
      session.recordAction({ tool: tc.name, decision: 'block', durationMs: duration })
      return { tc, output: `Error: tool "${tc.name}" is not permitted for agent ${session.agent.name}` }
    }

    if (decision === 'queued') {
      const { approvalId, promise } = this.gate.createPendingApproval()
      this.onApprovalNeeded?.(approvalId, session.agent.name, tc.name, JSON.stringify(tc.args))
      const approval = await promise

      if (approval === 'approved' || approval === 'timeout') {
        // timeout auto-denies
        if (approval === 'timeout') {
          this.log.record({ sessionId, agentId: session.agent.id, toolName: tc.name, args: tc.args, result: 'Approval timed out', decision: 'timeout', durationMs: Date.now() - start })
          return { tc, output: `Error: approval timed out for tool "${tc.name}"` }
        }
      } else {
        // denied
        this.log.record({ sessionId, agentId: session.agent.id, toolName: tc.name, args: tc.args, result: 'Denied by user', decision: 'denied', durationMs: Date.now() - start })
        return { tc, output: `Tool "${tc.name}" was denied by the user` }
      }
    }

    // Execute
    let raw = ''
    try {
      raw = await this.registry.execute(tc.name, tc.args)
    } catch (e: any) {
      raw = `Execution error: ${e.message}`
    }

    const truncated = raw.slice(0, MAX_RESULT_CHARS())
    const duration = Date.now() - start
    const finalDecision = decision === 'queued' ? 'approved' : 'allow'
    this.log.record({ sessionId, agentId: session.agent.id, toolName: tc.name, args: tc.args, result: raw, decision: finalDecision, durationMs: duration })
    session.recordAction({ tool: tc.name, decision: finalDecision, durationMs: duration })

    return { tc, output: truncated }
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test -- agents/__tests__/loop.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/loop.ts packages/core/src/agents/__tests__/loop.test.ts
git commit -m "feat(agents): add AgenticLoop with tool execution, permission gate, and parallel reads"
```

---

## Chunk 3: MCP + Config + Wire-up + API + UI

### Task 10: Config Updates

**Files:**
- Modify: `packages/core/src/config.ts`

- [ ] **Step 1: Add new env vars to Config interface and loadConfig**

Add to the `Config` interface:

```typescript
  agentWorkdir: string
  soulMaxTokens: number
  agentMaxTurns: number
  toolResultMaxChars: number
  approvalTimeoutMs: number
  defaultModel: string
```

Add to `loadConfig()` return object:

```typescript
    agentWorkdir: process.env.CC_AGENT_WORKDIR ?? './data/workspace',
    soulMaxTokens: Number(process.env.CC_SOUL_MAX_TOKENS ?? '1500'),
    agentMaxTurns: Number(process.env.CC_AGENT_MAX_TURNS ?? '10'),
    toolResultMaxChars: Number(process.env.CC_TOOL_RESULT_MAX_CHARS ?? '4000'),
    approvalTimeoutMs: Number(process.env.CC_APPROVAL_TIMEOUT_MS ?? '300000'),
    defaultModel: process.env.CC_DEFAULT_MODEL ?? 'llama3.2',
```

Also add to `packages/core/.env.local`:

```
CC_AGENT_WORKDIR=./data/workspace
CC_SOUL_MAX_TOKENS=1500
CC_AGENT_MAX_TURNS=10
CC_TOOL_RESULT_MAX_CHARS=4000
CC_APPROVAL_TIMEOUT_MS=300000
```

- [ ] **Step 2: Build to verify no TS errors**

```bash
cd packages/core && pnpm build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/config.ts packages/core/.env.local
git commit -m "feat(config): add agent-related config variables"
```

---

### Task 11: Wire AgenticLoop into chatRoutes

**Files:**
- Modify: `packages/core/src/api/routes/chat.ts`

- [ ] **Step 1: Update chatRoutes to use AgenticLoop**

Replace the contents of `packages/core/src/api/routes/chat.ts`:

```typescript
import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { UnifiedMemory } from '../../memory/index.js'
import { AgentRegistry } from '../../agents/registry.js'
import { AgentSession } from '../../agents/session.js'
import { AgenticLoop } from '../../agents/loop.js'
import { PermissionGate } from '../../agents/permission-gate.js'
import { ActionLog } from '../../agents/action-log.js'
import { ToolRegistry } from '../../tools/registry.js'
import { loadConfig } from '../../config.js'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync, join } from 'node:fs'
import { join as pathJoin } from 'node:path'

export async function chatRoutes(fastify: FastifyInstance) {
  const config = loadConfig()

  // Ensure data dir and workspace exist
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.agentWorkdir, { recursive: true })

  const db = new Database(pathJoin(config.dataDir, 'coastal-claw.db'))
  const router = new ModelRouter({ ollamaUrl: config.ollamaUrl, defaultModel: config.defaultModel })
  const memory = new UnifiedMemory({ dataDir: config.dataDir, mem0ApiKey: config.mem0ApiKey })
  const agentRegistry = new AgentRegistry(pathJoin(config.dataDir, 'agents.db'))
  const toolRegistry = new ToolRegistry()
  const gate = new PermissionGate(db)
  const log = new ActionLog(db)

  fastify.addHook('onClose', async () => {
    await memory.close()
    router.close()
    agentRegistry.close()
    db.close()
  })

  fastify.post<{
    Body: { sessionId?: string; message: string; model?: string }
  }>('/api/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          sessionId: { type: 'string', maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' },
          message: { type: 'string', minLength: 1, maxLength: 8192 },
          model: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { message, model } = req.body
    const sessionId = req.body.sessionId ?? randomUUID()

    const history = await memory.queryHistory({ sessionId, limit: 20 })
    memory.flushOldEntries(sessionId, 20).catch(() => {})
    const messages = history.slice().reverse().map(e => ({ role: e.role as any, content: e.content }))

    // Classify domain via CascadeRouter
    const decision = await router.cascade.route(message)
    const agent = agentRegistry.getByDomain(decision.domain) ?? agentRegistry.get('general')!
    const toolDefs = toolRegistry.getDefinitionsFor(agent.tools)
    const session = new AgentSession(agent, toolDefs)

    // Pending approval callback — sends WS event to client
    const pendingApprovals = new Map<string, string>()
    const onApprovalNeeded = (approvalId: string, agentName: string, toolName: string, cmd: string) => {
      pendingApprovals.set(approvalId, toolName)
      fastify.websocketServer?.clients.forEach((client: any) => {
        if (client._sessionId === sessionId) {
          client.send(JSON.stringify({ type: 'approval_request', approvalId, agentName, toolName, cmd }))
        }
      })
    }

    const loop = new AgenticLoop(router.ollama, toolRegistry, gate, log, onApprovalNeeded)
    const result = await loop.run(session, message, sessionId, messages)

    await memory.write({ id: randomUUID(), sessionId, role: 'user', content: message, timestamp: Date.now() }, decision.signals.retention)
    await memory.write({ id: randomUUID(), sessionId, role: 'assistant', content: result.reply, timestamp: Date.now() }, 'useful')

    return reply.send({ sessionId, reply: result.reply, domain: result.domain })
  })
}
```

- [ ] **Step 2: Expose ollama + cascade on ModelRouter**

In `packages/core/src/models/router.ts`, change private to public:

```typescript
  ollama: OllamaClient       // was: private
  cascade: CascadeRouter     // was: private
```

- [ ] **Step 3: Build**

```bash
cd packages/core && pnpm build
```

Expected: exits 0

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/api/routes/chat.ts packages/core/src/models/router.ts
git commit -m "feat(chat): wire AgenticLoop into chatRoutes with domain-based agent selection"
```

---

### Task 12: Admin API — Agents + MCP + Approvals

**Files:**
- Create: `packages/core/src/api/routes/agents.ts`
- Modify: `packages/core/src/api/routes/admin.ts`

- [ ] **Step 1: Create agents route**

```typescript
// packages/core/src/api/routes/agents.ts
import type { FastifyInstance } from 'fastify'
import { AgentRegistry } from '../../agents/registry.js'
import { PermissionGate } from '../../agents/permission-gate.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../../config.js'

export async function agentRoutes(
  fastify: FastifyInstance,
  opts: { registry: AgentRegistry; gate: PermissionGate },
) {
  const config = loadConfig()

  // GET /api/admin/agents
  fastify.get('/api/admin/agents', async () => {
    return opts.registry.list()
  })

  // POST /api/admin/agents
  fastify.post<{
    Body: { name: string; role: string; soul: string; tools: string[]; modelPref?: string }
  }>('/api/admin/agents', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'role', 'soul', 'tools'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          soul: { type: 'string' },
          tools: { type: 'array', items: { type: 'string' } },
          modelPref: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { name, role, soul, tools, modelPref } = req.body
    const soulsDir = join(config.dataDir, 'agents', 'souls')
    mkdirSync(soulsDir, { recursive: true })
    // ID is generated inside create(), soul file written after
    const id = opts.registry.create({ name, role, soulPath: '', tools, modelPref })
    const soulPath = join(soulsDir, `${id}.md`)
    writeFileSync(soulPath, soul, 'utf8')
    opts.registry.update(id, { soulPath })
    return reply.status(201).send(opts.registry.get(id))
  })

  // PATCH /api/admin/agents/:id
  fastify.patch<{
    Params: { id: string }
    Body: { name?: string; role?: string; soul?: string; tools?: string[]; modelPref?: string; active?: boolean }
  }>('/api/admin/agents/:id', async (req, reply) => {
    const agent = opts.registry.get(req.params.id)
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })
    const { soul, ...rest } = req.body
    if (soul !== undefined) writeFileSync(agent.soulPath, soul, 'utf8')
    opts.registry.update(req.params.id, rest)
    return opts.registry.get(req.params.id)
  })

  // DELETE /api/admin/agents/:id
  fastify.delete<{ Params: { id: string } }>('/api/admin/agents/:id', async (req, reply) => {
    try {
      opts.registry.delete(req.params.id)
      return reply.status(204).send()
    } catch (e: any) {
      return reply.status(403).send({ error: e.message })
    }
  })

  // POST /api/admin/approvals/:id
  fastify.post<{
    Params: { id: string }
    Body: { decision: 'approve' | 'deny' | 'always_allow'; agentId?: string; toolName?: string }
  }>('/api/admin/approvals/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['decision'],
        properties: { decision: { type: 'string', enum: ['approve', 'deny', 'always_allow'] } },
      },
    },
  }, async (req, reply) => {
    const { decision, agentId, toolName } = req.body
    if (decision === 'always_allow' && agentId && toolName) {
      opts.gate.setAlwaysAllow(agentId, toolName)
    }
    const resolved = opts.gate.resolveApproval(req.params.id, decision === 'deny' ? 'denied' : 'approved')
    if (!resolved) return reply.status(404).send({ error: 'Approval not found or already resolved' })
    return reply.send({ ok: true })
  })
}
```

- [ ] **Step 2: Register agentRoutes in server.ts or index.ts**

Find `packages/core/src/index.ts` (or `server.ts`) and add the registration:

```typescript
import { agentRoutes } from './api/routes/agents.js'
// inside the server setup, after adminRoutes:
await fastify.register(agentRoutes, { registry: agentRegistry, gate })
```

- [ ] **Step 3: Build**

```bash
cd packages/core && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/api/routes/agents.ts
git commit -m "feat(api): add agent CRUD routes and approval endpoint"
```

---

### Task 13: Web UI — ApprovalCard + ActionLogPanel

**Files:**
- Create: `packages/web/src/components/ApprovalCard.tsx`
- Create: `packages/web/src/components/ActionLogPanel.tsx`

- [ ] **Step 1: Create ApprovalCard**

```tsx
// packages/web/src/components/ApprovalCard.tsx
import { coreClient } from '../api/client'

interface Props {
  approvalId: string
  agentName: string
  toolName: string
  cmd: string
  agentId: string
  onResolved: () => void
}

export function ApprovalCard({ approvalId, agentName, toolName, cmd, agentId, onResolved }: Props) {
  const decide = async (decision: 'approve' | 'deny' | 'always_allow') => {
    await coreClient.resolveApproval(approvalId, decision, agentId, toolName)
    onResolved()
  }

  return (
    <div className="my-3 border border-amber-500/40 rounded-xl bg-gray-900/80 p-4 text-sm">
      <div className="text-amber-400 font-mono text-xs mb-2 tracking-wide">
        {agentName.toUpperCase()} WANTS TO USE · {toolName}
      </div>
      <pre className="text-gray-300 bg-gray-950 rounded p-2 text-xs overflow-x-auto mb-3">{cmd}</pre>
      <div className="flex gap-2">
        <button
          onClick={() => decide('approve')}
          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-xs font-semibold transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => decide('deny')}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
        >
          Deny
        </button>
        <button
          onClick={() => decide('always_allow')}
          className="px-3 py-1.5 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
        >
          Always allow for {agentName}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ActionLogPanel**

```tsx
// packages/web/src/components/ActionLogPanel.tsx
import { useState } from 'react'

interface Action {
  toolName: string
  decision: string
  durationMs: number
}

interface Props {
  actions: Action[]
}

export function ActionLogPanel({ actions }: Props) {
  const [open, setOpen] = useState(false)
  if (actions.length === 0) return null

  const summary = [...new Map(actions.map(a => [a.toolName, a])).values()]
    .map(a => a.toolName)
    .join(' · ')

  return (
    <div className="mt-2 text-xs text-gray-500">
      <button
        onClick={() => setOpen(o => !o)}
        className="hover:text-gray-300 transition-colors font-mono"
      >
        {open ? '▼' : '▶'} Actions: {summary}
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-3 border-l border-gray-800">
          {actions.map((a, i) => (
            <div key={i} className="flex gap-3">
              <span className={a.decision === 'allow' || a.decision === 'approved' ? 'text-cyan-600' : 'text-red-600'}>
                {a.decision === 'allow' || a.decision === 'approved' ? '✓' : '✗'}
              </span>
              <span className="text-gray-400 font-mono">{a.toolName}</span>
              <span className="text-gray-600">{a.durationMs}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add resolveApproval to coreClient**

In `packages/web/src/api/client.ts`, add:

```typescript
  async resolveApproval(
    approvalId: string,
    decision: 'approve' | 'deny' | 'always_allow',
    agentId: string,
    toolName: string,
  ): Promise<void> {
    await fetch(`${this.base}/api/admin/approvals/${approvalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': this.adminToken ?? '' },
      body: JSON.stringify({ decision, agentId, toolName }),
    })
  }
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/ApprovalCard.tsx packages/web/src/components/ActionLogPanel.tsx packages/web/src/api/client.ts
git commit -m "feat(ui): add ApprovalCard and ActionLogPanel components"
```

---

### Task 14: Web UI — Agents Page

**Files:**
- Create: `packages/web/src/pages/Agents.tsx`
- Create: `packages/web/src/components/AgentCard.tsx`
- Create: `packages/web/src/components/AgentEditor.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Create AgentCard**

```tsx
// packages/web/src/components/AgentCard.tsx
interface Agent {
  id: string
  name: string
  role: string
  tools: string[]
  builtIn: boolean
  active: boolean
}

interface Props {
  agent: Agent
  onEdit: (agent: Agent) => void
  onDelete: (id: string) => void
}

export function AgentCard({ agent, onEdit, onDelete }: Props) {
  return (
    <div className="border border-gray-800 rounded-xl p-4 bg-gray-900 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-medium text-sm">{agent.name}</span>
            {agent.builtIn && (
              <span className="text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">built-in</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mb-2">{agent.role}</div>
          <div className="text-xs text-gray-600">{agent.tools.length} tools</div>
        </div>
        {!agent.builtIn && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onEdit(agent)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(agent.id)}
              className="text-xs text-red-600 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AgentEditor**

```tsx
// packages/web/src/components/AgentEditor.tsx
import { useState } from 'react'

const ALL_TOOLS = [
  { name: 'read_file', category: 'File', reversible: true },
  { name: 'write_file', category: 'File', reversible: false },
  { name: 'list_dir', category: 'File', reversible: true },
  { name: 'delete_file', category: 'File', reversible: false },
  { name: 'run_command', category: 'Shell', reversible: false },
  { name: 'git_status', category: 'Git', reversible: true },
  { name: 'git_diff', category: 'Git', reversible: true },
  { name: 'git_commit', category: 'Git', reversible: false },
  { name: 'git_log', category: 'Git', reversible: true },
  { name: 'query_db', category: 'Database', reversible: false },
  { name: 'http_get', category: 'Web', reversible: true },
]

interface Props {
  initial?: { name: string; role: string; soul: string; tools: string[] }
  onSave: (data: { name: string; role: string; soul: string; tools: string[] }) => Promise<void>
  onCancel: () => void
}

export function AgentEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? '')
  const [soul, setSoul] = useState(initial?.soul ?? '')
  const [tools, setTools] = useState<string[]>(initial?.tools ?? [])
  const [saving, setSaving] = useState(false)

  const toggleTool = (t: string) =>
    setTools(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const tokenEstimate = Math.round(soul.split(/\s+/).length * 1.3)
  const tokenPct = Math.round((tokenEstimate / 1500) * 100)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ name, role, soul, tools }) } finally { setSaving(false) }
  }

  const categories = [...new Set(ALL_TOOLS.map(t => t.category))]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            placeholder="e.g. Legal Officer"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Role</label>
          <input
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            placeholder="e.g. Legal & compliance"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs text-gray-400">Soul (identity + instructions)</label>
          <span className={`text-xs ${tokenPct > 90 ? 'text-amber-400' : 'text-gray-600'}`}>
            ~{tokenEstimate} / 1500 tokens ({tokenPct}%)
          </span>
        </div>
        <textarea
          value={soul}
          onChange={e => setSoul(e.target.value)}
          rows={10}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 resize-y"
          placeholder="# Agent Name&#10;&#10;You are..."
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">Tool permissions</label>
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat}>
              <div className="text-xs text-gray-600 mb-1">{cat}</div>
              <div className="flex flex-wrap gap-2">
                {ALL_TOOLS.filter(t => t.category === cat).map(t => (
                  <label key={t.name} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tools.includes(t.name)}
                      onChange={() => toggleTool(t.name)}
                      className="accent-cyan-500"
                    />
                    <span className="text-xs text-gray-300">{t.name}</span>
                    {!t.reversible && (
                      <span className="text-xs text-amber-600">⚠</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !name || !role}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-semibold rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save Agent'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Agents page**

```tsx
// packages/web/src/pages/Agents.tsx
import { useState, useEffect } from 'react'
import { AgentCard } from '../components/AgentCard'
import { AgentEditor } from '../components/AgentEditor'

interface Agent {
  id: string; name: string; role: string; tools: string[]; builtIn: boolean; active: boolean
}

const BASE = `http://localhost:${import.meta.env.VITE_CORE_PORT ?? 4747}`

export function Agents({ onNav }: { onNav: (page: string) => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Agent | null>(null)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const res = await fetch(`${BASE}/api/admin/agents`, { headers: { 'x-admin-token': '' } })
    if (res.ok) setAgents(await res.json())
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: { name: string; role: string; soul: string; tools: string[] }) => {
    if (editing) {
      await fetch(`${BASE}/api/admin/agents/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': '' },
        body: JSON.stringify(data),
      })
    } else {
      await fetch(`${BASE}/api/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': '' },
        body: JSON.stringify(data),
      })
    }
    setEditing(null)
    setAdding(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    await fetch(`${BASE}/api/admin/agents/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': '' },
    })
    load()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="fixed top-0 left-0 right-0 z-10 bg-gray-950 border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <span className="text-sm text-gray-400 font-mono">COASTAL CLAW</span>
        <div className="flex gap-4">
          <button onClick={() => onNav('chat')} className="text-sm text-gray-400 hover:text-white transition-colors">Chat</button>
          <button onClick={() => onNav('models')} className="text-sm text-gray-400 hover:text-white transition-colors">Models</button>
          <button className="text-sm text-cyan-400">Agents</button>
        </div>
      </nav>

      <div className="pt-20 px-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-medium">Agent Workforce</h1>
          {!adding && !editing && (
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg text-sm transition-colors"
            >
              + Add Agent
            </button>
          )}
        </div>

        {(adding || editing) && (
          <div className="border border-gray-800 rounded-xl p-5 bg-gray-900 mb-6">
            <h2 className="text-sm font-medium mb-4">{editing ? 'Edit Agent' : 'New Agent'}</h2>
            <AgentEditor
              initial={editing ? { ...editing, soul: '' } : undefined}
              onSave={handleSave}
              onCancel={() => { setAdding(false); setEditing(null) }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={a => { setEditing(a); setAdding(false) }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire Agents page into App.tsx**

In `packages/web/src/App.tsx`, add `'agents'` to the page state and import `Agents`:

```tsx
import { Agents } from './pages/Agents'

// change page state type:
const [page, setPage] = useState<'chat' | 'models' | 'agents'>('chat')

// add before the Chat return:
if (page === 'agents') return <Agents onNav={(p) => setPage(p as any)} />

// update Chat onNav:
<Chat sessionId={sessionId} onNav={(p) => setPage(p as any)} />
```

Also update the `Chat` component's nav button to expose Agents:

In `packages/web/src/pages/Chat.tsx`, add:

```tsx
<button onClick={() => onNav('agents')} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
  Agents
</button>
```

- [ ] **Step 5: Build web**

```bash
cd packages/web && pnpm build
```

Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/pages/Agents.tsx packages/web/src/components/AgentCard.tsx packages/web/src/components/AgentEditor.tsx packages/web/src/App.tsx packages/web/src/pages/Chat.tsx
git commit -m "feat(ui): add Agents page with workforce panel and agent editor"
```

---

### Task 15: MCP Adapter (Deferred to follow-up)

The MCP adapter (Tasks 13-14 in the spec's build sequence) requires spawning child processes and SSE connections. This is a self-contained addition with no impact on the existing loop — it plugs into `ToolRegistry` via `registry.registerMcpServer()`. Tag for implementation after the core loop is verified working end-to-end:

```bash
git tag -a "agentic-tool-use-v1" -m "Core agentic loop complete — MCP adapter deferred"
```

---

### Task 16: Full Build + Test Run

- [ ] **Step 1: Run all core tests**

```bash
cd packages/core && pnpm test
```

Expected: all pass

- [ ] **Step 2: Run all web tests**

```bash
cd packages/web && pnpm test
```

Expected: all pass

- [ ] **Step 3: Build everything**

```bash
cd /c/Users/John/CoastalClaw && pnpm build
```

Expected: exits 0, no TypeScript errors

- [ ] **Step 4: Start and verify**

```bash
pnpm start:fresh
```

Open `http://localhost:5173`, send a message — verify the agent loop runs and a domain label appears in the chat header.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Sub-project A — agentic tool-use layer with soul files, core tools, permission gate, and agent workforce UI"
git push
```
