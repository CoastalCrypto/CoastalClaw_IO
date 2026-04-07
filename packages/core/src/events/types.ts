export type AgentEventType =
  | 'tool_call_start'
  | 'tool_call_end'
  | 'session_start'
  | 'session_complete'
  | 'token_counted'
  | 'job_run'
  | 'pr_open'

export interface ToolCallStartEvent {
  type: 'tool_call_start'
  ts: number
  sessionId: string
  agentId: string
  toolName: string
  args: Record<string, unknown>
}

export interface ToolCallEndEvent {
  type: 'tool_call_end'
  ts: number
  sessionId: string
  agentId: string
  toolName: string
  durationMs: number
  decision: string
  success: boolean
}

export interface SessionStartEvent {
  type: 'session_start'
  ts: number
  sessionId: string
  agentId: string
}

export interface SessionCompleteEvent {
  type: 'session_complete'
  ts: number
  sessionId: string
  agentId: string
  durationMs: number
  toolCallCount: number
  tokenCount?: number
}

export interface TokenCountedEvent {
  type: 'token_counted'
  ts: number
  sessionId: string
  promptTokens: number
  evalTokens: number
  model: string
}

export interface JobRunEvent {
  type: 'job_run'
  ts: number
  jobName: string
  status: 'started' | 'complete' | 'failed'
}

export interface PrOpenEvent {
  type: 'pr_open'
  ts: number
  title: string
  url?: string
}

export type AgentEvent =
  | ToolCallStartEvent
  | ToolCallEndEvent
  | SessionStartEvent
  | SessionCompleteEvent
  | TokenCountedEvent
  | JobRunEvent
  | PrOpenEvent
