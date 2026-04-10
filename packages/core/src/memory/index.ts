import { LosslessAdapter } from './lossless.js'
import { Mem0Adapter } from './mem0.js'
import { InfinityClient, type SearchResult } from './infinity-client.js'
import type { MemoryEntry, MemoryQuery } from './types.js'

export interface UnifiedMemoryConfig {
  dataDir: string
  mem0ApiKey?: string
  infinityUrl?: string
}

export class UnifiedMemory {
  private lossless: LosslessAdapter
  private mem0: Mem0Adapter | null
  private infinity: InfinityClient
  private infinityAvailable = false

  constructor(config: UnifiedMemoryConfig) {
    this.lossless = new LosslessAdapter({ dataDir: config.dataDir })
    this.mem0 = config.mem0ApiKey
      ? new Mem0Adapter({ apiKey: config.mem0ApiKey })
      : null
    this.infinity = new InfinityClient(config.infinityUrl ?? 'http://localhost:23817')
    // Probe Infinity in background — don't block constructor
    this.infinity.isAvailable().then(ok => {
      this.infinityAvailable = ok
      if (ok) console.log('[memory] Infinity vector DB connected')
    }).catch(() => {})
  }

  async write(
    entry: MemoryEntry,
    retention: 'ephemeral' | 'useful' | 'remember' = 'useful'
  ): Promise<void> {
    if (retention === 'ephemeral') return

    await this.lossless.write(entry)

    if (this.infinityAvailable) {
      this.infinity
        .upsert('memories', entry.id ?? entry.sessionId, entry.content, [], { sessionId: entry.sessionId, role: entry.role })
        .catch((err) => console.warn('[memory] infinity upsert failed:', err))
    }

    if (retention === 'remember' && this.mem0) {
      this.mem0
        .remember(entry.sessionId, entry.content)
        .catch((err) => console.warn('[memory] mem0 write failed:', err))
    }
  }

  async semanticSearch(query: string, vector: number[], topK = 10): Promise<SearchResult[]> {
    if (this.infinityAvailable) {
      return this.infinity.hybridSearch('memories', query, vector, topK)
    }
    // Fallback: SQLite LIKE search via lossless adapter
    const all = await this.lossless.query({ sessionId: '', limit: 500 })
    const lower = query.toLowerCase()
    return all
      .filter(e => e.content.toLowerCase().includes(lower))
      .slice(0, topK)
      .map(e => ({ id: e.sessionId, text: e.content, score: 1, meta: { role: e.role } }))
  }

  async queryHistory(q: MemoryQuery): Promise<MemoryEntry[]> {
    return this.lossless.query(q)
  }

  search(query: string, limit?: number): MemoryEntry[] {
    return this.lossless.search(query, limit)
  }

  async searchPersonalized(userId: string, query: string) {
    if (!this.mem0) return []
    return this.mem0.search(userId, query)
  }

  /**
   * Flush entries beyond `windowSize` to mem0 before they fall out of the
   * active context window. Call fire-and-forget from chatRoutes.
   * No-op when mem0 is not configured.
   */
  async flushOldEntries(sessionId: string, windowSize = 20): Promise<void> {
    if (!this.mem0) return
    // Fetch one extra page beyond the window to find displaced entries
    const overflow = await this.lossless.query({ sessionId, limit: windowSize * 2 })
    const displaced = overflow.slice(windowSize)
    if (displaced.length === 0) return
    for (const entry of displaced) {
      this.mem0
        .remember(sessionId, `[${entry.role}]: ${entry.content}`)
        .catch((err) => console.warn('[memory] flush to mem0 failed:', err))
    }
  }

  async close(): Promise<void> {
    await this.lossless.close()
    // Note: mem0ai MemoryClient has no close() — HTTP connections drain naturally
  }
}

export type { MemoryEntry, MemoryQuery }
