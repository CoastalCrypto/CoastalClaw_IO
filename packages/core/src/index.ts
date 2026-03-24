import { loadConfig } from './config.js'

const config = loadConfig()
console.log(`[coastal-claw] config loaded — port ${config.port}`)

export { loadConfig }
