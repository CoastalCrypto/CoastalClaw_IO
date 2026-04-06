export interface SearchResult {
  id: string
  text: string
  score: number
  meta: Record<string, unknown>
}

/**
 * HTTP client for Infinity vector database.
 * Provides hybrid search: dense vectors + sparse + full-text in one query.
 *
 * Install: docker run -p 23817:23817 infiniflow/infinity:latest
 * Docs: https://infiniflow.org/docs
 */
export class InfinityClient {
  constructor(private readonly baseUrl = 'http://localhost:23817') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async upsert(
    collection: string,
    id: string,
    text: string,
    vector: number[],
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${collection}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text, vector, meta }),
    })
    if (!res.ok) throw new Error(`Infinity error ${res.status}: ${await res.text()}`)
  }

  async hybridSearch(
    collection: string,
    query: string,
    queryVector: number[],
    topK = 10,
  ): Promise<SearchResult[]> {
    const res = await fetch(`${this.baseUrl}/${collection}/hybrid_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, vector: queryVector, top_k: topK }),
    })
    if (!res.ok) throw new Error(`Infinity error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { results: SearchResult[] }
    return data.results
  }
}
