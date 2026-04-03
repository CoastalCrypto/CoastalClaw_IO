// packages/daemon/src/index.ts
import 'dotenv/config'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ProactiveScheduler, parseCronExpression } from './scheduler.js'
import { HandRunner } from './hand-runner.js'
import { VoicePipeline } from './voice/pipeline.js'
import { randomUUID } from 'node:crypto'

const AGENTS_DIR = join(process.cwd(), 'agents')
const CHECK_INTERVAL_MS = Number(process.env.CC_DAEMON_INTERVAL_MS ?? '60000')

interface AgentHandConfig {
  enabled: boolean
  schedule?: string
  triggers?: string[]
  goal?: string
}

interface AgentFileConfig {
  id: string
  tools?: string[]
  modelPref?: string
  hand?: AgentHandConfig
}

function loadHandJobs() {
  if (!existsSync(AGENTS_DIR)) return []

  const agentDirs = readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  const jobs = []
  for (const id of agentDirs) {
    const cfgPath = join(AGENTS_DIR, id, 'config.json')
    if (!existsSync(cfgPath)) continue
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as AgentFileConfig
      if (cfg.hand?.enabled && cfg.hand.schedule) {
        jobs.push({
          agentId: id,
          cronExpr: parseCronExpression(cfg.hand.schedule),
          goal: cfg.hand.goal ?? `Run the ${id} agent hand.`,
        })
      }
    } catch { /* skip invalid config */ }
  }
  return jobs
}

async function main() {
  console.log('[coastal-daemon] Starting...')

  const baseUrl = process.env.CC_SERVER_URL ?? 'http://localhost:4747'
  const runner = new HandRunner(baseUrl)
  const scheduler = new ProactiveScheduler((job) => {
    const sessionId = `hand-${job.agentId}-${randomUUID().slice(0, 8)}`
    console.log(`[coastal-daemon] Firing hand: ${job.agentId} (session: ${sessionId})`)
    runner.run(job.agentId, job.goal, sessionId).then(result => {
      console.log(`[coastal-daemon] Hand complete: ${job.agentId} — ${result.status}`)
    }).catch(e => {
      console.error(`[coastal-daemon] Hand failed: ${job.agentId}`, e)
    })
  })

  for (const job of loadHandJobs()) {
    scheduler.register(job)
    console.log(`[coastal-daemon] Registered hand: ${job.agentId} @ ${job.cronExpr}`)
  }

  scheduler.start(CHECK_INTERVAL_MS)
  console.log(`[coastal-daemon] Running. Check interval: ${CHECK_INTERVAL_MS}ms`)

  const trustLevel = process.env.CC_TRUST_LEVEL ?? 'sandboxed'
  let voicePipeline: VoicePipeline | null = null

  if (trustLevel === 'autonomous') {
    console.log('[coastal-daemon] AUTONOMOUS tier — starting voice pipeline...')
    voicePipeline = new VoicePipeline({
      onTranscript: async (text: string) => {
        const sessionId = `voice-${randomUUID().slice(0, 8)}`
        const result = await runner.run('general', text, sessionId)
        return result.reply ?? 'I could not process that.'
      },
    })
    voicePipeline.start()
    console.log('[coastal-daemon] Voice pipeline active. Say "Hey Coastal" to begin.')
  }

  process.on('SIGTERM', async () => {
    voicePipeline?.stop()
    scheduler.stop()
    process.exit(0)
  })
  process.on('SIGINT', async () => {
    voicePipeline?.stop()
    scheduler.stop()
    process.exit(0)
  })
}

main().catch(e => { console.error('[coastal-daemon] Fatal:', e); process.exit(1) })
