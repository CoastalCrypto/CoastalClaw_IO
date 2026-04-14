import type { FastifyInstance } from 'fastify'
import { AgentRegistry } from '../../agents/registry.js'
import { PermissionGate } from '../../agents/permission-gate.js'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../../config.js'

export async function agentRoutes(
  fastify: FastifyInstance,
  opts: { registry: AgentRegistry; gate: PermissionGate },
) {
  const config = loadConfig()

  // GET /api/admin/agents
  fastify.get('/api/admin/agents', async () => {
    return opts.registry.listAll()
  })

  // POST /api/admin/agents
  fastify.post<{
    Body: { name: string; role: string; soul: string; tools: string[]; modelPref?: string; voice?: string }
  }>('/api/admin/agents', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'role', 'soul', 'tools'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          soul: { type: 'string' },
          tools: { type: 'array', items: { type: 'string' } },
          modelPref: { type: 'string' },
          voice: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { name, role, soul, tools, modelPref, voice } = req.body
    const soulsDir = join(config.dataDir, 'agents', 'souls')
    mkdirSync(soulsDir, { recursive: true })
    const id = opts.registry.create({ name, role, soulPath: '', tools, modelPref, voice })
    const soulPath = join(soulsDir, `${id}.md`)
    writeFileSync(soulPath, soul, 'utf8')
    opts.registry.update(id, { soulPath })
    return reply.status(201).send(opts.registry.get(id))
  })

  // PATCH /api/admin/agents/:id
  fastify.patch<{
    Params: { id: string }
    Body: { name?: string; role?: string; soul?: string; tools?: string[]; modelPref?: string; voice?: string; active?: boolean; bindings?: Array<{ sessionPattern?: string; source?: string; priority: number }> }
  }>('/api/admin/agents/:id', async (req, reply) => {
    const agent = opts.registry.get(req.params.id)
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })
    const { soul, ...rest } = req.body
    if (soul !== undefined) writeFileSync(agent.soulPath, soul, 'utf8')
    opts.registry.update(req.params.id, rest)
    return opts.registry.get(req.params.id)
  })

  // GET /api/admin/agents/:id/soul — returns raw soul markdown
  fastify.get<{ Params: { id: string } }>('/api/admin/agents/:id/soul', async (req, reply) => {
    const agent = opts.registry.get(req.params.id)
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })
    if (!agent.soulPath || !existsSync(agent.soulPath)) return reply.send({ soul: '' })
    return reply.send({ soul: readFileSync(agent.soulPath, 'utf8') })
  })

  // GET /api/admin/agents/:id/credentials
  fastify.get<{ Params: { id: string } }>('/api/admin/agents/:id/credentials', async (req, reply) => {
    const agent = opts.registry.get(req.params.id)
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })
    return opts.registry.getCredentials(req.params.id)
  })

  // PUT /api/admin/agents/:id/credentials
  fastify.put<{
    Params: { id: string }
    Body: { credentials: Record<string, string> }
  }>('/api/admin/agents/:id/credentials', async (req, reply) => {
    const agent = opts.registry.get(req.params.id)
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })
    const incoming = req.body.credentials ?? {}
    const existing = opts.registry.getCredentials(req.params.id)
    // Delete keys removed from the incoming map
    for (const key of Object.keys(existing)) {
      if (!(key in incoming)) opts.registry.deleteCredential(req.params.id, key)
    }
    // Upsert all incoming keys
    for (const [key, value] of Object.entries(incoming)) {
      if (typeof value === 'string') opts.registry.setCredential(req.params.id, key, value)
    }
    return opts.registry.getCredentials(req.params.id)
  })

  // DELETE /api/admin/agents/:id
  fastify.delete<{ Params: { id: string } }>('/api/admin/agents/:id', async (req, reply) => {
    try {
      opts.registry.delete(req.params.id)
      return reply.status(204).send()
    } catch (e: any) {
      return reply.status(403).send({ error: e.message })
    }
  })

  // POST /api/admin/approvals/:id
  fastify.post<{
    Params: { id: string }
    Body: { decision: 'approve' | 'deny' | 'always_allow'; agentId?: string; toolName?: string }
  }>('/api/admin/approvals/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['decision'],
        properties: { decision: { type: 'string', enum: ['approve', 'deny', 'always_allow'] } },
      },
    },
  }, async (req, reply) => {
    const { decision, agentId, toolName } = req.body
    if (decision === 'always_allow' && agentId && toolName) {
      opts.gate.setAlwaysAllow(agentId, toolName)
    }
    const resolved = opts.gate.resolveApproval(req.params.id, decision === 'deny' ? 'denied' : 'approved')
    if (!resolved) return reply.status(404).send({ error: 'Approval not found or already resolved' })
    return reply.send({ ok: true })
  })
}
