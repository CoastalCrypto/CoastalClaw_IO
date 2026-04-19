import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ContextStore } from '../context/store.js'
import type { UnifiedMemory } from '../memory/index.js'

export interface KnowledgeDoc {
  id: string
  title: string
  mimeType: string
  sizeBytes: number
  scope: string       // 'global' or agentId
  chunkCount: number
  contextDocIds: string[]   // The context_docs rows this ingested into
  sourceType: 'pdf' | 'docx' | 'text' | 'image' | 'other'
  createdAt: number
}

/** Target chunk size — small enough to embed, large enough to carry meaning */
const CHUNK_CHARS = 1200
/** Chunk overlap so ideas that span a boundary aren't lost to semantic search */
const CHUNK_OVERLAP = 150

/**
 * Breaks a long text into overlapping chunks at sentence-ish boundaries.
 * Not rocket science — just good enough to avoid cutting mid-paragraph.
 */
export function chunkText(text: string, size = CHUNK_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\s+\n/g, '\n').trim()
  if (cleaned.length <= size) return cleaned.length > 0 ? [cleaned] : []
  const chunks: string[] = []
  let cursor = 0
  while (cursor < cleaned.length) {
    const end = Math.min(cursor + size, cleaned.length)
    let cut = end
    if (end < cleaned.length) {
      // Prefer breaking on a paragraph, then sentence, then word
      const paraBreak = cleaned.lastIndexOf('\n\n', end)
      const sentBreak = cleaned.lastIndexOf('. ', end)
      const wordBreak = cleaned.lastIndexOf(' ', end)
      cut = paraBreak > cursor + size * 0.5 ? paraBreak
          : sentBreak > cursor + size * 0.5 ? sentBreak + 1
          : wordBreak > cursor + size * 0.5 ? wordBreak
          : end
    }
    chunks.push(cleaned.slice(cursor, cut).trim())
    if (cut >= cleaned.length) break
    cursor = Math.max(cut - overlap, cursor + 1)
  }
  return chunks.filter(c => c.length > 0)
}

/**
 * Coordinates persistence for uploaded knowledge. A single "doc" ingests
 * into many context_docs rows (one per chunk) so per-agent context
 * injection stays bounded even for big files. The knowledge_docs table
 * is the user-facing manifest; context_docs is the actual substrate.
 */
export class KnowledgeStore {
  constructor(
    private db: Database.Database,
    private contextStore: ContextStore,
    private memory: UnifiedMemory,
  ) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_docs (
        id              TEXT PRIMARY KEY,
        title           TEXT NOT NULL,
        mime_type       TEXT NOT NULL,
        size_bytes      INTEGER NOT NULL,
        scope           TEXT NOT NULL DEFAULT 'global',
        chunk_count     INTEGER NOT NULL,
        context_doc_ids TEXT NOT NULL,
        source_type     TEXT NOT NULL,
        created_at      INTEGER NOT NULL
      )
    `)
  }

  /**
   * Ingest a document's extracted text into the knowledge base.
   * Splits into chunks, persists each chunk as a context_doc in the chosen
   * scope, embeds into UnifiedMemory, and records the manifest.
   */
  async ingest(args: {
    title: string
    mimeType: string
    sizeBytes: number
    scope: string       // 'global' or agentId
    text: string
    sourceType: KnowledgeDoc['sourceType']
  }): Promise<KnowledgeDoc> {
    const chunks = chunkText(args.text)
    const contextDocIds: string[] = []
    const docId = randomUUID()
    const now = Date.now()

    for (let i = 0; i < chunks.length; i++) {
      const chunkTitle = chunks.length === 1 ? args.title : `${args.title} [${i + 1}/${chunks.length}]`
      const doc = this.contextStore.create({
        title: chunkTitle,
        content: chunks[i],
        scope: args.scope,
      })
      contextDocIds.push(doc.id)

      // Fire-and-forget embedding write — failures are logged inside UnifiedMemory
      // and don't block ingestion success since the lossless context_docs row
      // is the source of truth.
      this.memory.write({
        id: `knowledge:${docId}:${i}`,
        sessionId: `knowledge-${args.scope}`,
        role: 'system',
        content: chunks[i],
        timestamp: now,
        metadata: { knowledgeDocId: docId, chunkIndex: i, title: args.title, scope: args.scope },
      }, 'useful').catch(() => {})
    }

    this.db.prepare(`
      INSERT INTO knowledge_docs (id, title, mime_type, size_bytes, scope, chunk_count, context_doc_ids, source_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, args.title, args.mimeType, args.sizeBytes, args.scope, chunks.length, JSON.stringify(contextDocIds), args.sourceType, now)

    return {
      id: docId,
      title: args.title,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      scope: args.scope,
      chunkCount: chunks.length,
      contextDocIds,
      sourceType: args.sourceType,
      createdAt: now,
    }
  }

  list(): KnowledgeDoc[] {
    const rows = this.db.prepare('SELECT * FROM knowledge_docs ORDER BY created_at DESC').all() as Array<{
      id: string; title: string; mime_type: string; size_bytes: number;
      scope: string; chunk_count: number; context_doc_ids: string; source_type: KnowledgeDoc['sourceType']; created_at: number
    }>
    return rows.map(r => ({
      id: r.id, title: r.title, mimeType: r.mime_type, sizeBytes: r.size_bytes,
      scope: r.scope, chunkCount: r.chunk_count,
      contextDocIds: JSON.parse(r.context_doc_ids) as string[],
      sourceType: r.source_type, createdAt: r.created_at,
    }))
  }

  get(id: string): KnowledgeDoc | null {
    const row = this.db.prepare('SELECT * FROM knowledge_docs WHERE id = ?').get(id) as {
      id: string; title: string; mime_type: string; size_bytes: number;
      scope: string; chunk_count: number; context_doc_ids: string; source_type: KnowledgeDoc['sourceType']; created_at: number
    } | undefined
    if (!row) return null
    return {
      id: row.id, title: row.title, mimeType: row.mime_type, sizeBytes: row.size_bytes,
      scope: row.scope, chunkCount: row.chunk_count,
      contextDocIds: JSON.parse(row.context_doc_ids) as string[],
      sourceType: row.source_type, createdAt: row.created_at,
    }
  }

  /** Deletes the manifest + every context_doc chunk it produced */
  delete(id: string): boolean {
    const doc = this.get(id)
    if (!doc) return false
    for (const cid of doc.contextDocIds) this.contextStore.delete(cid)
    this.db.prepare('DELETE FROM knowledge_docs WHERE id = ?').run(id)
    return true
  }
}
