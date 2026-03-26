export interface RouteSignals {
  relation: 'new' | 'follow_up' | 'correction' | 'confirmation' | 'cancellation' | 'closure'
  actionability: 'none' | 'review' | 'act'
  retention: 'ephemeral' | 'useful' | 'remember'
  urgency: 'low' | 'medium' | 'high'
  confidence: number
}

export interface RouteDecision {
  model: string
  fallbackModels: string[]   // ordered: try these if primary fails
  domain: 'coo' | 'cfo' | 'cto' | 'general'
  signals: RouteSignals
  domainConfidence: number
  classifiedBy: 'rules' | 'llm'
}

export const ROUTE_SIGNALS_FALLBACK: RouteSignals = {
  relation: 'new',
  urgency: 'medium',
  actionability: 'act',
  retention: 'useful',
  confidence: 0,
}
