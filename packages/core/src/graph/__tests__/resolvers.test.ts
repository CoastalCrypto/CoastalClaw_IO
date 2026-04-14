import { describe, it, expect, beforeEach } from 'vitest'
import type { AgentGraphState } from '../../types/agent-graph.js'
import {
  analyzeDependencies,
  computeImpactRadius,
  detectCycles,
  findPath
} from '../algorithms.js'
import { createGraphQLContext } from '../context.js'

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

  it('analyzeDependencies returns DependencyAnalysis', () => {
    const result = analyzeDependencies('agent-a', graphState)

    expect(result).toHaveProperty('agent')
    expect(result).toHaveProperty('directDependencies')
    expect(result).toHaveProperty('transitiveDependencies')
    expect(result).toHaveProperty('dependents')
    expect(result).toHaveProperty('cycles')
    expect(result).toHaveProperty('impactRadius')
    expect(result).toHaveProperty('depthToLeaf')
    expect(result.agent.id).toBe('agent-a')
  })

  it('computeImpactRadius returns ImpactReport', () => {
    const result = computeImpactRadius('agent-a', graphState)

    expect(result).toHaveProperty('agent')
    expect(result).toHaveProperty('directDependents')
    expect(result).toHaveProperty('indirectDependents')
    expect(result).toHaveProperty('totalAffected')
    expect(result).toHaveProperty('criticalPath')
    expect(result.agent.id).toBe('agent-a')
    expect(result.totalAffected).toBeGreaterThanOrEqual(0)
  })

  it('detectCycles returns CycleReport', () => {
    const result = detectCycles(graphState)

    expect(result).toHaveProperty('cycles')
    expect(result).toHaveProperty('agentsCaught')
    expect(result).toHaveProperty('severity')
    expect(Array.isArray(result.cycles)).toBe(true)
    expect(Array.isArray(result.agentsCaught)).toBe(true)
    expect(['none', 'warning', 'critical']).toContain(result.severity)
  })

  it('findPath returns path between agents', () => {
    const result = findPath('agent-a', 'agent-c', graphState)

    expect(Array.isArray(result) || result === null).toBe(true)
    if (result !== null) {
      expect(result[0]).toBe('agent-a')
      expect(result[result.length - 1]).toBe('agent-c')
    }
  })

  it('analyzeDependencies throws on missing agent', () => {
    expect(() => {
      analyzeDependencies('nonexistent', graphState)
    }).toThrow()
  })

  it('computeImpactRadius throws on missing agent', () => {
    expect(() => {
      computeImpactRadius('nonexistent', graphState)
    }).toThrow()
  })
})
