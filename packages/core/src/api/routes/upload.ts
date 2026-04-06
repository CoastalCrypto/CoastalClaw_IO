import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/csv',
  'application/json', 'application/xml', 'text/html',
])

export async function uploadRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  })

  // POST /api/upload — extract text from a file, return it for inline use in chat
  fastify.post('/api/upload', async (req, reply) => {
    const file = await req.file()
    if (!file) return reply.status(400).send({ error: 'No file provided' })

    const mimeType = file.mimetype.split(';')[0].trim()

    if (!ALLOWED_TYPES.has(mimeType)) {
      // Drain the stream to avoid memory leaks
      await file.toBuffer().catch(() => {})
      return reply.status(415).send({
        error: `Unsupported file type: ${mimeType}. Allowed: plain text, markdown, CSV, JSON, XML.`,
      })
    }

    const buf = await file.toBuffer()
    const text = buf.toString('utf8')

    if (text.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'File content too large (max 5 MB text)' })
    }

    return reply.send({
      filename: file.filename,
      mimeType,
      size: buf.length,
      text,
    })
  })
}
