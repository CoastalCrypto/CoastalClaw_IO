# Pipeline Execution Live View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pipeline execution visible and interactive — async run returns immediately, each stage streams live tool calls via SSE, and users can steer the active agent by typing mid-run.

**Architecture:** `POST /api/pipeline/run` returns a `{ runId }` immediately and kicks off background execution. The existing `EventBus` is extended with pipeline-specific event types; a new SSE endpoint filters the stream by `runId`. A lightweight steer queue lets the frontend inject messages that the `AgenticLoop` reads between tool calls.

**Tech Stack:** Fastify (SSE), better-sqlite3 (pipeline store), vitest (tests), React + TypeScript (frontend), CoastalClaw EventBus (existing singleton)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/core/src/events/types.ts` | Modify | Add 7 pipeline event types |
| `packages/core/src/pipeline/steer-queue.ts` | Create | In-memory `Map<runId, string[]>` for steer messages |
| `packages/core/src/pipeline/store.ts` | Create | SQLite CRUD for saved pipeline definitions |
| `packages/core/src/pipeline/runner.ts` | Create | Async background runner — wraps AgentPipeline, emits events, handles loop-back |
| `packages/core/src/agents/loop.ts` | Modify | Accept steer queue + runId; drain after each tool batch |
| `packages/core/src/api/routes/pipeline.ts` | Modify | Add async run, SSE stream, steer, pipeline CRUD endpoints |
| `packages/core/src/server.ts` | Modify | Wire PipelineStore + SteerQueue + AsyncPipelineRunner into pipelineRoutes |
| `packages/web/src/hooks/usePipelineRun.ts` | Create | SSE subscription hook — builds stage state from events |
| `packages/web/src/pages/PipelineRun.tsx` | Create | Live execution view (chat-style threads, steer bar) |
| `packages/web/src/pages/Pipeline.tsx` | Modify | Name field, save, library panel, loop controls, Ralph Loop stage, async run |

---

## Chunk 1: Backend

### Task 1: Add pipeline event types

**Files:**
- Modify: `packages/core/src/events/types.ts`

- [ ] **Step 1: Add the 7 new event interfaces and update the union**

Open `packages/core/src/events/types.ts` and append before the final `export type AgentEvent` union:

```typescript
export interface PipelineStartEvent {
  type: 'pipeline_start'
  ts: number
  runId: string
  pipelineId?: string
  stageCount: number
}

export interface StageStartEvent {
  type: 'stage_start'
  ts: number
  runId: string
  stageIdx: number
  agentId: string
  agentName: string
  iteration: number
}

export interface StageSteerEvent {
  type: 'stage_steer'
  ts: number
  runId: string
  stageIdx: number
  message: string
}

export interface LoopIterationEvent {
  type: 'loop_iteration'
  ts: number
  runId: string
  fromStageIdx: number
  toStageIdx: number
  iteration: number
  condition: string
}

export interface StageEndEvent {
  type: 'stage_end'
  ts: number
  runId: string
  stageIdx: number
  agentId: string
  output: string
  durationMs: number
  iteration: number
}

export interface PipelineDoneEvent {
  type: 'pipeline_done'
  ts: number
  runId: string
  finalOutput: string
  totalDurationMs: number
}

export interface PipelineErrorEvent {
  type: 'pipeline_error'
  ts: number
  runId: string
  stageIdx: number
  error: string
}
```

Then update `AgentEventType` to add the 7 new literal strings, and update the `AgentEvent` union to include all 7 new interfaces.

Final `AgentEventType`:
```typescript
export type AgentEventType =
  | 'tool_call_start'
  | 'tool_call_end'
  | 'session_start'
  | 'session_complete'
  | 'token_counted'
  | 'job_run'
  | 'pr_open'
  | 'pipeline_start'
  | 'stage_start'
  | 'stage_steer'
  | 'loop_iteration'
  | 'stage_end'
  | 'pipeline_done'
  | 'pipeline_error'
```

Final `AgentEvent` union (append the 7 new types):
```typescript
export type AgentEvent =
  | ToolCallStartEvent
  | ToolCallEndEvent
  | SessionStartEvent
  | SessionCompleteEvent
  | TokenCountedEvent
  | JobRunEvent
  | PrOpenEvent
  | PipelineStartEvent
  | StageStartEvent
  | StageSteerEvent
  | LoopIterationEvent
  | StageEndEvent
  | PipelineDoneEvent
  | PipelineErrorEvent
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/core && pnpm tsc --noEmit
```
Expected: no errors on types.ts

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/events/types.ts
git commit -m "feat: add pipeline SSE event types"
```

---

### Task 2: Create steer queue

**Files:**
- Create: `packages/core/src/pipeline/steer-queue.ts`
- Create: `packages/core/src/pipeline/steer-queue.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/pipeline/steer-queue.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SteerQueue } from './steer-queue.js'

describe('SteerQueue', () => {
  it('drains queued messages for a runId', () => {
    const q = new SteerQueue()
    q.push('run1', 'hello')
    q.push('run1', 'world')
    expect(q.drain('run1')).toEqual(['hello', 'world'])
  })

  it('returns empty array when no messages', () => {
    const q = new SteerQueue()
    expect(q.drain('no-such-run')).toEqual([])
  })

  it('draining clears the queue', () => {
    const q = new SteerQueue()
    q.push('run1', 'msg')
    q.drain('run1')
    expect(q.drain('run1')).toEqual([])
  })

  it('cleanup removes the entry', () => {
    const q = new SteerQueue()
    q.push('run1', 'msg')
    q.cleanup('run1')
    expect(q.drain('run1')).toEqual([])
  })

  it('isolates different runIds', () => {
    const q = new SteerQueue()
    q.push('run1', 'a')
    q.push('run2', 'b')
    expect(q.drain('run1')).toEqual(['a'])
    expect(q.drain('run2')).toEqual(['b'])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/core && pnpm test -- steer-queue
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement SteerQueue**

Create `packages/core/src/pipeline/steer-queue.ts`:

```typescript
export class SteerQueue {
  private queues = new Map<string, string[]>()

