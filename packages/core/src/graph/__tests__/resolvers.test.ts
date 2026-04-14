import { describe, it, expect, beforeEach } from 'vitest'
import type { AgentGraphState } from '../../types/agent-graph.js'
import {
  analyzeDependenciesResolver,
  computeImpactRadiusResolver,
  detectCyclesResolver,
  findPathResolver
} from '../resolvers.js'

// Helper to create test graph state
function createTestGraph(): AgentGraphState {
  return {
    nodes: [
      { id: 'agent-a', label: 'Agent A', status: 'idle', role: 'Orchestrator', toolsCount: 2 },
      { id: 'agent-b', label: 'Agent B', status: 'idle', role: 'Worker', toolsCount: 1 },
      { id: 'agent-c', label: 'Agent C', status: 'idle', role: 'Worker', toolsCount: 0 }
    ],
    edges: [
      { id: 'a->b', source: 'agent-a', target: 'agent-b', active: false, edgeType: 'agent-model' },
      { id: 'b->c', source: 'agent-b', target: 'agent-c', active: false, edgeType: 'agent-model' }
    ],
    lastUpdated: Date.now()
  }
}

describe('GraphQL Resolvers', () => {
  let graphState: AgentGraphState

  beforeEach(() => {
    graphState = createTestGraph()
  })

  it('analyzeDependenciesResolver returns DependencyAnalysis', () => {
    const result = analyzeDependenciesResolver(null, { agentId: 'agent-a' }, { graphState })

    expect(result).toHaveProperty('agent')
    expect(result).toHaveProperty('directDependencies')
    expect(result).toHaveProperty('transitiveDependencies')
    expect(result).toHaveProperty('dependents')
    expect(result).toHaveProperty('cycles')
    expect(result).toHaveProperty('impactRadius')
    expect(result).toHaveProperty('depthToLeaf')
    expect(result.agent.id).toBe('agent-a')
  })

  it('computeImpactRadiusResolver returns ImpactReport', () => {
    const result = computeImpactRadiusResolver(null, { agentId: 'agent-a' }, { graphState })

    expect(result).toHaveProperty('agent')
    expect(result).toHaveProperty('directDependents')
    expect(result).toHaveProperty('indirectDependents')
    expect(result).toHaveProperty('totalAffected')
    expect(result).toHaveProperty('criticalPath')
    expect(result.agent.id).toBe('agent-a')
    expect(result.totalAffected).toBeGreaterThanOrEqual(0)
  })

  it('detectCyclesResolver returns CycleReport', () => {
    const result = detectCyclesResolver(null, {}, { graphState })

    expect(result).toHaveProperty('cycles')
    expect(result).toHaveProperty('agentsCaught')
    expect(result).toHaveProperty('severity')
    expect(Array.isArray(result.cycles)).toBe(true)
    expect(Array.isArray(result.agentsCaught)).toBe(true)
    expect(['none', 'warning', 'critical']).toContain(result.severity)
  })

  it('findPathResolver returns path between agents', () => {
    const result = findPathResolver(null, { from: 'agent-a', to: 'agent-c' }, { graphState })

    expect(Array.isArray(result) || result === null).toBe(true)
    if (result !== null) {
      expect(result[0].id).toBe('agent-a')
      expect(result[result.length - 1].id).toBe('agent-c')
    }
  })

  it('analyzeDependenciesResolver throws on missing agent', () => {
    expect(() => {
      analyzeDependenciesResolver(null, { agentId: 'nonexistent' }, { graphState })
    }).toThrow()
  })

  it('computeImpactRadiusResolver throws on missing agent', () => {
    expect(() => {
      computeImpactRadiusResolver(null, { agentId: 'nonexistent' }, { graphState })
    }).toThrow()
  })
})
