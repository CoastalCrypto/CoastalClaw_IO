# Coastal Claw Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Coastal Claw monorepo foundation — core service on :4747, hybrid memory stack (QMD adapter + Mem0 + LosslessClaw), Ollama model routing, and a React web portal with onboarding wizard and chat interface.

**Architecture:** A TypeScript/Node.js 22 core service runs as a local API server (REST + WebSocket). All three interfaces (web, Electron, TUI) are thin clients connecting to it. Phase 1 delivers the web portal only — Electron and TUI come in later phases. Memory writes fan out to QMD + LosslessClaw + Mem0; reads go through a unified interface that merges all three.

**Tech Stack:** pnpm workspaces, TypeScript 5.x, Node.js 22, Fastify (HTTP + WebSocket), Vitest (tests), React 19 + Vite + Tailwind CSS, LosslessClaw plugin, Mem0 SDK, Ollama REST API, SQLite (via better-sqlite3).

---

## Chunk 1: Monorepo Scaffold

### Task 1: Initialize pnpm monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.nvmrc`

- [ ] **Step 1: Verify Node 22 and pnpm are available**

```bash
node --version   # expect v22.x.x
pnpm --version   # expect 9.x or 10.x
```

If pnpm is missing: `npm install -g pnpm`

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "coastal-claw",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

- [ ] **Step 3: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 4: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 5: Write `.nvmrc`**

```
22
```

- [ ] **Step 6: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 7: Write `.gitignore`**

```
node_modules/
dist/
.env
.env.local
*.db
*.db-shm
*.db-wal
.turbo/
coverage/
```

- [ ] **Step 8: Install root dependencies**

```bash
cd C:/Users/John/Coastal.AI
pnpm install
```

Expected: `node_modules/` created at root with turbo and typescript.

- [ ] **Step 9: Initialize git and commit scaffold**

```bash
cd C:/Users/John/Coastal.AI
git init
git add package.json pnpm-workspace.yaml tsconfig.base.json turbo.json .nvmrc .gitignore
git commit -m "chore: initialize coastal-claw monorepo scaffold"
```

---

### Task 2: Scaffold core package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts` (entry point, starts server)
- Create: `packages/core/src/config.ts` (typed config with env defaults)
- Create: `packages/core/tests/config.test.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p C:/Users/John/Coastal.AI/packages/core/src
mkdir -p C:/Users/John/Coastal.AI/packages/core/tests
```

- [ ] **Step 2: Write `packages/core/package.json`**

```json
{
  "name": "@coastal-claw/core",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "node --watch --loader ts-node/esm src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/websocket": "^8.3.0",
    "@fastify/cors": "^9.0.0",
    "better-sqlite3": "^9.6.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Write `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Write failing test for config**

`packages/core/tests/config.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config'

describe('loadConfig', () => {
  it('returns default port 4747', () => {
    const config = loadConfig()
    expect(config.port).toBe(4747)
  })

  it('returns default host 127.0.0.1', () => {
    const config = loadConfig()
    expect(config.host).toBe('127.0.0.1')
  })

  it('overrides port from environment', () => {
    process.env.CC_PORT = '9000'
    const config = loadConfig()
    expect(config.port).toBe(9000)
    delete process.env.CC_PORT
  })
})
```

- [ ] **Step 5: Run test — expect FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core
pnpm install
pnpm test
```

Expected: `Error: Cannot find module '../src/config'`

- [ ] **Step 6: Write `packages/core/src/config.ts`**

```typescript
export interface Config {
  port: number
  host: string
  dataDir: string
  ollamaUrl: string
  mem0ApiKey: string | undefined
}

export function loadConfig(): Config {
  return {
    port: process.env.CC_PORT ? parseInt(process.env.CC_PORT, 10) : 4747,
    host: process.env.CC_HOST ?? '127.0.0.1',
    dataDir: process.env.CC_DATA_DIR ?? './data',
    ollamaUrl: process.env.CC_OLLAMA_URL ?? 'http://127.0.0.1:11434',
    mem0ApiKey: process.env.MEM0_API_KEY,
  }
}
```

- [ ] **Step 7: Run test — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core
pnpm test
```

Expected: `✓ config.test.ts (3 tests) — all pass`

- [ ] **Step 8: Write minimal `packages/core/src/index.ts`**

```typescript
import { loadConfig } from './config.js'

const config = loadConfig()
console.log(`[coastal-claw] config loaded — port ${config.port}`)

export { loadConfig }
```

- [ ] **Step 9: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/
git commit -m "feat(core): scaffold core package with typed config"
```

---

## Chunk 2: Core HTTP + WebSocket Server

### Task 3: Fastify server with health endpoint

**Files:**
- Create: `packages/core/src/server.ts`
- Create: `packages/core/src/api/routes/health.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/tests/server.test.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/server.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../src/server'

