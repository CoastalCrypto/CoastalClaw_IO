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

export interface AgentHandConfig {
  enabled: boolean
  schedule?: string        // natural language: "daily at 08:00", "every 2h"
  triggers?: string[]      // "email from @domain.com", "price_alert BTC > 5%"
  goal?: string            // prose description of what the Hand should do
}

export interface AgentFileConfig {
  id: string
  tools?: string[]
  modelPref?: string
  hand?: AgentHandConfig
  voiceModel?: string  // e.g. "en_US-lessac-medium" — Piper .onnx model name
}

export interface AgentBinding {
  /** Regex string matched against sessionId */
  sessionPattern?: string
  /** Exact match against x-source request header */
  source?: string
  /** Higher number = evaluated first */
  priority: number
}

export interface AgentConfig {
  id: string
  name: string
  role: string
  soulPath: string
  tools: string[]
  modelPref?: string
  voice?: string       // browser SpeechSynthesis voice name, e.g. "Google UK English Male"
  builtIn: boolean
  active: boolean
  createdAt: number
  hand?: AgentHandConfig
  bindings?: AgentBinding[]
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
