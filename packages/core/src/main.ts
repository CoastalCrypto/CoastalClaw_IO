// Server entry point — starts the HTTP server.
// Do NOT import this from library consumers (daemon, tests, etc.)
// Library exports live in lib.ts.
import { loadConfig } from './config.js'
import { buildServer } from './server.js'

const config = loadConfig()
const server = await buildServer()

await server.listen({ port: config.port, host: config.host })
console.log(`[coastal-claw] core running on ${config.host}:${config.port}`)