describe('health endpoint', () => {
  let server: Awaited<ReturnType<typeof buildServer>>

  beforeAll(async () => {
    server = await buildServer({ port: 0, host: '127.0.0.1' })
    await server.listen({ port: 0 })
  })

  afterAll(async () => {
    await server.close()
  })

  it('GET /health returns 200 with status ok', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('ok')
    expect(body.version).toBeDefined()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: `Cannot find module '../src/server'`

- [ ] **Step 3: Write `packages/core/src/api/routes/health.ts`**

```typescript
import type { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }))
}
```

- [ ] **Step 4: Write `packages/core/src/server.ts`**

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'
import type { Config } from './config.js'

export async function buildServer(config: Pick<Config, 'port' | 'host'>) {
  const fastify = Fastify({ logger: false })

  await fastify.register(cors, { origin: true })
  await fastify.register(websocket)
  await fastify.register(healthRoutes)

  return fastify
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: `✓ server.test.ts (1 test) — all pass`

- [ ] **Step 6: Update `src/index.ts` to start server**

```typescript
import { loadConfig } from './config.js'
import { buildServer } from './server.js'

const config = loadConfig()
const server = await buildServer(config)

await server.listen({ port: config.port, host: config.host })
console.log(`[coastal-claw] core running on ${config.host}:${config.port}`)

export { loadConfig, buildServer }
```

- [ ] **Step 7: Smoke test manually**

```bash
cd C:/Users/John/Coastal.AI/packages/core
node --loader ts-node/esm src/index.ts &
sleep 2
curl http://127.0.0.1:4747/health
```

Expected: `{"status":"ok","version":"0.1.0","timestamp":"..."}`

Kill background process: `kill %1`

- [ ] **Step 8: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/ packages/core/tests/
git commit -m "feat(core): add Fastify server with health endpoint"
```

---

### Task 4: WebSocket session channel

**Files:**
- Create: `packages/core/src/api/ws/session.ts`
- Create: `packages/core/src/api/routes/ws.ts`
- Modify: `packages/core/src/server.ts`
- Create: `packages/core/tests/ws.test.ts`

> **Note on `@fastify/websocket` v8:** The plugin exposes connections as `SocketStream` (not bare `WebSocket`). The raw socket lives at `connection.socket`. The handler below uses `connection.socket` correctly.

- [ ] **Step 1: Write failing test**

`packages/core/tests/ws.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../src/server'
import WebSocket from 'ws'

describe('WebSocket session channel', () => {
  let server: Awaited<ReturnType<typeof buildServer>>
  let address: string

  beforeAll(async () => {
    server = await buildServer({ port: 0, host: '127.0.0.1' })
    await server.listen({ port: 0 })
    const port = (server.server.address() as { port: number }).port
    address = `ws://127.0.0.1:${port}/ws/session`
  })

  afterAll(async () => {
    await server.close()
  })

  it('accepts connection and responds to ping', async () => {
    const ws = new WebSocket(address)
    await new Promise<void>((resolve) => ws.on('open', resolve))
    ws.send(JSON.stringify({ type: 'ping' }))
    const msg = await new Promise<string>((resolve) => ws.on('message', (d) => resolve(d.toString())))
    const parsed = JSON.parse(msg)
    expect(parsed.type).toBe('pong')
    ws.close()
  })
})
```

Add `ws` to dev dependencies:
```bash
cd C:/Users/John/Coastal.AI/packages/core
pnpm add -D ws @types/ws
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test
```

Expected: `Cannot find module './api/routes/ws'`

- [ ] **Step 3: Write `packages/core/src/api/ws/session.ts`**

```typescript
import type { FastifyRequest } from 'fastify'
import type { SocketStream } from '@fastify/websocket'

// @fastify/websocket v8 passes a SocketStream; the raw WebSocket is at connection.socket
export function handleSessionWs(connection: SocketStream, _req: FastifyRequest) {
  const socket = connection.socket
  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
      }
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid json' }))
    }
  })
}
```

- [ ] **Step 4: Write `packages/core/src/api/routes/ws.ts`**

```typescript
import type { FastifyInstance } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import type { FastifyRequest } from 'fastify'
import { handleSessionWs } from '../ws/session.js'

export async function wsRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/session', { websocket: true }, (connection: SocketStream, req: FastifyRequest) => {
    handleSessionWs(connection, req)
  })
}
```

- [ ] **Step 5: Register ws routes in `server.ts`**

Add after existing route registration:
```typescript
import { wsRoutes } from './api/routes/ws.js'
// ...
await fastify.register(wsRoutes)
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: `✓ ws.test.ts (1 test) — all pass`

