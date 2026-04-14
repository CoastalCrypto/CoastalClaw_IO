import type { FastifyInstance } from 'fastify'
import type { UserStore, UserRole } from '../../users/store.js'

export async function userRoutes(fastify: FastifyInstance, opts: { store: UserStore }) {
  const { store } = opts

  // ── Public auth routes ────────────────────────────────────────────────────

  /** Returns whether first-time setup is needed */
  fastify.get('/api/auth/setup', async (_req, reply) => {
    return reply.send({ needsSetup: !store.hasUsers })
  })

  /** First-time setup: create first admin account. Only works when no users exist. */
  fastify.post<{ Body: { username: string; password: string } }>('/api/auth/setup', async (req, reply) => {
    if (store.hasUsers) return reply.status(409).send({ error: 'Setup already complete' })
    const { username, password } = req.body ?? {}
    if (!username || !password) return reply.status(400).send({ error: 'username and password required' })
    if (password.length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters' })
    const user = await store.create(username, password, 'admin')
    const sessionToken = store.createSessionToken(user)
    return reply.status(201).send({ sessionToken, user })
  })

  /** Username + password login */
  fastify.post<{ Body: { username: string; password: string } }>('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { username, password } = req.body ?? {}
    if (!username || !password) return reply.status(400).send({ error: 'username and password required' })
    const user = await store.verifyPassword(username, password)
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' })
    const sessionToken = store.createSessionToken(user)
    return reply.send({ sessionToken, user })
  })

  /** Self-service password change — requires current session, no admin role needed */
  fastify.patch<{ Body: { currentPassword: string; newPassword: string } }>(
    '/api/auth/password',
    async (req, reply) => {
      const header = req.headers['x-admin-session'] ?? ''
      const token = typeof header === 'string' ? header : (header[0] ?? '')
      const claims = store.verifySessionToken(token)
      if (!claims) return reply.status(401).send({ error: 'Unauthorized' })

      const { currentPassword, newPassword } = req.body ?? {}
      if (!currentPassword || !newPassword) return reply.status(400).send({ error: 'currentPassword and newPassword required' })
      if (newPassword.length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters' })

      const user = store.get(claims.userId)
      if (!user) return reply.status(401).send({ error: 'User not found' })

      const verified = await store.verifyPassword(user.username, currentPassword)
      if (!verified) return reply.status(401).send({ error: 'Current password is incorrect' })

      const updated = await store.update(claims.userId, { password: newPassword })
      return reply.send({ user: updated })
    }
  )

  /** Verify current session and return user info */
  fastify.get('/api/auth/me', async (req, reply) => {
    const header = req.headers['x-admin-session'] ?? ''
    const token = typeof header === 'string' ? header : (header[0] ?? '')
    const claims = store.verifySessionToken(token)
    if (!claims) return reply.status(401).send({ error: 'Unauthorized' })
    const user = store.get(claims.userId)
    if (!user) return reply.status(401).send({ error: 'User not found' })
    return reply.send({ user })
  })

  // ── Admin-gated user management ────────────────────────────────────────────

  fastify.get('/api/admin/users', async (_req, reply) => {
    return reply.send(store.list())
  })

  fastify.post<{
    Body: { username: string; password: string; role?: UserRole }
  }>('/api/admin/users', async (req, reply) => {
    const { username, password, role = 'operator' } = req.body ?? {}
    if (!username || !password) return reply.status(400).send({ error: 'username and password required' })
    if (password.length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters' })
    if (!(['admin', 'operator', 'viewer'] as const).includes(role)) {
      return reply.status(400).send({ error: 'role must be admin, operator, or viewer' })
    }
    try {
      const user = await store.create(username, password, role)
      return reply.status(201).send(user)
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) return reply.status(409).send({ error: 'Username already exists' })
      throw e
    }
  })

  fastify.patch<{
    Params: { id: string }
    Body: Partial<{ username: string; password: string; role: UserRole }>
  }>('/api/admin/users/:id', async (req, reply) => {
    const updated = await store.update(req.params.id, req.body ?? {})
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send(updated)
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/users/:id', async (req, reply) => {
    store.delete(req.params.id)
    return reply.status(204).send()
  })
}
