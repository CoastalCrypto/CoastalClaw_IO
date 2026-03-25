import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { loadConfig } from '../../config.js'
import { ModelRegistry } from '../../models/registry.js'
import { QuantizationPipeline } from '../../models/quantizer.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

function getOrCreateAdminToken(dataDir: string): string {
  const envToken = process.env.CC_ADMIN_TOKEN
  if (envToken) return envToken

  const tokenFile = join(dataDir, '.admin-token')
  if (existsSync(tokenFile)) return readFileSync(tokenFile, 'utf8').trim()

  const token = randomBytes(32).toString('hex')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(tokenFile, token)
  console.log(`[coastal-claw] Admin token generated: ${token}`)
  return token
}

export async function adminRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  const adminToken = getOrCreateAdminToken(config.dataDir)
  const modelRegistry = new ModelRegistry(config.dataDir)
  const registryPath = join(config.dataDir, 'model-registry.json')

  // Auth hook for all admin routes
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith('/api/admin')) return
    if (req.headers['x-admin-token'] !== adminToken) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // GET /api/admin/models
  fastify.get('/api/admin/models', async () => {
    return modelRegistry.listGrouped()
  })

  // DELETE /api/admin/models/:quantId
  fastify.delete<{ Params: { quantId: string } }>('/api/admin/models/:quantId', async (req, reply) => {
    const { quantId } = req.params
    // Remove from Ollama (best-effort)
    try {
      await fetch(`${config.ollamaUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quantId }),
      })
    } catch { /* Ollama may not be running */ }
    modelRegistry.deactivate(quantId)
    return reply.status(204).send()
  })

  // POST /api/admin/models/add
  fastify.post<{
    Body: { hfModelId: string; quants: ('Q4_K_M' | 'Q5_K_M' | 'Q8_0')[]; sessionId: string }
  }>('/api/admin/models/add', {
    schema: {
      body: {
        type: 'object',
        required: ['hfModelId', 'quants', 'sessionId'],
        properties: {
          hfModelId: { type: 'string' },
          quants: { type: 'array', items: { type: 'string' } },
          sessionId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { hfModelId, quants, sessionId } = req.body

    if (!hfModelId.includes('/')) {
      return reply.status(400).send({ error: 'hfModelId must be in owner/repo format' })
    }

    // Start pipeline in background
    const pipeline = new QuantizationPipeline({
      dataDir: config.dataDir,
      llamaCppDir: config.llamaCppDir,
      ollamaUrl: config.ollamaUrl,
      onProgress: (event) => {
        // Broadcast to the requesting WebSocket session
        fastify.websocketServer?.clients.forEach((client) => {
          if ((client as any)._sessionId === sessionId) {
            client.send(JSON.stringify(event))
          }
        })
      },
    })

    pipeline.run(hfModelId, quants).catch((err) => {
      console.error('[admin] quantization failed:', err.message)
    })

    return reply.status(202).send({ message: 'Pipeline started', hfModelId, quants })
  })

  // GET /api/admin/registry — returns current registry file contents
  fastify.get('/api/admin/registry', async () => {
    if (!existsSync(registryPath)) return {}
    try { return JSON.parse(readFileSync(registryPath, 'utf8')) } catch { return {} }
  })

  // PATCH /api/admin/registry
  fastify.patch<{
    Body: Partial<Record<'cfo' | 'cto' | 'coo' | 'general', Record<string, string>>>
  }>('/api/admin/registry', async (req, reply) => {
    const updates = req.body

    // Validate all model names exist in registry
    for (const [, urgencyMap] of Object.entries(updates)) {
      for (const [, modelId] of Object.entries(urgencyMap ?? {})) {
        if (!modelRegistry.isActive(modelId)) {
          return reply.status(422).send({ error: `Model not found in registry: ${modelId}` })
        }
      }
    }

    // Load existing registry
    let existing: Record<string, unknown> = {}
    if (existsSync(registryPath)) {
      try { existing = JSON.parse(readFileSync(registryPath, 'utf8')) } catch {}
    }

    // Merge and write
    const merged = { ...existing, ...updates }
    mkdirSync(config.dataDir, { recursive: true })
    writeFileSync(registryPath, JSON.stringify(merged, null, 2))

    return reply.send({ ok: true })
  })

  fastify.addHook('onClose', () => {
    modelRegistry.close()
  })
}
