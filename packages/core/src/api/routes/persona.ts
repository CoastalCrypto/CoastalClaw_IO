import type { FastifyInstance } from 'fastify'
import { PersonaManager, type Persona } from '../../persona/manager.js'
import { loadConfig } from '../../config.js'
import { join } from 'node:path'

export async function personaRoutes(fastify: FastifyInstance) {
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
    return reply.send({ persona: updated, configured: mgr.isConfigured() })
  })
}
