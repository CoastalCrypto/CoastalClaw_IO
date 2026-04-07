export interface Persona {
  agentName: string
  agentRole: string
  personality: string
  orgName: string
  orgContext: string
  ownerName: string
}

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

export interface SystemStats {
  cpu: { percent: number }
  mem: { total: number; used: number; free: number; cached: number }
  disk: Array<{ path: string; total: number; used: number; free: number }>
  gpu: { name: string; vramUsed: number; vramTotal: number; utilPercent: number } | null
  models: string[]
  uptime: number
}

export interface Session {
  id: string
  title: string
  created_at: number
  updated_at: number
}

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

  async getPersona(): Promise<{ persona: Persona; configured: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/persona`)
    if (!res.ok) throw new Error(`Failed to get persona (${res.status})`)
    return res.json()
  }

  async getSystemStats(): Promise<SystemStats> {
    const res = await fetch(`${this.baseUrl}/api/system/stats`)
    if (!res.ok) throw new Error(`Failed to get system stats (${res.status})`)
    return res.json()
  }

  async getLogs(service?: string, lines?: number): Promise<{ service: string; lines: string[] }> {
    const params = new URLSearchParams()
    if (service) params.set('service', service)
    if (lines)   params.set('lines', String(lines))
    const res = await fetch(`${this.baseUrl}/api/admin/logs?${params}`, {
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to get logs (${res.status})`)
    return res.json()
  }

  async triggerUpdate(): Promise<{ ok: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/admin/update`, {
      method: 'POST',
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to trigger update (${res.status})`)
    return res.json()
  }

  async listSessions(limit?: number): Promise<{ sessions: Session[] }> {
    const params = limit ? `?limit=${limit}` : ''
    const res = await fetch(`${this.baseUrl}/api/sessions${params}`)
    if (!res.ok) throw new Error(`Failed to list sessions (${res.status})`)
    return res.json()
  }

  async uploadFile(file: File): Promise<{ filename: string; mimeType: string; size: number; text: string }> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${this.baseUrl}/api/upload`, { method: 'POST', body: form })
    if (!res.ok) {
      const { error } = await res.json() as { error: string }
      throw new Error(error)
    }
    return res.json()
  }

  async runTeam(task: string, sessionId?: string): Promise<{ reply: string; subtaskCount: number; subtasks: Array<{ subtaskId: string; reply: string }> }> {
    const res = await fetch(`${this.baseUrl}/api/team/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, sessionId }),
    })
    if (!res.ok) throw new Error(`Team run failed (${res.status})`)
    return res.json()
  }

  async deleteSession(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async setPersona(updates: Partial<Persona>): Promise<{ persona: Persona; configured: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/persona`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error(`Failed to set persona (${res.status})`)
    return res.json()
  }

  async resolveApproval(
    approvalId: string,
    decision: 'approve' | 'deny' | 'always_allow',
    agentId: string,
    toolName: string,
  ): Promise<void> {
    await fetch(`${this.baseUrl}/api/admin/approvals/${approvalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ decision, agentId, toolName }),
    })
  }

  async getAnalytics(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/analytics`)
    if (!res.ok) throw new Error(`Analytics failed (${res.status})`)
    return res.json()
  }

  async listTools(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/api/admin/tools`, { headers: this.adminHeaders() })
    if (!res.ok) throw new Error(`List tools failed (${res.status})`)
    return res.json()
  }

  async createTool(data: { name: string; description: string; parameters: string; implBody: string }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/admin/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Create tool failed (${res.status}): ${await res.text()}`)
    return res.json()
  }

  async updateTool(id: string, data: Partial<{ name: string; description: string; parameters: string; implBody: string; enabled: boolean }>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/admin/tools/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Update tool failed (${res.status})`)
    return res.json()
  }

  async deleteTool(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/admin/tools/${id}`, {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
  }

  async testTool(data: { implBody: string; parameters?: string; args?: Record<string, unknown> }): Promise<{ output: string; success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/admin/tools/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Test failed (${res.status})`)
    return res.json()
  }

  async listChannels(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/api/admin/channels`, { headers: this.adminHeaders() })
    if (!res.ok) throw new Error(`List channels failed (${res.status})`)
    return res.json()
  }

  async createChannel(data: { type: string; name: string; config: Record<string, string> }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/admin/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Create channel failed (${res.status}): ${await res.text()}`)
    return res.json()
  }

  async updateChannel(id: string, data: Partial<{ name: string; config: Record<string, string>; enabled: boolean }>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/admin/channels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Update channel failed (${res.status})`)
    return res.json()
  }

  async deleteChannel(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/admin/channels/${id}`, {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
  }

  async testChannel(id: string, message?: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/admin/channels/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ message }),
    })
    if (!res.ok) throw new Error(`Test channel failed (${res.status})`)
    return res.json()
  }

  async broadcastChannels(message: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/api/admin/channels/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ message }),
    })
    if (!res.ok) throw new Error(`Broadcast failed (${res.status})`)
    return res.json()
  }
}

export const coreClient = new CoreClient('/api')
export const adminClient = new CoreClient('/api')
