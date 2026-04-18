// CLI entry point for the Coastal ACP adapter.
//
// Loads .env (so AgentRegistry/PersonaManager find the configured data dir),
// routes ALL logging to stderr (stdout is reserved for ACP JSON-RPC),
// and serves the agent over stdin/stdout via ndJsonStream.
//
// Usage:
//   node packages/core/dist/acp/entry.js
//   pnpm --filter @coastal-ai/core acp
//   coastal-acp                          (after `pnpm install` if bin is wired)

import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable, Writable } from 'node:stream'

import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'
import { CoastalACPAgent } from './server.js'

const __dir = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dir, '..', '..', '.env.local'), override: false })
loadEnv({ path: resolve(__dir, '..', '..', '..', '..', 'packages', 'core', '.env.local'), override: false })

function logToStderr(...parts: unknown[]): void {
  process.stderr.write(`[coastal-acp] ${parts.map(String).join(' ')}\n`)
}

async function main(): Promise<void> {
  logToStderr('starting ACP adapter')

  const stream = ndJsonStream(
    Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
    Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  )

  const conn = new AgentSideConnection((c) => new CoastalACPAgent(c), stream)

  const shutdown = (signal: string) => {
    logToStderr(`received ${signal}, shutting down`)
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  void conn
}

main().catch((err) => {
  process.stderr.write(`[coastal-acp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
