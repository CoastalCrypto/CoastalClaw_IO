export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
  reversible: boolean
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  id: string
  name: string
  output: string
  error?: string
  durationMs: number
}

export type GateDecision = 'allow' | 'block' | 'queued' | 'approved' | 'denied' | 'timeout'

export interface AgentConfig {
  id: string
  name: string
  role: string
  soulPath: string
  tools: string[]
  modelPref?: string
  builtIn: boolean
  active: boolean
  createdAt: number
}

export interface LoopResult {
  reply: string
  actions: ActionSummary[]
  domain: string
  status: 'complete' | 'error' | 'interrupted'
  error?: string
}

export interface ActionSummary {
  tool: string
  args: Record<string, unknown>
  output: string
  decision: GateDecision
  durationMs: number
}
