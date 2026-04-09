import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const TEXT_TYPES = new Set([
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

    if (!IMAGE_TYPES.has(mimeType) && !TEXT_TYPES.has(mimeType)) {
      // Drain the stream to avoid memory leaks
      await file.toBuffer().catch(() => {})
      return reply.status(415).send({
        error: `Unsupported file type: ${mimeType}. Allowed: images (PNG, JPEG, GIF, WebP), plain text, markdown, CSV, JSON, XML.`,
      })
    }

    const buf = await file.toBuffer()

    if (buf.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'File too large (max 10 MB)' })
    }

    if (IMAGE_TYPES.has(mimeType)) {
      const dataUrl = `data:${mimeType};base64,${buf.toString('base64')}`
      return reply.send({ filename: file.filename, mimeType, size: buf.length, dataUrl, isImage: true })
    }

    return reply.send({
      filename: file.filename,
      mimeType,
      size: buf.length,
      text: buf.toString('utf8'),
    })
  })
}
