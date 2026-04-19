import type { FastifyInstance } from 'fastify'
import type { KnowledgeStore } from '../../knowledge/store.js'
import type { ModelRouter } from '../../models/router.js'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const TEXT_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/csv',
  'application/json', 'application/xml', 'text/html',
])

const VISION_MODEL = process.env.CC_VISION_MODEL ?? 'llava:latest'
const CAPTION_PROMPT =
  'Caption this image in 2-4 detailed sentences, describing objects, people, text, scene, and any other notable details. '
  + 'Be literal and specific; this caption will be stored as searchable knowledge.'

/**
 * Caption an image via the vision model. Used by the auto-persist step so the
 * image becomes searchable text in the knowledge library. Failures degrade to
 * a placeholder so a missing vision model never blocks the primary chat flow.
 */
async function captionImage(router: ModelRouter, buf: Buffer): Promise<string> {
  const base64 = buf.toString('base64')
  try {
    const { reply } = await router.chat(
      [{ role: 'user', content: CAPTION_PROMPT, images: [base64] }],
      { model: VISION_MODEL },
    )
    return reply.trim()
  } catch (err) {
    console.warn(`[upload] vision captioning failed for model ${VISION_MODEL}:`, err)
    return '[image — caption unavailable: vision model could not process the file]'
  }
}

export async function uploadRoutes(
  fastify: FastifyInstance,
  opts: { knowledgeStore: KnowledgeStore; router: ModelRouter },
) {
  const { knowledgeStore, router } = opts

  // POST /api/upload — extract text from a file for inline use in the current
  // message, and asynchronously persist a copy into the global knowledge
  // library so the agent remembers it in future sessions. The persist step
  // is fire-and-forget: its failure must never block the chat response.
  fastify.post('/api/upload', async (req, reply) => {
    const file = await req.file()
    if (!file) return reply.status(400).send({ error: 'No file provided' })

    const mimeType = file.mimetype.split(';')[0].trim()

    if (!IMAGE_TYPES.has(mimeType) && !TEXT_TYPES.has(mimeType)) {
      await file.toBuffer().catch(() => {})
      return reply.status(415).send({
        error: `Unsupported file type: ${mimeType}. Allowed: images (PNG, JPEG, GIF, WebP), plain text, markdown, CSV, JSON, XML.`,
      })
    }

    const buf = await file.toBuffer()

    if (buf.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'File too large (max 10 MB)' })
    }

    // Auto-persist into the global knowledge library. Text is chunked
    // immediately; images are captioned on a background task since vision
    // models can take several seconds and we don't want to block chat.
    const filename = file.filename
    if (TEXT_TYPES.has(mimeType)) {
      knowledgeStore.ingest({
        title: filename,
        mimeType,
        sizeBytes: buf.length,
        scope: 'global',
        text: buf.toString('utf8'),
        sourceType: 'text',
      }).catch(err => console.warn(`[upload] knowledge persist failed for ${filename}:`, err))
    } else if (IMAGE_TYPES.has(mimeType)) {
      // Detached from the response: caption runs on the vision model in the
      // background, and the resulting knowledge row becomes available on the
      // agent's NEXT message.
      void (async () => {
        try {
          const caption = await captionImage(router, buf)
          if (caption.trim()) {
            await knowledgeStore.ingest({
              title: filename,
              mimeType,
              sizeBytes: buf.length,
              scope: 'global',
              text: caption,
              sourceType: 'image',
            })
          }
        } catch (err) {
          console.warn(`[upload] image knowledge persist failed for ${filename}:`, err)
        }
      })()
    }

    if (IMAGE_TYPES.has(mimeType)) {
      const dataUrl = `data:${mimeType};base64,${buf.toString('base64')}`
      return reply.send({ filename, mimeType, size: buf.length, dataUrl, isImage: true })
    }

    return reply.send({
      filename,
      mimeType,
      size: buf.length,
      text: buf.toString('utf8'),
    })
  })
}
