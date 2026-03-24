import { loadConfig } from './config.js'
import { buildServer } from './server.js'

const config = loadConfig()
const server = await buildServer(config)

await server.listen({ port: config.port, host: config.host })
console.log(`[coastal-claw] core running on ${config.host}:${config.port}`)

export { loadConfig, buildServer }
