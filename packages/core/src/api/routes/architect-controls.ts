import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ControlRouteDeps {
  dataDir: string
}

export async function architectControlRoutes(app: FastifyInstance, deps: ControlRouteDeps): Promise<void> {
  const { dataDir } = deps
  const modeFile = join(dataDir, '.architect-mode')
  const pidFile = join(dataDir, '.architect-pid')

  function getState(): { power: 'on' | 'off'; mode: string } {
    const power = existsSync(pidFile) ? 'on' : 'off'
    let mode = 'hands-on'
    if (existsSync(modeFile)) {
      try {
        mode = JSON.parse(readFileSync(modeFile, 'utf8')).mode ?? 'hands-on'
      } catch {
        // Ignore parse errors, use default
      }
    }
    return { power, mode }
  }

  app.get('/api/admin/architect/status', async () => {
    return getState()
  })

  app.post('/api/admin/architect/power', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const powerSchema = z.object({ state: z.enum(['on', 'off']) })
    const parsed = powerSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() })
    const { state } = parsed.data
    // Power control is signaled to the daemon process — here we just record intent.
    // The daemon reads this on next tick. For 'off', removing the PID file signals shutdown.
    if (state === 'off' && existsSync(pidFile)) {
      // Signal daemon to stop — in v1.5.0 the daemon polls this file
      writeFileSync(join(dataDir, '.architect-shutdown'), '1')
    }
    return { ok: true, power: state }
  })

  app.post('/api/admin/architect/mode', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const modeSchema = z.object({
      mode: z.enum(['hands-on', 'hands-off', 'autopilot', 'custom']),
    })
    const parsed = modeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() })
    const { mode } = parsed.data
    writeFileSync(modeFile, JSON.stringify({ mode, updatedAt: Date.now() }))
    return { ok: true, mode }
  })

  app.post('/api/admin/architect/run-now', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (_req, reply) => {
    // Signal the daemon to run a tick immediately
    writeFileSync(join(dataDir, '.architect-run-now'), '1')
    return { ok: true, message: 'Tick requested' }
  })
}