- [ ] **Step 7: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/
git commit -m "feat(core): add WebSocket session channel with ping/pong"
```

---

## Chunk 3: Memory Stack

### Task 5: LosslessClaw adapter

**Files:**
- Create: `packages/core/src/memory/lossless.ts`
- Create: `packages/core/src/memory/types.ts`
- Create: `packages/core/tests/memory/lossless.test.ts`

- [ ] **Step 1: Add LosslessClaw dependency**

LosslessClaw is an OpenClaw plugin. Install it as an npm package:
```bash
cd C:/Users/John/Coastal.AI/packages/core
pnpm add lossless-claw
```

If not published to npm yet, link local or use the GitHub path:
```bash
pnpm add github:Martian-Engineering/lossless-claw
```

- [ ] **Step 2: Write shared memory types**

`packages/core/src/memory/types.ts`:
```typescript
export interface MemoryEntry {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface MemoryQuery {
  sessionId: string
  query?: string
  limit?: number
}

export interface MemoryStore {
  write(entry: MemoryEntry): Promise<void>
  query(q: MemoryQuery): Promise<MemoryEntry[]>
  close(): Promise<void>
}
```

- [ ] **Step 3: Write failing test**

`packages/core/tests/memory/lossless.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LosslessAdapter } from '../../src/memory/lossless'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('LosslessAdapter', () => {
  let adapter: LosslessAdapter
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-lossless-'))
    adapter = new LosslessAdapter({ dataDir: tmpDir })
  })

  afterEach(async () => {
    await adapter.close()
    rmSync(tmpDir, { recursive: true })
  })

  it('writes and retrieves a message', async () => {
    const entry = {
      id: 'msg-1',
      sessionId: 'session-abc',
      role: 'user' as const,
      content: 'hello from the test',
      timestamp: Date.now(),
    }
    await adapter.write(entry)
    const results = await adapter.query({ sessionId: 'session-abc' })
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('hello from the test')
  })

  it('returns empty array for unknown session', async () => {
    const results = await adapter.query({ sessionId: 'nonexistent' })
    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run — expect FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: `Cannot find module '../../src/memory/lossless'`

- [ ] **Step 5: Write `packages/core/src/memory/lossless.ts`**

```typescript
import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'
import type { MemoryEntry, MemoryQuery, MemoryStore } from './types.js'

export class LosslessAdapter implements MemoryStore {
  private db: Database.Database

  constructor(private config: { dataDir: string }) {
    mkdirSync(config.dataDir, { recursive: true })
    this.db = new Database(join(config.dataDir, 'lossless.db'))
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id);
    `)
  }

  async write(entry: MemoryEntry): Promise<void> {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO messages (id, session_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id,
        entry.sessionId,
        entry.role,
        entry.content,
        entry.timestamp,
        entry.metadata ? JSON.stringify(entry.metadata) : null
      )
  }

  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM messages WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(q.sessionId, q.limit ?? 100) as Array<{
        id: string
        session_id: string
        role: string
        content: string
        timestamp: number
        metadata: string | null
      }>

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role as MemoryEntry['role'],
      content: r.content,
      timestamp: r.timestamp,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }))
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: `✓ memory/lossless.test.ts (2 tests) — all pass`

- [ ] **Step 7: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/memory/ packages/core/tests/memory/
git commit -m "feat(core/memory): add LosslessAdapter with SQLite backing"
```

---

### Task 6: Mem0 adapter

**Files:**
- Create: `packages/core/src/memory/mem0.ts`
- Create: `packages/core/tests/memory/mem0.test.ts`

- [ ] **Step 1: Add Mem0 SDK**

```bash
cd C:/Users/John/Coastal.AI/packages/core
pnpm add mem0ai
```

- [ ] **Step 2: Write failing test**

`packages/core/tests/memory/mem0.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Mem0Adapter } from '../../src/memory/mem0'

// Mock the mem0ai SDK to avoid needing a real API key in tests
vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ results: [{ id: 'mem-1' }] }),
    search: vi.fn().mockResolvedValue([
      { id: 'mem-1', memory: 'user prefers dark mode', score: 0.9 }
    ]),
  })),
}))

