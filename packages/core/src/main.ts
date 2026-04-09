// Server entry point — starts the HTTP server.
// Do NOT import this from library consumers (daemon, tests, etc.)
// Library exports live in lib.ts.
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Load packages/core/.env.local (dev) or the file next to main.js (prod dist)
const __dir = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dir, '..', '.env.local'), override: false })
loadEnv({ path: resolve(__dir, '..', '..', '..', 'packages', 'core', '.env.local'), override: false })

import { loadConfig } from './config.js'
import { buildServer } from './server.js'

const config = loadConfig()
const server = await buildServer()

await server.listen({ port: config.port, host: config.host })
console.log(`[coastal-claw] core running on ${config.host}:${config.port}`)
