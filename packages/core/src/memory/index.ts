import { LosslessAdapter } from './lossless.js'
import { Mem0Adapter } from './mem0.js'
import type { MemoryEntry, MemoryQuery } from './types.js'

export interface UnifiedMemoryConfig {
  dataDir: string
  mem0ApiKey?: string
}

export class UnifiedMemory {
  private lossless: LosslessAdapter
  private mem0: Mem0Adapter | null

  constructor(config: UnifiedMemoryConfig) {
    this.lossless = new LosslessAdapter({ dataDir: config.dataDir })
    this.mem0 = config.mem0ApiKey
      ? new Mem0Adapter({ apiKey: config.mem0ApiKey })
      : null
  }

  async write(
    entry: MemoryEntry,
    retention: 'ephemeral' | 'useful' | 'remember' = 'useful'
  ): Promise<void> {
    if (retention === 'ephemeral') return

    await this.lossless.write(entry)

    if (retention === 'remember' && this.mem0) {
      this.mem0
        .remember(entry.sessionId, entry.content)
        .catch((err) => console.warn('[memory] mem0 write failed:', err))
    }
  }

  async queryHistory(q: MemoryQuery): Promise<MemoryEntry[]> {
    return this.lossless.query(q)
  }

  async searchPersonalized(userId: string, query: string) {
    if (!this.mem0) return []
    return this.mem0.search(userId, query)
  }

  async close(): Promise<void> {
    await this.lossless.close()
    // Note: mem0ai MemoryClient has no close() — HTTP connections drain naturally
  }
}

export type { MemoryEntry, MemoryQuery }
