import type { FastifyInstance } from 'fastify'
import type { CustomToolLoader } from '../../tools/custom/loader.js'

export async function toolRoutes(fastify: FastifyInstance, opts: { loader: CustomToolLoader }) {
  const { loader } = opts

  // List all custom tools (admin only — server-level hook enforces auth)
  fastify.get('/api/admin/tools', async (_req, reply) => {
    return reply.send(loader.list())
  })

  // Create
  fastify.post<{
    Body: { name: string; description: string; parameters: string; implBody: string }
  }>('/api/admin/tools', async (req, reply) => {
    const { name, description, parameters, implBody } = req.body
    if (!name || !description || !implBody)
      return reply.status(400).send({ error: 'name, description, and implBody are required' })
    try { JSON.parse(parameters || '{}') } catch {
      return reply.status(400).send({ error: 'parameters must be valid JSON' })
    }
    const tool = loader.create({
      name, description,
      parameters: parameters || '{"type":"object","properties":{}}',
      implBody,
    })
    return reply.status(201).send(tool)
  })

  // Update
  fastify.patch<{
    Params: { id: string }
    Body: Partial<{ name: string; description: string; parameters: string; implBody: string; enabled: boolean }>
  }>('/api/admin/tools/:id', async (req, reply) => {
    const updated = loader.update(req.params.id, req.body)
    if (!updated) return reply.status(404).send({ error: 'Tool not found' })
    return reply.send(updated)
  })

  // Delete
  fastify.delete<{ Params: { id: string } }>('/api/admin/tools/:id', async (req, reply) => {
    loader.delete(req.params.id)
    return reply.status(204).send()
  })

  // Test-run without saving — sandboxed execution
  fastify.post<{
    Body: { implBody: string; parameters?: string; args?: Record<string, unknown> }
  }>('/api/admin/tools/test', async (req, reply) => {
    const { implBody, parameters, args = {} } = req.body
    if (!implBody) return reply.status(400).send({ error: 'implBody is required' })
    try {
      const tempTool = (loader as any).buildTool({
        id: 'test', name: 'test', description: 'test',
        parameters: parameters || '{}',
        impl_body: implBody,
      })
      const output = await tempTool.execute(args)
      return reply.send({ output, success: true })
    } catch (e: unknown) {
      return reply.send({ output: (e as Error).message, success: false })
    }
  })
}
