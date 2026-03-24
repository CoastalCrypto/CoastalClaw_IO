import { MemoryClient } from 'mem0ai'

export interface Mem0Result {
  id: string
  content: string
  score: number
}

export class Mem0Adapter {
  private client: MemoryClient

  constructor(config: { apiKey: string }) {
    this.client = new MemoryClient({ apiKey: config.apiKey })
  }

  async remember(userId: string, text: string): Promise<void> {
    await this.client.add(
      [{ role: 'user', content: text }],
      { user_id: userId }
    )
  }

  async search(userId: string, query: string): Promise<Mem0Result[]> {
    const results = await this.client.search(query, { user_id: userId }) as Array<{
      id: string
      memory: string
      score: number
    }>
    return results.map((r) => ({
      id: r.id,
      content: r.memory,
      score: r.score,
    }))
  }
}
