import { loadConfig } from './config.js'
import { buildServer } from './server.js'

const config = loadConfig()
const server = await buildServer()

await server.listen({ port: config.port, host: config.host })
console.log(`[coastal-claw] core running on ${config.host}:${config.port}`)

// Library exports for consumers (e.g. daemon, tests)
export { loadConfig } from './config.js'
export type { TrustLevel, Config } from './config.js'
export type { AgentFileConfig, AgentHandConfig } from './agents/types.js'
export { IterationBudget } from './agents/iteration-budget.js'
