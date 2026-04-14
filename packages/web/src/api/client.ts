export const SESSION_EXPIRED = 'SESSION_EXPIRED' as const

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
  images?: string[]
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

export interface OllamaModel {
  name: string
  sizeGb: number
  modifiedAt: string
  imported: boolean
}

export type RegistryUpdate = Record<string, Record<string, string>>

export interface AgentRecord {
  id: string
  name: string
  role: string
  builtIn: boolean
  active: boolean
}

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
    // Don't cache at construction — read fresh in adminHeaders() so user
    // sessions set after module load are picked up automatically.
  }

  /**
   * Safely extracts an error message from a failed response.
   * Reads body as text first to avoid "Unexpected end of JSON input" when
   * the server returns an empty or non-JSON error body.
   */
  private async extractError(res: Response, fallback: string): Promise<never> {
    let message = fallback
    try {
      const text = await res.text()
      if (text) {
        const json = JSON.parse(text)
        if (json.error) message = json.error
        else if (json.message) message = json.message
      }
    } catch {
      // body was not JSON — use fallback
    }
    throw new Error(message)
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
    return Boolean(this.sessionToken ?? sessionStorage.getItem('cc_admin_session'))
  }

  /** Throw SESSION_EXPIRED if response is 401 so callers can redirect to login */
  private checkAuth(res: Response): void {
    if (res.status === 401) throw new Error(SESSION_EXPIRED)
  }

  private adminHeaders(): Record<string, string> {
    const token = this.sessionToken ?? sessionStorage.getItem('cc_admin_session') ?? ''
    return token ? { 'x-admin-session': token } : {}
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
    this.checkAuth(res)
    if (!res.ok) throw new Error(`Failed to list models (${res.status})`)
    return res.json()
  }

  async removeModel(quantId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/models/${encodeURIComponent(quantId)}`, {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
    this.checkAuth(res)
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

  async listOllamaModels(): Promise<{ ollamaUrl: string; models: OllamaModel[]; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/admin/ollama/models`, {
      headers: this.adminHeaders(),
    })
    this.checkAuth(res)
    const data = await res.json() as { ollamaUrl: string; models: OllamaModel[]; error?: string }
    return data
  }

  async importOllamaModel(name: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/ollama/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`Failed to import model (${res.status})`)
  }

  async syncOllamaModels(): Promise<{ synced: number }> {
    const res = await fetch(`${this.baseUrl}/api/admin/ollama/sync`, {
      method: 'POST',
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to sync Ollama models (${res.status})`)
    return res.json()
  }

  async pullOllamaModel(name: string, sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/ollama/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ name, sessionId }),
    })
    if (!res.ok) throw new Error(`Failed to start pull (${res.status}): ${await res.text()}`)
  }

  async getRegistry(): Promise<RegistryUpdate> {
    const res = await fetch(`${this.baseUrl}/api/admin/registry`, {
      method: 'GET',
      headers: this.adminHeaders(),
    })
    this.checkAuth(res)
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

  async checkForUpdate(): Promise<{ updateAvailable: boolean; localCommit: string; remoteCommit: string | null }> {
    const res = await fetch(`${this.baseUrl}/api/admin/update-check`, { headers: this.adminHeaders() })
    if (!res.ok) return { updateAvailable: false, localCommit: 'unknown', remoteCommit: null }
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

  async uploadFile(file: File): Promise<{ filename: string; mimeType: string; size: number; text?: string; dataUrl?: string; isImage?: boolean }> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${this.baseUrl}/api/upload`, { method: 'POST', body: form })
    if (!res.ok) await this.extractError(res, `Upload failed (${res.status})`)
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

  // ── Auth / Users ────────────────────────────────────────────────────────────

  async checkSetup(): Promise<{ needsSetup: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/auth/setup`)
    if (!res.ok) throw new Error(`Setup check failed (${res.status})`)
    return res.json()
  }

  async setupFirstUser(username: string, password: string): Promise<{ sessionToken: string; user: any }> {
    const res = await fetch(`${this.baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) await this.extractError(res, `Setup failed (${res.status})`)
    return res.json()
  }

  async loginUser(username: string, password: string): Promise<{ sessionToken: string; user: any }> {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) await this.extractError(res, `Login failed (${res.status})`)
    return res.json()
  }

  async getMe(): Promise<{ user: any }> {
    const res = await fetch(`${this.baseUrl}/api/auth/me`, { headers: this.adminHeaders() })
    if (!res.ok) throw new Error('Not authenticated')
    return res.json()
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ user: any }> {
    const res = await fetch(`${this.baseUrl}/api/auth/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    if (!res.ok) await this.extractError(res, `Failed (${res.status})`)
    return res.json()
  }

  setSession(token: string): void {
    this.sessionToken = token
    sessionStorage.setItem('cc_admin_session', token)
  }

  clearSession(): void {
    this.sessionToken = undefined
    sessionStorage.removeItem('cc_admin_session')
    sessionStorage.removeItem('cc_user')
  }

  async listAgents(): Promise<AgentRecord[]> {
    const res = await fetch(`${this.baseUrl}/api/admin/agents`, { headers: this.adminHeaders() })
    if (!res.ok) throw new Error(`Failed to list agents (${res.status})`)
    return res.json()
  }

  async listUsers(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/api/admin/users`, { headers: this.adminHeaders() })
    if (!res.ok) throw new Error(`List users failed (${res.status})`)
    return res.json()
  }

  async createUser(username: string, password: string, role: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ username, password, role }),
    })
    if (!res.ok) await this.extractError(res, `Create user failed (${res.status})`)
    return res.json()
  }

  async updateUser(id: string, data: { role?: string; password?: string; username?: string }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Update user failed (${res.status})`)
    return res.json()
  }

  async deleteUser(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
  }

  async getTrustLevel(): Promise<'sandboxed' | 'trusted' | 'autonomous'> {
    const res = await fetch(`${this.baseUrl}/api/admin/trust-level`, { headers: this.adminHeaders() })
    if (!res.ok) throw new Error(`Failed to get trust level (${res.status})`)
    const { level } = await res.json() as { level: 'sandboxed' | 'trusted' | 'autonomous' }
    return level
  }

  async setTrustLevel(level: 'sandboxed' | 'trusted' | 'autonomous'): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/trust-level`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ level }),
    })
    if (!res.ok) throw new Error(`Failed to set trust level (${res.status})`)
  }
}

export const coreClient = new CoreClient('')
export const adminClient = new CoreClient('')