  push(runId: string, message: string): void {
    if (!this.queues.has(runId)) this.queues.set(runId, [])
    this.queues.get(runId)!.push(message)
  }

  drain(runId: string): string[] {
    const msgs = this.queues.get(runId) ?? []
    this.queues.set(runId, [])
    return msgs
  }

  cleanup(runId: string): void {
    this.queues.delete(runId)
  }
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd packages/core && pnpm test -- steer-queue
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pipeline/steer-queue.ts packages/core/src/pipeline/steer-queue.test.ts
git commit -m "feat: add SteerQueue for pipeline live steering"
```

---

### Task 3: Create pipeline store

**Files:**
- Create: `packages/core/src/pipeline/store.ts`
- Create: `packages/core/src/pipeline/store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/pipeline/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PipelineStore } from './store.js'
import Database from 'better-sqlite3'

let db: ReturnType<typeof Database>
let store: PipelineStore

beforeEach(() => {
  db = new Database(':memory:')
  store = new PipelineStore(db)
})
afterEach(() => db.close())

describe('PipelineStore', () => {
  it('creates and retrieves a pipeline', () => {
    const p = store.create('My Pipeline', [{ agentId: 'general', type: 'agent' }])
    expect(p.name).toBe('My Pipeline')
    expect(p.stages).toHaveLength(1)
    expect(store.get(p.id)?.name).toBe('My Pipeline')
  })

  it('lists all pipelines', () => {
    store.create('A', [])
    store.create('B', [])
    expect(store.list()).toHaveLength(2)
  })

  it('updates a pipeline', () => {
    const p = store.create('Old', [])
    const updated = store.update(p.id, { name: 'New' })
    expect(updated?.name).toBe('New')
  })

  it('deletes a pipeline', () => {
    const p = store.create('Del', [])
    store.delete(p.id)
    expect(store.get(p.id)).toBeUndefined()
  })

  it('returns undefined for unknown id', () => {
    expect(store.get('no-such-id')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests — confirm fail**

```bash
cd packages/core && pnpm test -- pipeline/store
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement PipelineStore**

Create `packages/core/src/pipeline/store.ts`:

```typescript
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface SavedStageConfig {
  agentId: string
  type: 'agent' | 'ralph-loop'
  modelPref?: string
  loopBack?: { toStageIdx: number; condition: string; maxIterations: number }
  ralphLoop?: { cron?: string; condition?: string }
}

export interface SavedPipeline {
  id: string
  name: string
  stages: SavedStageConfig[]
  createdAt: number
  updatedAt: number
}

export class PipelineStore {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        stages     TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  }

  list(): SavedPipeline[] {
    return (this.db.prepare('SELECT * FROM pipelines ORDER BY updated_at DESC').all() as any[])
      .map(this.row)
  }

  get(id: string): SavedPipeline | undefined {
    const row = this.db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id) as any
    return row ? this.row(row) : undefined
  }

  create(name: string, stages: SavedStageConfig[]): SavedPipeline {
    const now = Date.now()
    const id = randomUUID()
    this.db.prepare(
      'INSERT INTO pipelines (id, name, stages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, JSON.stringify(stages), now, now)
    return this.get(id)!
  }

  update(id: string, patch: Partial<Pick<SavedPipeline, 'name' | 'stages'>>): SavedPipeline | undefined {
    const existing = this.get(id)
    if (!existing) return undefined
    const name = patch.name ?? existing.name
    const stages = patch.stages ?? existing.stages
    this.db.prepare(
      'UPDATE pipelines SET name = ?, stages = ?, updated_at = ? WHERE id = ?'
    ).run(name, JSON.stringify(stages), Date.now(), id)
    return this.get(id)!
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM pipelines WHERE id = ?').run(id)
  }

  private row(r: any): SavedPipeline {
    return {
      id: r.id,
      name: r.name,
      stages: JSON.parse(r.stages),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd packages/core && pnpm test -- pipeline/store
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pipeline/store.ts packages/core/src/pipeline/store.test.ts
git commit -m "feat: add PipelineStore for saved pipeline definitions"
```

---

### Task 4: Modify AgenticLoop to drain steer queue

**Files:**
- Modify: `packages/core/src/agents/loop.ts`

The steer queue drain happens **after tool call results are pushed to messages**, inside the while loop, before the next `chatWithTools()` call. This ensures the steering message is visible to the LLM on its next reasoning step.

- [ ] **Step 1: Add SteerQueue import and run() params**

At the top of `packages/core/src/agents/loop.ts`, add the import:

```typescript
import type { SteerQueue } from '../pipeline/steer-queue.js'
```

Add two optional parameters to the `run()` method signature (after `images?`):

```typescript
async run(
  session: AgentSession,
  userMessage: string,
  sessionId: string,
  history: ChatMessage[],
  budget?: IterationBudget,
  signal?: AbortSignal,
  images?: string[],
  steerQueue?: SteerQueue,
  runId?: string,
): Promise<LoopResult>
```

- [ ] **Step 2: Inject steer messages after tool call batch**

Inside the while loop, after the closing brace of the `if (!hasWrite) { ... } else { ... }` block (around line 115, after tool results are pushed), add:

```typescript
        // Drain any steering messages from the user and inject as user turns
        if (steerQueue && runId) {
          const steered = steerQueue.drain(runId)
          for (const msg of steered) {
            messages.push({ role: 'user', content: `[Live steering]: ${msg}` })
            eventBus.publish({ type: 'stage_steer', ts: Date.now(), runId, stageIdx: -1, message: msg })
          }
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/core && pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/agents/loop.ts
git commit -m "feat: inject steer queue messages into AgenticLoop between tool calls"
```

---

### Task 5: Create async pipeline runner

**Files:**
- Create: `packages/core/src/pipeline/runner.ts`

The `AsyncPipelineRunner` wraps `AgentPipeline`'s logic but runs in a background Promise, emits events, and supports loop-back. It does NOT modify `AgentPipeline` — existing sync callers keep working.

- [ ] **Step 1: Create the runner**

Create `packages/core/src/pipeline/runner.ts`:

```typescript
import { randomUUID } from 'node:crypto'
import { AgentRegistry } from '../agents/registry.js'
import { ModelRouter } from '../models/router.js'
import { ToolRegistry } from '../tools/registry.js'
import { PermissionGate } from '../agents/permission-gate.js'
import { ActionLog } from '../agents/action-log.js'
import { PersonaManager } from '../persona/manager.js'
import { AgentSession } from '../agents/session.js'
import { AgenticLoop } from '../agents/loop.js'
import { eventBus } from '../events/bus.js'
import type { SteerQueue } from './steer-queue.js'
import type { SavedStageConfig } from './store.js'

export interface RunStage {
  agentId: string
  modelPref?: string
  type?: 'agent' | 'ralph-loop'
  loopBack?: { toStageIdx: number; condition: string; maxIterations: number }
}

export interface ActiveRun {
  runId: string
  status: 'running' | 'done' | 'error' | 'aborted'
  stageIdx: number
  abort: () => void
  startedAt: number
}

export class AsyncPipelineRunner {
  private runs = new Map<string, ActiveRun>()

  constructor(
    private registry: AgentRegistry,
    private router: ModelRouter,
    private toolRegistry: ToolRegistry,
    private gate: PermissionGate,
    private log: ActionLog,
    private personaMgr: PersonaManager,
    private steerQueue: SteerQueue,
  ) {}

  start(stages: RunStage[], input: string, pipelineId?: string): { runId: string } {
    const runId = randomUUID()
    const controller = new AbortController()
    const run: ActiveRun = {
      runId,
      status: 'running',
      stageIdx: 0,
      abort: () => controller.abort(),
      startedAt: Date.now(),
    }
    this.runs.set(runId, run)

    // Fire and forget — errors are published as pipeline_error events
    this._execute(run, stages, input, pipelineId, controller.signal).catch(() => {})

    return { runId }
  }

  getStatus(runId: string): ActiveRun | undefined {
    return this.runs.get(runId)
  }

  abort(runId: string): boolean {
    const run = this.runs.get(runId)
    if (!run || run.status !== 'running') return false
    run.abort()
    run.status = 'aborted'
    return true
  }

  private async _execute(
    run: ActiveRun,
    stages: RunStage[],
    initialInput: string,
    pipelineId: string | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    const { runId } = run
    const startedAt = run.startedAt
    eventBus.publish({ type: 'pipeline_start', ts: Date.now(), runId, pipelineId, stageCount: stages.length })

    let currentInput = initialInput
    let stageIdx = 0
    // Track loop iterations per stage
    const loopIterations = new Map<number, number>()

    try {
      while (stageIdx < stages.length) {
        if (signal.aborted) break

        const stage = stages[stageIdx]

        // Ralph Loop stage: skip execution, just marks the end (cron registration is done at save time)
        if (stage.type === 'ralph-loop') { stageIdx++; continue }

        const agentConfig = this.registry.get(stage.agentId)
        if (!agentConfig) throw new Error(`Agent not found: ${stage.agentId}`)

        const iteration = loopIterations.get(stageIdx) ?? 0
        run.stageIdx = stageIdx
        eventBus.publish({ type: 'stage_start', ts: Date.now(), runId, stageIdx, agentId: agentConfig.id, agentName: agentConfig.name, iteration })

        const toolDefs = this.toolRegistry.getDefinitionsFor(agentConfig.tools)
        const session = new AgentSession(agentConfig, toolDefs, this.personaMgr.get())
        const loop = new AgenticLoop(this.router.ollama, this.toolRegistry, this.gate, this.log)

        const stageStart = Date.now()
        const result = await loop.run(
          session, currentInput, `${runId}_stage_${stageIdx}`, [],
          undefined, signal, undefined, this.steerQueue, runId,
        )

        const output = result.reply
        eventBus.publish({ type: 'stage_end', ts: Date.now(), runId, stageIdx, agentId: agentConfig.id, output, durationMs: Date.now() - stageStart, iteration })

        // Check loop-back condition
        const loopBack = stage.loopBack
        if (loopBack) {
          const currentIteration = loopIterations.get(stageIdx) ?? 0
          const conditionMet = !output.toLowerCase().includes(loopBack.condition.toLowerCase())
          if (conditionMet && currentIteration < loopBack.maxIterations - 1) {
            loopIterations.set(stageIdx, currentIteration + 1)
            eventBus.publish({ type: 'loop_iteration', ts: Date.now(), runId, fromStageIdx: stageIdx, toStageIdx: loopBack.toStageIdx, iteration: currentIteration + 1, condition: loopBack.condition })
            stageIdx = loopBack.toStageIdx
            currentInput = output
            continue
          }
        }

        currentInput = output
        stageIdx++
      }

      run.status = signal.aborted ? 'aborted' : 'done'
      eventBus.publish({ type: 'pipeline_done', ts: Date.now(), runId, finalOutput: currentInput, totalDurationMs: Date.now() - startedAt })
    } catch (e: unknown) {
      run.status = 'error'
      const error = e instanceof Error ? e.message : String(e)
      eventBus.publish({ type: 'pipeline_error', ts: Date.now(), runId, stageIdx: run.stageIdx, error })
    } finally {
      this.steerQueue.cleanup(runId)
    }
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd packages/core && pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/pipeline/runner.ts
git commit -m "feat: add AsyncPipelineRunner with event emission and loop-back support"
```

---

### Task 6: Update pipeline API routes

**Files:**
- Modify: `packages/core/src/api/routes/pipeline.ts`

- [ ] **Step 1: Replace the route file**

Replace the entire contents of `packages/core/src/api/routes/pipeline.ts`:

```typescript
import type { FastifyInstance } from 'fastify'
import type { AgentRegistry } from '../../agents/registry.js'
import type { ModelRouter } from '../../models/router.js'
import type { ToolRegistry } from '../../tools/registry.js'
import type { PermissionGate } from '../../agents/permission-gate.js'
import type { ActionLog } from '../../agents/action-log.js'
import type { PersonaManager } from '../../persona/manager.js'
import type { SteerQueue } from '../../pipeline/steer-queue.js'
import type { PipelineStore } from '../../pipeline/store.js'
import type { AsyncPipelineRunner } from '../../pipeline/runner.js'
import { AgentPipeline } from '../../agents/pipeline.js'
import { eventBus } from '../../events/bus.js'
import type { AgentEvent } from '../../events/types.js'

export async function pipelineRoutes(
  fastify: FastifyInstance,
  opts: {
    registry: AgentRegistry
    router: ModelRouter
    toolRegistry: ToolRegistry
    gate: PermissionGate
    log: ActionLog
    personaMgr: PersonaManager
    steerQueue: SteerQueue
    pipelineStore: PipelineStore
    runner: AsyncPipelineRunner
  },
) {
  const { registry, router, toolRegistry, gate, log, personaMgr, steerQueue, pipelineStore, runner } = opts

  // ── Existing sync run (kept for backward compat) ──────────────────────────
  fastify.post<{
    Body: { stages: Array<{ agentId: string; modelPref?: string }>; input: string; sessionId?: string }
  }>('/api/pipeline/run', {
    schema: {
      body: {
        type: 'object',
        required: ['stages', 'input'],
        properties: {
          stages: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string' }, modelPref: { type: 'string' } } } },
          input: { type: 'string', minLength: 1, maxLength: 16384 },
          sessionId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { stages, input, sessionId } = req.body
    for (const stage of stages) {
      const agent = registry.get(stage.agentId)
      if (!agent) return reply.status(400).send({ error: `Agent not found: ${stage.agentId}` })
      if (!agent.active) return reply.status(400).send({ error: `Agent is offline: ${stage.agentId}` })
    }
    const pipeline = new AgentPipeline(registry, router, toolRegistry, gate, log, personaMgr)
    try {
      const result = await pipeline.run(stages, input, sessionId)
      return reply.send(result)
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  // ── Async run ─────────────────────────────────────────────────────────────
  fastify.post<{
    Body: { stages: Array<{ agentId: string; modelPref?: string; type?: 'agent' | 'ralph-loop'; loopBack?: { toStageIdx: number; condition: string; maxIterations: number } }>; input: string; pipelineId?: string }
  }>('/api/pipeline/run/async', async (req, reply) => {
    const { stages, input, pipelineId } = req.body
    for (const stage of stages) {
      if (stage.type === 'ralph-loop') continue
      const agent = registry.get(stage.agentId)
      if (!agent) return reply.status(400).send({ error: `Agent not found: ${stage.agentId}` })
      if (!agent.active) return reply.status(400).send({ error: `Agent is offline: ${stage.agentId}` })
    }
    const { runId } = runner.start(stages, input, pipelineId)
    return reply.status(202).send({ runId })
  })

  // ── Run status ────────────────────────────────────────────────────────────
  fastify.get<{ Params: { runId: string } }>('/api/pipeline/run/:runId', async (req, reply) => {
    const run = runner.getStatus(req.params.runId)
    if (!run) return reply.status(404).send({ error: 'Run not found' })
    return reply.send({ runId: run.runId, status: run.status, stageIdx: run.stageIdx, startedAt: run.startedAt })
  })

  // ── SSE stream for a run ──────────────────────────────────────────────────
  fastify.get<{ Params: { runId: string } }>('/api/pipeline/run/:runId/events', async (req, reply) => {
    const { runId } = req.params
    const run = runner.getStatus(runId)
    if (!run) return reply.status(404).send({ error: 'Run not found' })

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const send = (event: AgentEvent) => {
      if (!('runId' in event) || (event as any).runId !== runId) return
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    // Replay recent history filtered to this runId
    eventBus.getHistory(200).filter(e => 'runId' in e && (e as any).runId === runId).forEach(send)

    eventBus.onAgent(send)

    // Close stream when pipeline finishes
    const cleanup = (e: AgentEvent) => {
      if (!('runId' in e) || (e as any).runId !== runId) return
      if (e.type === 'pipeline_done' || e.type === 'pipeline_error') {
        eventBus.offAgent(send)
        eventBus.offAgent(cleanup)
        reply.raw.end()
      }
    }
    eventBus.onAgent(cleanup)

    req.raw.on('close', () => {
      eventBus.offAgent(send)
      eventBus.offAgent(cleanup)
    })
  })

  // ── Steer active run ──────────────────────────────────────────────────────
  fastify.post<{ Params: { runId: string }; Body: { message: string } }>(
    '/api/pipeline/run/:runId/steer',
    async (req, reply) => {
      const { runId } = req.params
      const run = runner.getStatus(runId)
      if (!run) return reply.status(404).send({ error: 'Run not found' })
      if (run.status !== 'running') return reply.status(409).send({ error: 'Run is not active' })
      steerQueue.push(runId, req.body.message)
      return reply.status(204).send()
    },
  )

  // ── Abort run ─────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { runId: string } }>('/api/pipeline/run/:runId', async (req, reply) => {
    const ok = runner.abort(req.params.runId)
    return ok ? reply.status(204).send() : reply.status(404).send({ error: 'Run not found or not active' })
  })

  // ── Saved pipeline CRUD ───────────────────────────────────────────────────
  fastify.get('/api/admin/pipelines', async (_req, reply) => {
    return reply.send(pipelineStore.list())
  })

  fastify.post<{ Body: { name: string; stages: any[] } }>('/api/admin/pipelines', async (req, reply) => {
    const { name, stages } = req.body
    if (!name) return reply.status(400).send({ error: 'name is required' })
    return reply.status(201).send(pipelineStore.create(name, stages ?? []))
  })

  fastify.get<{ Params: { id: string } }>('/api/admin/pipelines/:id', async (req, reply) => {
    const p = pipelineStore.get(req.params.id)
    return p ? reply.send(p) : reply.status(404).send({ error: 'Not found' })
  })

  fastify.patch<{ Params: { id: string }; Body: { name?: string; stages?: any[] } }>(
    '/api/admin/pipelines/:id',
    async (req, reply) => {
      const updated = pipelineStore.update(req.params.id, req.body)
      return updated ? reply.send(updated) : reply.status(404).send({ error: 'Not found' })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/api/admin/pipelines/:id', async (req, reply) => {
    pipelineStore.delete(req.params.id)
    return reply.status(204).send()
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd packages/core && pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/api/routes/pipeline.ts
git commit -m "feat: add async run, SSE stream, steer, and pipeline CRUD endpoints"
```

---

### Task 7: Wire up in server.ts

**Files:**
- Modify: `packages/core/src/server.ts`

- [ ] **Step 1: Add imports near the top of server.ts**

After the existing `import { SkillGapsLog }` line, add:

```typescript
import { PipelineStore } from './pipeline/store.js'
import { SteerQueue } from './pipeline/steer-queue.js'
import { AsyncPipelineRunner } from './pipeline/runner.js'
```

- [ ] **Step 2: Instantiate and pass to pipelineRoutes**

In server.ts, find the `pipelineRoutes` registration block (around line 116). It currently reads:

```typescript
await fastify.register(pipelineRoutes, {
  registry: agentRegistry,
  router: pipelineRouter,
  toolRegistry: pipelineToolRegistry,
  gate,
  log: pipelineLog,
  personaMgr: pipelinePersonaMgr,
})
```

Replace with:

```typescript
const pipelineStore = new PipelineStore(db)
const steerQueue = new SteerQueue()
const asyncRunner = new AsyncPipelineRunner(
  agentRegistry, pipelineRouter, pipelineToolRegistry, gate, pipelineLog, pipelinePersonaMgr, steerQueue,
)
await fastify.register(pipelineRoutes, {
  registry: agentRegistry,
  router: pipelineRouter,
  toolRegistry: pipelineToolRegistry,
  gate,
  log: pipelineLog,
  personaMgr: pipelinePersonaMgr,
  steerQueue,
  pipelineStore,
  runner: asyncRunner,
})
```

- [ ] **Step 3: TypeScript check + build**

```bash
cd packages/core && pnpm tsc --noEmit && pnpm build
```
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/server.ts
git commit -m "feat: wire AsyncPipelineRunner, PipelineStore, SteerQueue into server"
```

---

## Chunk 2: Frontend

### Task 8: Create usePipelineRun hook

**Files:**
- Create: `packages/web/src/hooks/usePipelineRun.ts`

- [ ] **Step 1: Create the hook**

Create `packages/web/src/hooks/usePipelineRun.ts`:

```typescript
import { useEffect, useRef, useState } from 'react'

export interface LiveToolCall {
  toolName: string
  args: Record<string, unknown>
  result?: string
  durationMs?: number
  status: 'running' | 'done'
}

export interface LiveStage {
  stageIdx: number
  agentId: string
  agentName: string
  status: 'waiting' | 'running' | 'done' | 'error'
  toolCalls: LiveToolCall[]
  steerMessages: string[]
  output?: string
  durationMs?: number
  iteration: number
}

export interface PipelineRunState {
  runId: string
  status: 'running' | 'done' | 'error' | 'aborted'
  stageCount: number
  activeStageIdx: number
  stages: LiveStage[]
  finalOutput?: string
  error?: string
}

export function usePipelineRun(runId: string | null, stageCount: number) {
  const [state, setState] = useState<PipelineRunState | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!runId) return
    setState({
      runId,
      status: 'running',
      stageCount,
      activeStageIdx: 0,
      stages: Array.from({ length: stageCount }, (_, i) => ({
        stageIdx: i, agentId: '', agentName: `Stage ${i + 1}`,
        status: 'waiting', toolCalls: [], steerMessages: [], iteration: 0,
      })),
    })

    const es = new EventSource(`/api/pipeline/run/${runId}/events`)
    esRef.current = es

    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      setState(prev => {
        if (!prev) return prev
        return applyEvent(prev, event)
      })
    }
    es.onerror = () => {
      setState(prev => prev ? { ...prev, status: 'error' } : prev)
      es.close()
    }

    return () => { es.close(); esRef.current = null }
  }, [runId])

  const steer = async (message: string) => {
    if (!runId) return
    await fetch(`/api/pipeline/run/${runId}/steer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  }

  const abort = async () => {
    if (!runId) return
    await fetch(`/api/pipeline/run/${runId}`, { method: 'DELETE' })
  }

  return { state, steer, abort }
}

function applyEvent(state: PipelineRunState, event: any): PipelineRunState {
  const stages = [...state.stages]
  switch (event.type) {
    case 'stage_start': {
      const s = { ...stages[event.stageIdx] }
      s.status = 'running'
      s.agentId = event.agentId
      s.agentName = event.agentName
      s.iteration = event.iteration
      s.toolCalls = []
      stages[event.stageIdx] = s
      return { ...state, activeStageIdx: event.stageIdx, stages }
    }
    case 'tool_call_start': {
      // Match stage by sessionId prefix: runId_stage_N
      const idx = stageIdxFromSession(state.runId, event.sessionId)
      if (idx < 0 || idx >= stages.length) return state
      const s = { ...stages[idx], toolCalls: [...stages[idx].toolCalls] }
      s.toolCalls.push({ toolName: event.toolName, args: event.args, status: 'running' })
      stages[idx] = s
      return { ...state, stages }
    }
    case 'tool_call_end': {
      const idx = stageIdxFromSession(state.runId, event.sessionId)
      if (idx < 0 || idx >= stages.length) return state
      const s = { ...stages[idx], toolCalls: [...stages[idx].toolCalls] }
      const tcIdx = s.toolCalls.findLastIndex(t => t.toolName === event.toolName && t.status === 'running')
      if (tcIdx >= 0) {
        s.toolCalls[tcIdx] = { ...s.toolCalls[tcIdx], status: 'done', durationMs: event.durationMs }
      }
      stages[idx] = s
      return { ...state, stages }
    }
    case 'stage_steer': {
      const idx = state.activeStageIdx
      if (idx < 0 || idx >= stages.length) return state
      const s = { ...stages[idx], steerMessages: [...stages[idx].steerMessages, event.message] }
      stages[idx] = s
      return { ...state, stages }
    }
    case 'stage_end': {
      const s = { ...stages[event.stageIdx] }
      s.status = 'done'
      s.output = event.output
      s.durationMs = event.durationMs
      stages[event.stageIdx] = s
      return { ...state, stages }
    }
    case 'pipeline_done':
      return { ...state, status: 'done', finalOutput: event.finalOutput }
    case 'pipeline_error': {
      if (event.stageIdx >= 0 && event.stageIdx < stages.length) {
        stages[event.stageIdx] = { ...stages[event.stageIdx], status: 'error' }
      }
      return { ...state, status: 'error', error: event.error, stages }
    }
    default:
      return state
  }
}

function stageIdxFromSession(runId: string, sessionId: string): number {
  const prefix = `${runId}_stage_`
  if (!sessionId.startsWith(prefix)) return -1
  return parseInt(sessionId.slice(prefix.length), 10)
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd packages/web && pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/hooks/usePipelineRun.ts
git commit -m "feat: add usePipelineRun hook for SSE pipeline execution state"
```

---

### Task 9: Create PipelineRun page

**Files:**
- Create: `packages/web/src/pages/PipelineRun.tsx`

- [ ] **Step 1: Create the page**

Create `packages/web/src/pages/PipelineRun.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'
import { usePipelineRun, type LiveStage } from '../hooks/usePipelineRun.js'

const PANEL = { background: 'rgba(26,39,68,0.80)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '12px', padding: '16px' }
const PANEL_ACTIVE = { ...PANEL, border: '1px solid rgba(0,212,255,0.30)' }
const BTN = { background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.30)', color: '#00D4FF', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, cursor: 'pointer' }
const BTN_RED = { ...BTN, background: 'rgba(255,82,82,0.10)', border: '1px solid rgba(255,82,82,0.25)', color: '#ff5252' }
const MONO = { fontFamily: 'JetBrains Mono, monospace' }

interface Props {
  runId: string
  pipelineName: string
  stageCount: number
  onBack: () => void
}

export function PipelineRun({ runId, pipelineName, stageCount, onBack }: Props) {
  const { state, steer, abort } = usePipelineRun(runId, stageCount)
  const [steerMsg, setSteerMsg] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-expand the active stage
  useEffect(() => {
    if (state?.activeStageIdx != null) {
      setExpanded(prev => new Set([...prev, state.activeStageIdx]))
    }
  }, [state?.activeStageIdx])

  // Auto-scroll to bottom of active stage
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state?.stages])

  if (!state) return (
    <div className="pt-20 px-4 max-w-3xl mx-auto" style={{ color: '#A0AEC0' }}>
      <p style={MONO}>Connecting to run {runId}...</p>
    </div>
  )

  const send = async () => {
    if (!steerMsg.trim()) return
    await steer(steerMsg.trim())
    setSteerMsg('')
  }

  const statusColor = state.status === 'done' ? '#00e676' : state.status === 'error' ? '#ff5252' : '#00D4FF'
  const statusLabel = state.status === 'running' ? `Stage ${state.activeStageIdx + 1} of ${state.stageCount} · running` : state.status

  return (
    <div className="pt-20 px-4 max-w-3xl mx-auto pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Header */}
      <div style={{ ...PANEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ ...BTN, padding: '5px 10px', fontSize: '11px' }}>← Back</button>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, color: '#FFFFFF', fontSize: '15px' }}>
            ▣ {pipelineName || 'Pipeline Run'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ ...MONO, fontSize: '10px', color: statusColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {state.status === 'running' && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#00D4FF', marginRight: 6, animation: 'pulse 1.5s infinite' }} />}
            {statusLabel}
          </span>
          {state.status === 'running' && (
            <button onClick={abort} style={BTN_RED}>✕ Abort</button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ ...PANEL, display: 'flex', alignItems: 'center', overflowX: 'auto' }}>
        {state.stages.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                background: s.status === 'done' ? 'rgba(0,230,118,0.15)' : s.status === 'running' ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: s.status === 'done' ? '1px solid #00e676' : s.status === 'running' ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.10)',
                color: s.status === 'done' ? '#00e676' : s.status === 'running' ? '#00D4FF' : 'rgba(255,255,255,0.25)',
                boxShadow: s.status === 'running' ? '0 0 8px rgba(0,212,255,0.3)' : 'none',
              }}>
                {s.status === 'done' ? '✓' : i + 1}
              </div>
              <span style={{ ...MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: s.status === 'done' ? '#00e676' : s.status === 'running' ? '#00D4FF' : 'rgba(255,255,255,0.25)' }}>
                {s.agentName.length > 10 ? s.agentName.slice(0, 10) + '…' : s.agentName}
              </span>
            </div>
            {i < state.stages.length - 1 && (
              <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0, margin: '0 4px' }} />
            )}
          </div>
        ))}
      </div>

      {/* Stage threads */}
      {state.stages.map((stage, i) => (
        <StageThread
          key={i}
          stage={stage}
          isExpanded={expanded.has(i)}
          onToggle={() => setExpanded(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
          })}
        />
      ))}

      {state.finalOutput && (
        <div style={{ ...PANEL, borderColor: 'rgba(0,230,118,0.20)' }}>
          <div style={{ ...MONO, fontSize: '10px', color: '#00e676', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Final Output</div>
          <pre style={{ fontSize: '12px', color: '#e2e8f0', whiteSpace: 'pre-wrap', margin: 0 }}>{state.finalOutput}</pre>
        </div>
      )}

      {state.error && (
        <div style={{ ...PANEL, borderColor: 'rgba(255,82,82,0.25)', background: 'rgba(255,82,82,0.05)' }}>
          <span style={{ ...MONO, fontSize: '11px', color: '#ff5252' }}>Error: {state.error}</span>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Steer bar */}
      {state.status === 'running' && (
        <div style={{ position: 'sticky', bottom: 16, ...PANEL, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ ...MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#00D4FF', whiteSpace: 'nowrap' }}>
            → Stage {state.activeStageIdx + 1}
          </span>
          <input
            value={steerMsg}
            onChange={e => setSteerMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Steer the active agent — e.g. 'focus on DeFi trends only'"
            style={{ flex: 1, background: 'rgba(5,13,26,0.80)', border: '1px solid rgba(0,212,255,0.20)', borderRadius: 8, padding: '8px 14px', color: '#FFFFFF', fontSize: '12px', outline: 'none' }}
          />
          <button onClick={send} style={BTN}>Send</button>
        </div>
      )}
    </div>
  )
}

function StageThread({ stage, isExpanded, onToggle }: { stage: LiveStage; isExpanded: boolean; onToggle: () => void }) {
  const isActive = stage.status === 'running'
  const isDone = stage.status === 'done'
  const nameColor = isDone ? '#00e676' : isActive ? '#00D4FF' : 'rgba(255,255,255,0.30)'
  const badgeStyle: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', letterSpacing: '0.06em',
    textTransform: 'uppercase', padding: '2px 8px', borderRadius: 10,
    background: isDone ? 'rgba(0,230,118,0.10)' : isActive ? 'rgba(0,212,255,0.10)' : 'rgba(255,255,255,0.04)',
    color: isDone ? '#00e676' : isActive ? '#00D4FF' : 'rgba(255,255,255,0.25)',
    border: isDone ? '1px solid rgba(0,230,118,0.20)' : isActive ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
  }
  const panel = isActive ? { background: 'rgba(26,39,68,0.80)', border: '1px solid rgba(0,212,255,0.30)', borderRadius: 12, overflow: 'hidden' } : { background: 'rgba(26,39,68,0.80)', border: '1px solid rgba(0,212,255,0.10)', borderRadius: 12, overflow: 'hidden' }

  return (
    <div style={panel}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', fontWeight: 600, color: nameColor }}>
            {isDone ? '✓ ' : isActive ? '● ' : ''}{stage.agentName}
          </span>
          <span style={badgeStyle}>{stage.status === 'running' ? 'running' : stage.status === 'done' ? `done${stage.durationMs ? ` · ${(stage.durationMs / 1000).toFixed(1)}s` : ''}` : 'waiting'}</span>
          {stage.iteration > 0 && <span style={{ ...badgeStyle, background: 'rgba(255,179,0,0.10)', color: '#ffb300', border: '1px solid rgba(255,179,0,0.25)' }}>×{stage.iteration + 1}</span>}
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'rgba(255,255,255,0.20)' }}>{isExpanded ? '▾' : '▸'}</span>
      </div>

      {isExpanded && (
        <div style={{ padding: '4px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {stage.toolCalls.map((tc, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 10px', margin: '2px 0', background: 'rgba(5,13,26,0.60)', borderLeft: `2px solid ${tc.status === 'done' ? 'rgba(0,230,118,0.40)' : 'rgba(255,179,0,0.50)'}`, borderRadius: '0 4px 4px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>
              <span style={{ color: '#a78bfa' }}>{tc.toolName}</span>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{JSON.stringify(tc.args).slice(0, 80)}</span>
              {tc.status === 'running' && <span style={{ color: '#ffb300', marginLeft: 'auto' }}>running…</span>}
            </div>
          ))}
          {stage.steerMessages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 10px', margin: '4px 0', background: 'rgba(255,179,0,0.06)', borderLeft: '2px solid rgba(255,179,0,0.40)', borderRadius: '0 4px 4px 0', fontSize: '11px', color: '#ffb300' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: 'rgba(255,179,0,0.50)', textTransform: 'uppercase' }}>you →</span>
              {msg}
            </div>
          ))}
          {stage.status === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'rgba(0,212,255,0.50)' }}>
              <span>● ● ●</span> thinking
            </div>
          )}
          {stage.output && stage.status === 'done' && (
            <div style={{ background: 'rgba(5,13,26,0.60)', borderRadius: 4, padding: '8px 10px', marginTop: 6, fontSize: '11px', color: '#94a3b8', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
              {stage.output}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd packages/web && pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/pages/PipelineRun.tsx
git commit -m "feat: add PipelineRun live execution page"
```

---

### Task 10: Update Pipeline builder — save, library, loop controls, async run

**Files:**
- Modify: `packages/web/src/pages/Pipeline.tsx`

This task replaces the run flow (sync → async + navigate) and adds save/library/loop controls. The Pipeline page now manages its own `view` state: `'builder'` or `'run'`.

- [ ] **Step 1: Read the current Pipeline.tsx**

Read `packages/web/src/pages/Pipeline.tsx` fully to understand the current structure before making changes.

- [ ] **Step 2: Add view state, saved pipelines, and loop controls**

At the top of the `Pipeline` component, add:

```tsx
const [view, setView] = useState<'builder' | 'run'>('builder')
const [activeRunId, setActiveRunId] = useState<string | null>(null)
const [pipelineName, setPipelineName] = useState('')
const [savedPipelines, setSavedPipelines] = useState<any[]>([])
const [showLibrary, setShowLibrary] = useState(false)

// Load saved pipelines
useEffect(() => {
  fetch('/api/admin/pipelines', { headers: { 'x-admin-token': token } })
    .then(r => r.json()).then(setSavedPipelines).catch(() => {})
}, [])
```

Add `loopBack` to the Stage interface:
```tsx
interface Stage {
  id: string
  agentId: string
  loopBack?: { toStageIdx: number; condition: string; maxIterations: number }
}
```

- [ ] **Step 3: Change run handler to async**

Replace the existing `run()` handler that calls `POST /api/pipeline/run` with:

```tsx
const run = async () => {
  const filled = stages.filter(s => s.agentId)
  if (filled.length < 1) { setError('Add at least one agent stage'); return }
  setError('')
  setLoading(true)
  try {
    const res = await fetch('/api/pipeline/run/async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stages: filled.map((s, i) => ({ agentId: s.agentId, loopBack: s.loopBack })),
        input: input.trim(),
      }),
    })
    const data = await res.json()
    if (data.runId) {
      setActiveRunId(data.runId)
      setView('run')
    }
  } finally {
    setLoading(false)
  }
}
```

- [ ] **Step 4: Add save handler**

```tsx
const save = async () => {
  if (!pipelineName.trim()) { setError('Enter a pipeline name to save'); return }
  const res = await fetch('/api/admin/pipelines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ name: pipelineName, stages: stages.map(s => ({ agentId: s.agentId, type: 'agent', loopBack: s.loopBack })) }),
  })
  const saved = await res.json()
  setSavedPipelines(prev => [saved, ...prev])
}

const loadPipeline = (p: any) => {
  setPipelineName(p.name)
  setStages(p.stages.map((s: any) => ({ id: randomId(), agentId: s.agentId, loopBack: s.loopBack })))
  setShowLibrary(false)
}
```

- [ ] **Step 5: Add loop-back control per stage**

In the stage row JSX, after the agent select dropdown, add:

```tsx
{/* Loop-back toggle */}
<button
  onClick={() => {
    const hasLoop = !!stage.loopBack
    updateStage(stage.id, 'loopBack', hasLoop ? undefined : { toStageIdx: Math.max(0, idx - 1), condition: 'DONE', maxIterations: 3 })
  }}
  style={{ ...BTN_CYAN, padding: '4px 8px', fontSize: '10px', opacity: stage.loopBack ? 1 : 0.4 }}
  title="Add loop-back to earlier stage"
>↩</button>
{stage.loopBack && (
  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '11px', color: '#A0AEC0' }}>
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#ffb300' }}>loop if not contains:</span>
    <input
      value={stage.loopBack.condition}
      onChange={e => updateStage(stage.id, 'loopBack', { ...stage.loopBack!, condition: e.target.value })}
      style={{ width: 80, ...INPUT_STYLE, padding: '2px 6px', fontSize: '10px' }}
    />
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#A0AEC0' }}>→ stage</span>
    <input
      type="number" min={0} max={idx}
      value={stage.loopBack.toStageIdx + 1}
      onChange={e => updateStage(stage.id, 'loopBack', { ...stage.loopBack!, toStageIdx: Number(e.target.value) - 1 })}
      style={{ width: 40, ...INPUT_STYLE, padding: '2px 6px', fontSize: '10px' }}
    />
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#A0AEC0' }}>max</span>
    <input
      type="number" min={1} max={10}
      value={stage.loopBack.maxIterations}
      onChange={e => updateStage(stage.id, 'loopBack', { ...stage.loopBack!, maxIterations: Number(e.target.value) })}
      style={{ width: 40, ...INPUT_STYLE, padding: '2px 6px', fontSize: '10px' }}
    />
  </div>
)}
```

- [ ] **Step 6: Add library panel and name field to builder header JSX**

Add above the existing stage list:

```tsx
{/* Name + Save row */}
<div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
  <input
    value={pipelineName}
    onChange={e => setPipelineName(e.target.value)}
    placeholder="Pipeline name (optional)"
    style={{ flex: 1, ...INPUT_STYLE }}
  />
  <button onClick={save} style={BTN_CYAN}>Save</button>
  <button onClick={() => setShowLibrary(v => !v)} style={{ ...BTN_CYAN, opacity: 0.7 }}>📂 Library</button>
</div>

{/* Library panel */}
{showLibrary && (
  <div style={{ ...PANEL, marginBottom: 16 }}>
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Saved Pipelines</div>
    {savedPipelines.length === 0 && <p style={{ fontSize: '12px', color: '#475569' }}>No saved pipelines yet.</p>}
    {savedPipelines.map(p => (
      <div key={p.id} onClick={() => loadPipeline(p)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: 'rgba(5,13,26,0.50)', marginBottom: 4, cursor: 'pointer' }}>
        <span style={{ fontSize: '12px', color: '#e2e8f0' }}>{p.name}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#475569' }}>{p.stages.length} stages</span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 7: Render PipelineRun when view === 'run'**

At the top of the Pipeline component's return statement:

```tsx
if (view === 'run' && activeRunId) {
  return (
    <PipelineRun
      runId={activeRunId}
      pipelineName={pipelineName || 'Pipeline Run'}
      stageCount={stages.filter(s => s.agentId).length}
      onBack={() => { setView('builder'); setActiveRunId(null) }}
    />
  )
}
```

Import at top of file:
```tsx
import { PipelineRun } from './PipelineRun.js'
```

- [ ] **Step 8: TypeScript check + dev build**

```bash
cd packages/web && pnpm tsc --noEmit
```
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/pages/Pipeline.tsx packages/web/src/pages/PipelineRun.tsx
git commit -m "feat: pipeline save, library panel, loop controls, async run with live view"
```

---

### Task 11: Full build + smoke test

- [ ] **Step 1: Run all core tests**

```bash
cd packages/core && pnpm test
```
Expected: steer-queue (5 pass), store (5 pass), all existing tests pass

- [ ] **Step 2: Build core**

```bash
cd packages/core && pnpm build
```
Expected: clean build, no TypeScript errors

- [ ] **Step 3: Build web**

```bash
cd packages/web && pnpm build
```
Expected: clean build

- [ ] **Step 4: Start the dev server and manually verify**

```bash
cd /c/Users/John/coastal-claw && pnpm dev
```

Manual checks:
- Navigate to Pipeline page
- Create 2 stages, enter a prompt, click Run
- Confirm browser navigates to live execution view
- Confirm stage threads appear and update as tools fire
- Type a message in steer bar, confirm it appears in yellow in the active stage thread
- Confirm pipeline completes and Final Output appears
- Click Back, confirm builder returns

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete pipeline live execution — async run, SSE, steering, save, loop-back"
```

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
