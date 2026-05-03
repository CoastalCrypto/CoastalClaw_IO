import { runCLI } from './cli.js'

runCLI(process.argv.slice(2)).catch(e => {
  console.error(e.message)
  process.exit(1)
})