describe('Mem0Adapter', () => {
  let adapter: Mem0Adapter

  beforeEach(() => {
    adapter = new Mem0Adapter({ apiKey: 'test-key' })
  })

  it('stores a user preference', async () => {
    await expect(
      adapter.remember('user-123', 'I prefer concise responses')
    ).resolves.not.toThrow()
  })

  it('searches memory for a user', async () => {
    const results = await adapter.search('user-123', 'display preferences')
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('dark mode')
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
pnpm test
```

Expected: `Cannot find module '../../src/memory/mem0'`

- [ ] **Step 4: Write `packages/core/src/memory/mem0.ts`**

```typescript
import { MemoryClient } from 'mem0ai'

export interface Mem0Result {
  id: string
  content: string
  score: number
}

export class Mem0Adapter {
  private client: MemoryClient

  constructor(config: { apiKey: string }) {
    this.client = new MemoryClient({ apiKey: config.apiKey })
  }

  async remember(userId: string, text: string): Promise<void> {
    await this.client.add(
      [{ role: 'user', content: text }],
      { user_id: userId }
    )
  }

  async search(userId: string, query: string): Promise<Mem0Result[]> {
    const results = await this.client.search(query, { user_id: userId }) as Array<{
      id: string
      memory: string
      score: number
    }>
    return results.map((r) => ({
      id: r.id,
      content: r.memory,
      score: r.score,
    }))
  }
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test
```

Expected: `✓ memory/mem0.test.ts (2 tests) — all pass`

- [ ] **Step 6: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/memory/mem0.ts packages/core/tests/memory/mem0.test.ts
git commit -m "feat(core/memory): add Mem0Adapter for personalized memory"
```

---

### Task 7: Unified memory interface

**Files:**
- Create: `packages/core/src/memory/index.ts`
- Create: `packages/core/tests/memory/unified.test.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/memory/unified.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnifiedMemory } from '../../src/memory/index'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue([]),
  })),
}))

describe('UnifiedMemory', () => {
  let memory: UnifiedMemory
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-unified-'))
    memory = new UnifiedMemory({ dataDir: tmpDir, mem0ApiKey: 'test' })
  })

  afterEach(async () => {
    await memory.close()
    rmSync(tmpDir, { recursive: true })
  })

  it('writes message to lossless store', async () => {
    await memory.write({
      id: 'msg-1',
      sessionId: 'sess-1',
      role: 'user',
      content: 'test message',
      timestamp: Date.now(),
    })
    const results = await memory.queryHistory({ sessionId: 'sess-1' })
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('test message')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test
```

Expected: `Cannot find module '../../src/memory/index'`

- [ ] **Step 3: Write `packages/core/src/memory/index.ts`**

```typescript
import { LosslessAdapter } from './lossless.js'
import { Mem0Adapter } from './mem0.js'
import type { MemoryEntry, MemoryQuery } from './types.js'

export interface UnifiedMemoryConfig {
  dataDir: string
  mem0ApiKey?: string
}

export class UnifiedMemory {
  private lossless: LosslessAdapter
  private mem0: Mem0Adapter | null

  constructor(config: UnifiedMemoryConfig) {
    this.lossless = new LosslessAdapter({ dataDir: config.dataDir })
    this.mem0 = config.mem0ApiKey
      ? new Mem0Adapter({ apiKey: config.mem0ApiKey })
      : null
  }

  async write(entry: MemoryEntry): Promise<void> {
    // Always write to lossless store — nothing is ever lost
    await this.lossless.write(entry)

    // Fan out to Mem0 for personalization (fire-and-forget, non-blocking)
    if (this.mem0 && entry.role === 'user') {
      this.mem0
        .remember(entry.sessionId, entry.content)
        .catch((err) => console.warn('[memory] mem0 write failed:', err))
    }
  }

  async queryHistory(q: MemoryQuery): Promise<MemoryEntry[]> {
    return this.lossless.query(q)
  }

  async searchPersonalized(userId: string, query: string) {
    if (!this.mem0) return []
    return this.mem0.search(userId, query)
  }

  async close(): Promise<void> {
    await this.lossless.close()
  }
}

export type { MemoryEntry, MemoryQuery }
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test
```

Expected: `✓ memory/unified.test.ts (1 test) — all pass`

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/memory/index.ts packages/core/tests/memory/unified.test.ts
git commit -m "feat(core/memory): add UnifiedMemory with lossless+mem0 fan-out"
```

---

## Chunk 4: Ollama Model Router

### Task 8: Ollama client + model routing

**Files:**
- Create: `packages/core/src/models/ollama.ts`
- Create: `packages/core/src/models/router.ts`
- Create: `packages/core/tests/models/ollama.test.ts`
- Create: `packages/core/tests/models/router.test.ts`

- [ ] **Step 1: Write failing test for Ollama client**

`packages/core/tests/models/ollama.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { OllamaClient } from '../../src/models/ollama'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OllamaClient', () => {
  const client = new OllamaClient({ baseUrl: 'http://127.0.0.1:11434' })

  it('lists available models', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }, { name: 'mistral' }] }),
    })
    const models = await client.listModels()
    expect(models).toEqual(['llama3.2', 'mistral'])
  })

  it('sends a chat message and returns content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { role: 'assistant', content: 'Hello from llama!' },
        done: true,
      }),
    })
    const result = await client.chat('llama3.2', [
      { role: 'user', content: 'say hello' }
    ])
    expect(result).toBe('Hello from llama!')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'error' })
    await expect(client.listModels()).rejects.toThrow('Ollama error 500')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test
