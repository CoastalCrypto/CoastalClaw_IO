// CLI entry point for the Coastal ACP adapter.
//
// Loads .env, boots the shared CoastalRuntime (Ollama, registries, tools, gate),
// routes ALL logging to stderr (stdout is reserved for ACP JSON-RPC),
// and serves the agent over stdin/stdout via ndJsonStream.
//
// Usage:
//   pnpm --filter @coastal-ai/core acp
//   COASTAL_ACP_PERSONA=cto pnpm --filter @coastal-ai/core acp
//   coastal-acp                          (after install, when bin is on PATH)

import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable, Writable } from 'node:stream'

import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'
import { CoastalACPAgent } from './server.js'
import { bootRuntime } from './runtime.js'

const __dir = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dir, '..', '..', '.env.local'), override: false })
loadEnv({ path: resolve(__dir, '..', '..', '..', '..', 'packages', 'core', '.env.local'), override: false })

function logToStderr(...parts: unknown[]): void {
  process.stderr.write(`[coastal-acp] ${parts.map(String).join(' ')}\n`)
}

async function main(): Promise<void> {
  logToStderr('starting ACP adapter')
  const runtime = await bootRuntime()
  logToStderr(`runtime ready (ollama=${runtime.config.ollamaUrl} trust=${runtime.config.agentTrustLevel})`)

  const stream = ndJsonStream(
    Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
    Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
  )

  const conn = new AgentSideConnection(
    (c) => new CoastalACPAgent(c, runtime, logToStderr),
    stream,
  )

  const shutdown = async (signal: string) => {
    logToStderr(`received ${signal}, shutting down`)
    try { await runtime.dispose() } catch { /* noop */ }
    process.exit(0)
  }
  process.on('SIGINT', () => { void shutdown('SIGINT') })
  process.on('SIGTERM', () => { void shutdown('SIGTERM') })

  void conn
}

main().catch((err) => {
  process.stderr.write(`[coastal-acp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
