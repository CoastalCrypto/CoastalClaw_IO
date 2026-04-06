import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { loadConfig } from '../../config.js'

export async function sessionRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  const db = new Database(join(config.dataDir, 'sessions.db'))

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'New conversation',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `)

  // GET /api/sessions — list recent sessions
  fastify.get<{ Querystring: { limit?: string } }>('/api/sessions', async (req, reply) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const rows = db.prepare(
      'SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?'
    ).all(limit)
    return reply.send({ sessions: rows })
  })

  // PUT /api/sessions/:id — upsert session (called by chat route after first reply)
  fastify.put<{
    Params: { id: string }
    Body: { title?: string }
  }>('/api/sessions/:id', {
    schema: {
      body: {
        type: 'object',
        properties: { title: { type: 'string', maxLength: 120 } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params
    const title = req.body.title ?? 'New conversation'
    const now = Date.now()
    db.prepare(`
      INSERT INTO sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at
    `).run(id, title.slice(0, 120), now, now)
    return reply.send({ ok: true })
  })

  // DELETE /api/sessions/:id
  fastify.delete<{ Params: { id: string } }>('/api/sessions/:id', async (req, reply) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id)
    return reply.send({ ok: true })
  })

  fastify.addHook('onClose', async () => db.close())
}