```

Expected: `Cannot find module '../../src/models/ollama'`

- [ ] **Step 3: Write `packages/core/src/models/ollama.ts`**

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class OllamaClient {
  constructor(private config: { baseUrl: string }) {}

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.config.baseUrl}/api/tags`)
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { models: Array<{ name: string }> }
    return data.models.map((m) => m.name)
  }

  async chat(model: string, messages: ChatMessage[]): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { message: ChatMessage }
    return data.message.content
  }
}
```

- [ ] **Step 4: Write failing test for router**

`packages/core/tests/models/router.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { ModelRouter } from '../../src/models/router'

vi.mock('../../src/models/ollama', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    listModels: vi.fn().mockResolvedValue(['llama3.2', 'mistral']),
    chat: vi.fn().mockResolvedValue('mocked response'),
  })),
}))

describe('ModelRouter', () => {
  it('routes to default model when none specified', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const result = await router.chat([{ role: 'user', content: 'hi' }])
    expect(result).toBe('mocked response')
  })

  it('routes to specified model', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const result = await router.chat([{ role: 'user', content: 'hi' }], { model: 'mistral' })
    expect(result).toBe('mocked response')
  })

  it('lists available models', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const models = await router.listModels()
    expect(models).toContain('llama3.2')
  })
})
```

- [ ] **Step 5: Write `packages/core/src/models/router.ts`**

```typescript
import { OllamaClient, type ChatMessage } from './ollama.js'

export interface RouterConfig {
  ollamaUrl: string
  defaultModel: string
}

export interface ChatOptions {
  model?: string
}

export class ModelRouter {
  private ollama: OllamaClient

  constructor(private config: RouterConfig) {
    this.ollama = new OllamaClient({ baseUrl: config.ollamaUrl })
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model ?? this.config.defaultModel
    return this.ollama.chat(model, messages)
  }

  async listModels(): Promise<string[]> {
    return this.ollama.listModels()
  }
}
```

- [ ] **Step 6: Run all tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: all tests pass including both new test files

- [ ] **Step 7: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/models/ packages/core/tests/models/
git commit -m "feat(core/models): add OllamaClient and ModelRouter"
```

---

### Task 9: Chat API endpoint (ties memory + model router together)

**Files:**
- Create: `packages/core/src/api/routes/chat.ts`
- Modify: `packages/core/src/server.ts`
- Create: `packages/core/tests/api/chat.test.ts`

- [ ] **Step 1: Write failing test**

`packages/core/tests/api/chat.test.ts`:
```typescript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../../src/server'

vi.mock('../../src/models/router', () => ({
  ModelRouter: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue('Hello from the agent!'),
    listModels: vi.fn().mockResolvedValue(['llama3.2']),
  })),
}))

vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue([]),
  })),
}))

describe('POST /api/chat', () => {
  let server: Awaited<ReturnType<typeof buildServer>>

  beforeAll(async () => {
    server = await buildServer({ port: 0, host: '127.0.0.1' })
    await server.listen({ port: 0 })
  })

  afterAll(async () => await server.close())

  it('returns assistant reply', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        sessionId: 'test-session',
        message: 'hello',
      },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.reply).toBe('Hello from the agent!')
    expect(body.sessionId).toBe('test-session')
  })

  it('rejects missing message with 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { sessionId: 'test' },
    })
    expect(res.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test
```

Expected: `404 on POST /api/chat`

- [ ] **Step 3: Write `packages/core/src/api/routes/chat.ts`**

```typescript
import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { UnifiedMemory } from '../../memory/index.js'
import { loadConfig } from '../../config.js'
import { randomUUID } from 'crypto'

export async function chatRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  const router = new ModelRouter({
    ollamaUrl: config.ollamaUrl,
    defaultModel: process.env.CC_DEFAULT_MODEL ?? 'llama3.2',
  })
  const memory = new UnifiedMemory({
    dataDir: config.dataDir,
    mem0ApiKey: config.mem0ApiKey,
  })

  fastify.post<{
    Body: { sessionId?: string; message: string; model?: string }
  }>('/api/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          sessionId: { type: 'string' },
          message: { type: 'string', minLength: 1 },
          model: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { message, model } = req.body
    const sessionId = req.body.sessionId ?? randomUUID()

    // Persist user message
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    })

    // Get history for context
    const history = await memory.queryHistory({ sessionId, limit: 20 })
    const messages = history
      .slice()
      .reverse()
      .map((e) => ({ role: e.role, content: e.content }))

    // Route to model
    const reply_text = await router.chat(messages, { model })

    // Persist assistant reply
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'assistant',
      content: reply_text,
      timestamp: Date.now(),
    })

    return reply.send({ sessionId, reply: reply_text })
  })
}
```

