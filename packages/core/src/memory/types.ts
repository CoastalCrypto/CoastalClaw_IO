export interface MemoryEntry {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface MemoryQuery {
  sessionId: string
  query?: string
  limit?: number
}

export interface MemoryStore {
  write(entry: MemoryEntry): Promise<void>
  query(q: MemoryQuery): Promise<MemoryEntry[]>
  close(): Promise<void>
}
