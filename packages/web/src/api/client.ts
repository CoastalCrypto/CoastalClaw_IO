export interface SendMessageOptions {
  message: string
  sessionId?: string
  model?: string
}

export interface SendMessageResult {
  reply: string
  sessionId: string
  domain?: string
  model?: string
}

export interface ModelVariant {
  id: string
  quantLevel: string
  sizeGb: number
  addedAt: number
  active: boolean
}

export interface ModelGroup {
  baseName: string
  hfSource: string
  variants: ModelVariant[]
}

export type RegistryUpdate = Partial<Record<'cfo' | 'cto' | 'coo' | 'general', Record<'high' | 'medium' | 'low', string>>>

export class CoreClient {
  private baseUrl: string
  private sessionToken: string | undefined

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.sessionToken = sessionStorage.getItem('cc_admin_session') ?? undefined
  }

  /** Exchange the raw admin token for a short-lived (24h) session token. */
  async login(adminToken: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: adminToken }),
    })
    if (!res.ok) throw new Error('Invalid admin token')
    const { sessionToken } = await res.json() as { sessionToken: string }
    this.sessionToken = sessionToken
    sessionStorage.setItem('cc_admin_session', sessionToken)
  }

  get isAuthenticated(): boolean {
    return Boolean(this.sessionToken)
  }

  private adminHeaders(): Record<string, string> {
    return this.sessionToken ? { 'x-admin-session': this.sessionToken } : {}
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Chat request failed (${res.status}): ${text}`)
    }

    return res.json()
  }

  async listModels(): Promise<ModelGroup[]> {
    const res = await fetch(`${this.baseUrl}/api/admin/models`, {
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to list models (${res.status})`)
    return res.json()
  }

  async removeModel(quantId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/models/${encodeURIComponent(quantId)}`, {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to remove model (${res.status})`)
  }

  async addModel(hfModelId: string, quants: string[], sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/models/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ hfModelId, quants, sessionId }),
    })
    if (!res.ok) throw new Error(`Failed to start install (${res.status})`)
  }

  async getRegistry(): Promise<RegistryUpdate> {
    const res = await fetch(`${this.baseUrl}/api/admin/registry`, {
      method: 'GET',
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to get registry (${res.status})`)
    return res.json()
  }

  async updateRegistry(updates: RegistryUpdate): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/registry`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to update registry (${res.status}): ${text}`)
    }
  }
}

export const coreClient = new CoreClient('/api')
export const adminClient = new CoreClient('/api')