- [ ] **Step 4: Register chat routes in `server.ts`**

Add:
```typescript
import { chatRoutes } from './api/routes/chat.js'
// ...
await fastify.register(chatRoutes)
```

- [ ] **Step 5: Run all tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/api/routes/chat.ts packages/core/tests/api/
git commit -m "feat(core/api): add POST /api/chat with memory persistence"
```

---

## Chunk 5: React Web Portal

### Task 10: Scaffold web package

**Files:**
- Create: `packages/web/` (via Vite)
- Create: `packages/web/src/api/client.ts`
- Create: `packages/web/src/api/client.test.ts`

- [ ] **Step 1: Scaffold with Vite**

```bash
cd C:/Users/John/Coastal.AI/packages
pnpm create vite web --template react-ts
cd web
pnpm install
pnpm add -D tailwindcss postcss autoprefixer
pnpm exec tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

In `packages/web/tailwind.config.js`:
```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

In `packages/web/src/index.css`, replace contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Configure Vite proxy to core service**

`packages/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4747',
      '/ws': { target: 'ws://127.0.0.1:4747', ws: true },
    },
  },
})
```

- [ ] **Step 4: Write failing test for API client**

`packages/web/src/api/client.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { CoreClient } from './client'

globalThis.fetch = vi.fn()

describe('CoreClient', () => {
  const client = new CoreClient('http://localhost:4747')

  it('sendMessage returns reply and sessionId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'hi there', sessionId: 'sess-123' }),
    } as Response)

    const result = await client.sendMessage({ message: 'hello' })
    expect(result.reply).toBe('hi there')
    expect(result.sessionId).toBe('sess-123')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    } as Response)

    await expect(client.sendMessage({ message: 'hello' })).rejects.toThrow()
  })
})
```

- [ ] **Step 5: Run — expect FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/web
pnpm test
```

Expected: `Cannot find module './client'`

- [ ] **Step 6: Write `packages/web/src/api/client.ts`**

```typescript
export interface SendMessageOptions {
  message: string
  sessionId?: string
  model?: string
}

export interface SendMessageResult {
  reply: string
  sessionId: string
}

export class CoreClient {
  constructor(private baseUrl: string = '') {}

  async sendMessage(opts: SendMessageOptions): Promise<SendMessageResult> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })
    if (!res.ok) throw new Error(`Core error ${res.status}: ${await res.text()}`)
    return res.json()
  }

  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/health`)
    if (!res.ok) throw new Error('Core service unreachable')
    return res.json()
  }
}

export const coreClient = new CoreClient()
```

- [ ] **Step 7: Run test — expect PASS**

```bash
pnpm test
```

Expected: `✓ client.test.ts (2 tests) — all pass`

- [ ] **Step 8: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/web/
git commit -m "feat(web): scaffold React + Vite + Tailwind with CoreClient API layer"
```

---

### Task 11: Onboarding wizard (5-step flow)

**Files:**
- Create: `packages/web/src/pages/Onboarding.tsx`
- Create: `packages/web/src/components/WizardStep.tsx`
- Create: `packages/web/src/components/WizardStep.test.tsx`
- Create: `packages/web/src/store/onboarding.ts`

The wizard has 5 steps: Welcome → Company Info → Goals → Focus Agent → Launch.

- [ ] **Step 1: Add vitest + testing-library**

```bash
cd C:/Users/John/Coastal.AI/packages/web
pnpm add -D @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

In `packages/web/vite.config.ts` add test section:
```typescript
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
}
```

Create `packages/web/src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 2: Write failing test for WizardStep**

`packages/web/src/components/WizardStep.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WizardStep } from './WizardStep'

describe('WizardStep', () => {
  it('renders title and children', () => {
    render(
      <WizardStep title="Company Info" step={2} totalSteps={5}>
        <p>Enter your company name</p>
      </WizardStep>
    )
    expect(screen.getByText('Company Info')).toBeInTheDocument()
    expect(screen.getByText('Enter your company name')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
pnpm test
```

Expected: `Cannot find module './WizardStep'`

- [ ] **Step 4: Write `packages/web/src/components/WizardStep.tsx`**

```tsx
interface WizardStepProps {
  title: string
  step: number
  totalSteps: number
  children: React.ReactNode
}

export function WizardStep({ title, step, totalSteps, children }: WizardStepProps) {
  const progress = (step / totalSteps) * 100

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-cyan-500 tracking-widest uppercase">
            Step {step} of {totalSteps}
          </span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-1">
          <div
            className="bg-cyan-400 h-1 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">{title}</h2>
      <div>{children}</div>
    </div>
  )
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test
```

