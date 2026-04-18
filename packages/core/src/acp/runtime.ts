// Composes all Coastal subsystems the ACP server needs into one disposable
// bundle. Mirrors the dependency wiring in api/routes/chat.ts but stays
// process-scoped (ACP runs as its own stdio process).
//
// Phase-2 scope: no MCP servers, no UnifiedMemory (ACP keeps history in
// AcpSessionStore), no ContextStore docs, no UserModelStore. Each is a
// straight bolt-on once Phase 2 is shaken out.

import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join as pathJoin } from 'node:path'

import { loadConfig, type Config } from '../config.js'
import { OllamaClient } from '../models/ollama.js'
import { AgentRegistry } from '../agents/registry.js'
import { PersonaManager } from '../persona/manager.js'
import { ToolRegistry } from '../tools/registry.js'
import { createBackend } from '../tools/backends/index.js'
import { BrowserSessionManager } from '../tools/browser/session-manager.js'
import { PermissionGate } from '../agents/permission-gate.js'
import { ActionLog } from '../agents/action-log.js'

export interface CoastalRuntime {
  readonly config: Config
  readonly ollama: OllamaClient
  readonly agentRegistry: AgentRegistry
  readonly personaMgr: PersonaManager
  readonly toolRegistry: ToolRegistry
  readonly gate: PermissionGate
  readonly log: ActionLog
  dispose(): Promise<void>
}

export async function bootRuntime(): Promise<CoastalRuntime> {
  const config = loadConfig()
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.agentWorkdir, { recursive: true })

  const sharedDb = new Database(pathJoin(config.dataDir, 'coastal-ai.db'))
  const agentRegistry = new AgentRegistry(pathJoin(config.dataDir, 'agents.db'))
  const personaMgr = new PersonaManager(pathJoin(config.dataDir, 'persona.db'))

  const ollama = new OllamaClient({ baseUrl: config.ollamaUrl })

  const backend = await createBackend(config.agentTrustLevel, [config.agentWorkdir])
  const browserManager = config.agentTrustLevel !== 'sandboxed'
    ? new BrowserSessionManager()
    : undefined
  const toolRegistry = new ToolRegistry({
    backend,
    browserManager,
    trustLevel: config.agentTrustLevel,
    workdir: config.agentWorkdir,
  })

  const gate = new PermissionGate(sharedDb)
  const log = new ActionLog(sharedDb)

  return {
    config,
    ollama,
    agentRegistry,
    personaMgr,
    toolRegistry,
    gate,
    log,
    async dispose() {
      try { agentRegistry.close?.() } catch { /* noop */ }
      try { personaMgr.close?.() } catch { /* noop */ }
      try { sharedDb.close() } catch { /* noop */ }
      try { await browserManager?.closeAll() } catch { /* noop */ }
    },
  }
}
