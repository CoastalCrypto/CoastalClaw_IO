import type { FastifyInstance } from 'fastify'
import { PersonaManager, type Persona } from '../../persona/manager.js'
import { AgentRegistry } from '../../agents/registry.js'
import { loadConfig } from '../../config.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export async function personaRoutes(fastify: FastifyInstance, opts: { registry: AgentRegistry }) {
  const config = loadConfig()
  const mgr = new PersonaManager(join(config.dataDir, 'persona.db'))

  fastify.addHook('onClose', async () => mgr.close())

  /** GET /api/persona — returns current persona + configured flag */
  fastify.get('/api/persona', async (_req, reply) => {
    return reply.send({
      persona: mgr.get(),
      configured: mgr.isConfigured(),
    })
  })

  /** PUT /api/persona — update any subset of persona fields */
  fastify.put<{ Body: Partial<Persona> }>('/api/persona', {
    schema: {
      body: {
        type: 'object',
        properties: {
          agentName:   { type: 'string', minLength: 1, maxLength: 64 },
          agentRole:   { type: 'string', minLength: 1, maxLength: 128 },
          personality: { type: 'string', maxLength: 2000 },
          orgName:     { type: 'string', maxLength: 128 },
          orgContext:  { type: 'string', maxLength: 4000 },
          ownerName:   { type: 'string', maxLength: 64 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const updated = mgr.set(req.body)

    // Sync persona → AgentRegistry so the configured agent appears in the Agents page
    const soul = [
      `# ${updated.agentName}`,
      '',
      updated.personality,
      '',
      updated.orgContext ? `## Organisation\n${updated.orgContext}` : '',
    ].filter(Boolean).join('\n').trim()

    const soulsDir = join(config.dataDir, 'agents', 'souls')
    mkdirSync(soulsDir, { recursive: true })

    const existingId = mgr.getPersonaAgentId()
    if (existingId && opts.registry.get(existingId)) {
      // Update existing persona agent
      const soulPath = join(soulsDir, `${existingId}.md`)
      writeFileSync(soulPath, soul, 'utf8')
      opts.registry.update(existingId, {
        name: updated.agentName,
        role: updated.agentRole,
        soulPath,
      })
    } else {
      // Create new persona agent
      const id = opts.registry.create({
        name: updated.agentName,
        role: updated.agentRole,
        soulPath: '',
        tools: ['read_file', 'list_dir', 'http_get'],
      })
      const soulPath = join(soulsDir, `${id}.md`)
      writeFileSync(soulPath, soul, 'utf8')
      opts.registry.update(id, { soulPath })
      mgr.setPersonaAgentId(id)
    }

    return reply.send({ persona: updated, configured: mgr.isConfigured() })
  })
}