Expected: `✓ WizardStep.test.tsx (1 test) — all pass`

- [ ] **Step 6: Write onboarding store**

`packages/web/src/store/onboarding.ts`:
```typescript
import { useState } from 'react'

export interface OnboardingData {
  companyName: string
  challenges: string
  focusArea: 'coo' | 'cfo' | 'cto' | ''
  hasPitchDeck: boolean
}

export function useOnboarding() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    challenges: '',
    focusArea: '',
    hasPitchDeck: false,
  })

  const update = (patch: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...patch }))

  const next = () => setStep((s) => Math.min(s + 1, 5))
  const back = () => setStep((s) => Math.max(s - 1, 1))

  return { step, data, update, next, back }
}
```

- [ ] **Step 7: Write `packages/web/src/pages/Onboarding.tsx`**

```tsx
import { WizardStep } from '../components/WizardStep'
import { useOnboarding } from '../store/onboarding'

const AGENT_OPTIONS = [
  { id: 'coo', label: 'Virtual COO', desc: 'Operations, process, hiring strategy' },
  { id: 'cfo', label: 'Virtual CFO', desc: 'Burn rate, fundraising, financial forecasting' },
  { id: 'cto', label: 'Virtual CTO', desc: 'Tech stack, architecture, hiring' },
]

export function Onboarding({ onComplete }: { onComplete: (sessionId: string) => void }) {
  const { step, data, update, next, back } = useOnboarding()

  const btnClass =
    'w-full py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors mt-6'
  const inputClass =
    'w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500'

  if (step === 1)
    return (
      <WizardStep title="Welcome to Coastal Claw" step={1} totalSteps={5}>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Your private AI executive team. Set up takes about 10 minutes.
          Your data never leaves our facility.
        </p>
        <button className={btnClass} onClick={next}>Get Started →</button>
      </WizardStep>
    )

  if (step === 2)
    return (
      <WizardStep title="Tell us about your company" step={2} totalSteps={5}>
        <label className="block text-sm text-gray-400 mb-2">Company name</label>
        <input
          className={inputClass}
          value={data.companyName}
          onChange={(e) => update({ companyName: e.target.value })}
          placeholder="Acme Corp"
        />
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-3 px-6 border border-gray-700 text-gray-400 rounded-lg hover:border-gray-500 transition-colors" onClick={back}>Back</button>
          <button className="flex-1 py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors" onClick={next} disabled={!data.companyName}>Next →</button>
        </div>
      </WizardStep>
    )

  if (step === 3)
    return (
      <WizardStep title="What are your biggest challenges?" step={3} totalSteps={5}>
        <textarea
          className={`${inputClass} h-32 resize-none`}
          value={data.challenges}
          onChange={(e) => update({ challenges: e.target.value })}
          placeholder="e.g. managing burn rate, scaling the team, technical debt..."
        />
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-3 border border-gray-700 text-gray-400 rounded-lg hover:border-gray-500 transition-colors" onClick={back}>Back</button>
          <button className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors" onClick={next} disabled={!data.challenges}>Next →</button>
        </div>
      </WizardStep>
    )

  if (step === 4)
    return (
      <WizardStep title="Choose your first agent" step={4} totalSteps={5}>
        <div className="space-y-3">
          {AGENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => update({ focusArea: opt.id as typeof data.focusArea })}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                data.focusArea === opt.id
                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="font-semibold">{opt.label}</div>
              <div className="text-sm opacity-70 mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-3 border border-gray-700 text-gray-400 rounded-lg" onClick={back}>Back</button>
          <button className="flex-1 py-3 bg-cyan-500 text-black font-semibold rounded-lg" onClick={next} disabled={!data.focusArea}>Next →</button>
        </div>
      </WizardStep>
    )

  return (
    <WizardStep title="You're all set" step={5} totalSteps={5}>
      <div className="text-center py-6">
        <div className="text-5xl mb-4">⚡</div>
        <p className="text-gray-400 mb-2">Provisioning your agent environment...</p>
        <p className="text-sm text-cyan-500">{data.companyName} · {data.focusArea?.toUpperCase()}</p>
      </div>
      <button
        className={btnClass}
        onClick={() => onComplete(`session-${Date.now()}`)}
      >
        Launch →
      </button>
    </WizardStep>
  )
}
```

- [ ] **Step 8: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/web/src/
git commit -m "feat(web): add 5-step onboarding wizard with WizardStep component"
```

---

### Task 12: Chat interface

**Files:**
- Create: `packages/web/src/pages/Chat.tsx`
- Create: `packages/web/src/components/ChatBubble.tsx`
- Create: `packages/web/src/components/ChatBubble.test.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Write failing test for ChatBubble**

