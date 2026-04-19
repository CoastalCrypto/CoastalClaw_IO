export type AgentEventType =
  | 'tool_call_start'
  | 'tool_call_end'
  | 'session_start'
  | 'session_complete'
  | 'token_counted'
  | 'job_run'
  | 'pr_open'
  | 'pipeline_start'
  | 'stage_start'
  | 'stage_steer'
  | 'loop_iteration'
  | 'stage_end'
  | 'pipeline_done'
  | 'pipeline_error'
  | 'graph_edge'
  | 'edge_weight_update'

export interface GraphEdgeEvent {
  type: 'graph_edge'
  ts: number
  source: string
  target: string
  edgeType: 'agent-tool' | 'agent-model' | 'agent-channel'
}

export interface EdgeWeightUpdateEvent {
  type: 'edge_weight_update'
  ts: number
  edgeId: string
  weight: number
  feedbackScore: number
}

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

export interface PipelineStartEvent {
  type: 'pipeline_start'
  ts: number
  runId: string
  pipelineId?: string
  stageCount: number
}

export interface StageStartEvent {
  type: 'stage_start'
  ts: number
  runId: string
  stageIdx: number
  agentId: string
  agentName: string
  iteration: number
}

export interface StageSteerEvent {
  type: 'stage_steer'
  ts: number
  runId: string
  stageIdx: number
  message: string
}

export interface LoopIterationEvent {
  type: 'loop_iteration'
  ts: number
  runId: string
  fromStageIdx: number
  toStageIdx: number
  iteration: number
  condition: string
}

export interface StageEndEvent {
  type: 'stage_end'
  ts: number
  runId: string
  stageIdx: number
  agentId: string
  output: string
  durationMs: number
  iteration: number
}

export interface PipelineDoneEvent {
  type: 'pipeline_done'
  ts: number
  runId: string
  finalOutput: string
  totalDurationMs: number
}

export interface PipelineErrorEvent {
  type: 'pipeline_error'
  ts: number
  runId: string
  stageIdx: number
  error: string
}

export type AgentEvent =
  | ToolCallStartEvent
  | ToolCallEndEvent
  | SessionStartEvent
  | SessionCompleteEvent
  | TokenCountedEvent
  | JobRunEvent
  | PrOpenEvent
  | PipelineStartEvent
  | StageStartEvent
  | StageSteerEvent
  | LoopIterationEvent
  | StageEndEvent
  | PipelineDoneEvent
  | PipelineErrorEvent
  | GraphEdgeEvent
  | EdgeWeightUpdateEvent
