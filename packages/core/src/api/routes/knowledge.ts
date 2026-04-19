import type { FastifyInstance } from 'fastify'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import type { KnowledgeStore } from '../../knowledge/store.js'
import type { ModelRouter } from '../../models/router.js'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB — knowledge docs can be larger than chat uploads
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const PDF_TYPES   = new Set(['application/pdf'])
const DOCX_TYPES  = new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
const TEXT_TYPES  = new Set([
  'text/plain', 'text/markdown', 'text/csv',
  'application/json', 'application/xml', 'text/html',
])

/**
 * Vision model used to caption images on ingest. Can be overridden via env var.
 * Defaults to llava (a common Ollama vision model); if unavailable, the caption
 * step degrades gracefully to a stub placeholder so ingestion never hard-fails.
 */
const VISION_MODEL = process.env.CC_VISION_MODEL ?? 'llava:latest'

const CAPTION_PROMPT =
  'Caption this image in 2–4 detailed sentences, describing objects, people, text, scene, and any other notable details. '
  + 'Be literal and specific; this caption will be stored as searchable knowledge.'

type SourceType = 'pdf' | 'docx' | 'text' | 'image' | 'other'

/** Determine the logical source type and supported-ness from a MIME. */
function classifyMime(mime: string): { sourceType: SourceType; supported: boolean } {
  if (PDF_TYPES.has(mime))   return { sourceType: 'pdf',   supported: true }
  if (DOCX_TYPES.has(mime))  return { sourceType: 'docx',  supported: true }
  if (TEXT_TYPES.has(mime))  return { sourceType: 'text',  supported: true }
  if (IMAGE_TYPES.has(mime)) return { sourceType: 'image', supported: true }
  return { sourceType: 'other', supported: false }
}

async function extractPdfText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const res = await parser.getText()
    return res.text ?? ''
  } finally {
    await parser.destroy().catch(() => {})
  }
}

async function extractDocxText(buf: Buffer): Promise<string> {
  const res = await mammoth.extractRawText({ buffer: buf })
  return res.value ?? ''
}

async function captionImage(router: ModelRouter, buf: Buffer): Promise<string> {
  const base64 = buf.toString('base64')
  try {
    const { reply } = await router.chat(
      [{ role: 'user', content: CAPTION_PROMPT, images: [base64] }],
      { model: VISION_MODEL },
    )
    return reply.trim()
  } catch (err) {
    console.warn(`[knowledge] vision captioning failed for model ${VISION_MODEL}:`, err)
    return '[image — caption unavailable: vision model could not process the file]'
  }
}

export async function knowledgeRoutes(
  fastify: FastifyInstance,
  opts: { store: KnowledgeStore; router: ModelRouter },
) {
  // Note: @fastify/multipart is registered globally in server.ts so `req.file()`
  // is already available here. Registering it again would throw FST_ERR_DEC_ALREADY_PRESENT.

  // POST /api/admin/knowledge/ingest — upload a document, extract/caption, ingest.
  fastify.post('/api/admin/knowledge/ingest', async (req, reply) => {
    const file = await req.file()
    if (!file) return reply.status(400).send({ error: 'No file provided' })

    const mime = file.mimetype.split(';')[0].trim()
    const { sourceType, supported } = classifyMime(mime)

    if (!supported) {
      await file.toBuffer().catch(() => {})
      return reply.status(415).send({
        error: `Unsupported file type: ${mime}. Allowed: PDF, DOCX, plain text, markdown, CSV, JSON, XML, HTML, PNG, JPEG, GIF, WebP.`,
      })
    }

    const buf = await file.toBuffer()
    if (buf.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'File too large (max 25 MB)' })
    }

    // Scope arrives as a multipart field on the same request
    const scopeField = file.fields['scope']
    const scope = (scopeField && 'value' in scopeField ? String(scopeField.value) : 'global').trim() || 'global'

    let text = ''
    try {
      if (sourceType === 'pdf')   text = await extractPdfText(buf)
      else if (sourceType === 'docx') text = await extractDocxText(buf)
      else if (sourceType === 'text') text = buf.toString('utf8')
      else if (sourceType === 'image') text = await captionImage(opts.router, buf)
    } catch (err) {
      console.error(`[knowledge] extraction failed for ${file.filename} (${mime}):`, err)
      return reply.status(422).send({ error: `Failed to extract text from ${mime}` })
    }

    if (!text.trim()) {
      return reply.status(422).send({ error: 'No extractable text found in file' })
    }

    const doc = await opts.store.ingest({
      title: file.filename,
      mimeType: mime,
      sizeBytes: buf.length,
      scope,
      text,
      sourceType,
    })

    return reply.send(doc)
  })

  // GET /api/admin/knowledge — list all ingested knowledge docs
  fastify.get('/api/admin/knowledge', async () => {
    return opts.store.list()
  })

  // DELETE /api/admin/knowledge/:id — delete manifest + cascade context_docs
  fastify.delete<{ Params: { id: string } }>('/api/admin/knowledge/:id', async (req, reply) => {
    const ok = opts.store.delete(req.params.id)
    if (!ok) return reply.status(404).send({ error: 'Knowledge doc not found' })
    return { success: true }
  })
}
