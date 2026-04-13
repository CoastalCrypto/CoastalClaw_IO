import type { FastifyInstance } from 'fastify'

export async function adminActionsRoutes(fastify: FastifyInstance) {
  fastify.post('/api/admin/restart', async (_req, reply) => {
    // Graceful shutdown then restart
    // If running under systemd/pm2/docker, this will trigger a restart
    setTimeout(() => {
      process.exit(0)
    }, 1000)
    return reply.send({ success: true, message: 'Server restarting...' })
  })
}