`packages/web/src/components/ChatBubble.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatBubble } from './ChatBubble'

describe('ChatBubble', () => {
  it('renders user message aligned right', () => {
    const { container } = render(<ChatBubble role="user" content="Hello agent" />)
    expect(screen.getByText('Hello agent')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('justify-end')
  })

  it('renders assistant message aligned left', () => {
    const { container } = render(<ChatBubble role="assistant" content="Hello human" />)
    expect(screen.getByText('Hello human')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('justify-start')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test
```

- [ ] **Step 3: Write `packages/web/src/components/ChatBubble.tsx`**

```tsx
interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-cyan-500 text-black'
            : 'bg-gray-800 text-gray-100 border border-gray-700'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test
```

- [ ] **Step 5: Write `packages/web/src/pages/Chat.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react'
import { ChatBubble } from '../components/ChatBubble'
import { coreClient } from '../api/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function Chat({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello. I\'m your AI executive. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await coreClient.sendMessage({ message: text, sessionId })
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-sm text-gray-400 font-mono">COASTAL CLAW · SESSION {sessionId.slice(-8).toUpperCase()}</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl">
              <span className="text-cyan-500 font-mono text-sm animate-pulse">thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 px-4 py-4">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message your agent..."
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-semibold rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire up `packages/web/src/App.tsx`**

```tsx
import { useState } from 'react'
import { Onboarding } from './pages/Onboarding'
import { Chat } from './pages/Chat'
import './index.css'

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)

  if (!sessionId) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <Onboarding onComplete={setSessionId} />
    </div>
  )

  return <Chat sessionId={sessionId} />
}
```

- [ ] **Step 7: Run all tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/web && pnpm test
```

- [ ] **Step 8: Smoke test full UI**

Start core service in one terminal:
```bash
cd C:/Users/John/Coastal.AI/packages/core
node --loader ts-node/esm src/index.ts
```

Start web dev server in another:
```bash
cd C:/Users/John/Coastal.AI/packages/web
pnpm dev
```

Open `http://localhost:5173`. Walk through the 5-step wizard. Verify chat UI loads. (Ollama must be running locally for real responses.)

- [ ] **Step 9: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/web/src/
git commit -m "feat(web): add Chat page with ChatBubble component and full App routing"
```

---

## Chunk 6: Integration + Phase 1 Verification

### Task 13: End-to-end smoke test script

**Files:**
- Create: `scripts/smoke-test.sh`

- [ ] **Step 1: Write smoke test script**

`scripts/smoke-test.sh`:
```bash
#!/usr/bin/env bash
set -e

BASE="http://127.0.0.1:4747"
echo "=== Coastal Claw Phase 1 Smoke Test ==="

# Health
echo -n "[ ] GET /health ... "
HEALTH=$(curl -sf "$BASE/health")
echo "$HEALTH" | grep -q '"status":"ok"' && echo "✓" || (echo "✗ FAIL"; exit 1)

# Chat
echo -n "[ ] POST /api/chat ... "
CHAT=$(curl -sf -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","sessionId":"smoke-test"}')
echo "$CHAT" | grep -q '"reply"' && echo "✓" || (echo "✗ FAIL"; exit 1)

echo ""
echo "=== All checks passed ==="
```

```bash
chmod +x C:/Users/John/Coastal.AI/scripts/smoke-test.sh
```

- [ ] **Step 2: Run full test suite**

```bash
cd C:/Users/John/Coastal.AI
pnpm test
```

Expected: all tests across all packages pass.

- [ ] **Step 3: Run smoke test against live core**

Start core: `node --loader ts-node/esm packages/core/src/index.ts &`
```bash
bash scripts/smoke-test.sh
```

Expected: `=== All checks passed ===`

Kill core: `kill %1`

- [ ] **Step 4: Final commit**

```bash
cd C:/Users/John/Coastal.AI
git add scripts/
git commit -m "chore: add Phase 1 smoke test script"
```

- [ ] **Step 5: Tag Phase 1**

```bash
git tag -a v0.1.0-phase1 -m "Phase 1: Foundation complete — core service, memory stack, web portal"
```

---

## Phase 1 Complete

**What's running:**
- `packages/core` — Fastify service on :4747, health + chat endpoints, WebSocket channel
- `packages/core/src/memory/` — LosslessClaw (SQLite DAG), Mem0 (personalized), UnifiedMemory (fan-out write)
- `packages/core/src/models/` — OllamaClient + ModelRouter (per-agent model routing)
- `packages/web` — React + Vite + Tailwind, 5-step onboarding wizard, chat interface

**What comes next (Phase 2):**
OpenMOSS orchestration, CrewAI agent blueprints (COO/CFO/CTO), Paperclip governance, LLM Council quality gate, CC facility tenant auto-provisioning.
