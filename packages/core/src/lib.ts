// Library exports for consumers (daemon, tests, etc.)
// No side effects — importing this does NOT start the HTTP server.
export { loadConfig } from './config.js'
export type { TrustLevel, Config } from './config.js'
export type { AgentFileConfig, AgentHandConfig } from './agents/types.js'
export { IterationBudget } from './agents/iteration-budget.js'
