import { describe, it, expect } from 'vitest'
import type { AgentGraphState, GraphNode } from '../../types/agent-graph.js'
import {
  buildDAG,
  analyzeDependencies,
  detectCycles,
  computeImpactRadius,
  findPath
} from '../algorithms.js'

// Helper to create test graph state
function createTestGraph(): AgentGraphState {
  return {
    nodes: [
      { id: 'agent-a', label: 'Agent A', status: 'idle', role: 'Orchestrator', toolsCount: 2 },
      { id: 'agent-b', label: 'Agent B', status: 'idle', role: 'Worker', toolsCount: 1 },
      { id: 'agent-c', label: 'Agent C', status: 'idle', role: 'Worker', toolsCount: 0 },
      { id: 'tool-1', label: 'Tool 1', status: 'idle', role: 'Tool', toolsCount: 0, nodeType: 'tool' }
    ],
    edges: [
      { id: 'a->b', source: 'agent-a', target: 'agent-b', active: false, edgeType: 'agent-model' },
      { id: 'b->c', source: 'agent-b', target: 'agent-c', active: false, edgeType: 'agent-model' },
      { id: 'a->tool', source: 'agent-a', target: 'tool-1', active: false, edgeType: 'agent-tool' }
    ],
    lastUpdated: Date.now()
  }
}

describe('Graph Algorithms', () => {
  it('should build DAG from AgentGraphState', () => {
    const state = createTestGraph()
    const dag = buildDAG(state)

    // DAG should have nodes for agents only (not tools)
    expect(dag.nodes()).toContain('agent-a')
    expect(dag.nodes()).toContain('agent-b')
    expect(dag.nodes()).toContain('agent-c')
  })

  it('should find direct dependencies', () => {
    const state = createTestGraph()
    const deps = analyzeDependencies('agent-a', state)

    expect(deps.agent.id).toBe('agent-a')
    expect(deps.directDependencies.map(a => a.id)).toContain('agent-b')
    expect(deps.transitiveDependencies.map(a => a.id)).toEqual(expect.arrayContaining(['agent-b', 'agent-c']))
  })

  it('should find transitive dependencies', () => {
    const state = createTestGraph()
    const deps = analyzeDependencies('agent-a', state)

    // agent-a depends on agent-b directly, and agent-b depends on agent-c (transitive)
    expect(deps.transitiveDependencies.length).toBe(2)
    expect(deps.transitiveDependencies.map(a => a.id)).toEqual(expect.arrayContaining(['agent-b', 'agent-c']))
  })

  it('should detect no cycles in acyclic graph', () => {
    const state = createTestGraph()
    const cycleReport = detectCycles(state)

    expect(cycleReport.cycles.length).toBe(0)
    expect(cycleReport.severity).toBe('none')
  })

  it('should detect cycles in cyclic graph', () => {
    const state: AgentGraphState = {
      nodes: [
        { id: 'agent-x', label: 'Agent X', status: 'idle', role: 'Worker', toolsCount: 0 },
        { id: 'agent-y', label: 'Agent Y', status: 'idle', role: 'Worker', toolsCount: 0 },
        { id: 'agent-z', label: 'Agent Z', status: 'idle', role: 'Worker', toolsCount: 0 }
      ],
      edges: [
        { id: 'x->y', source: 'agent-x', target: 'agent-y', active: false },
        { id: 'y->z', source: 'agent-y', target: 'agent-z', active: false },
        { id: 'z->x', source: 'agent-z', target: 'agent-x', active: false } // cycle back
      ],
      lastUpdated: Date.now()
    }

    const cycleReport = detectCycles(state)

    expect(cycleReport.cycles.length).toBeGreaterThan(0)
    expect(cycleReport.severity).toBe('critical')
  })

  it('should compute impact radius', () => {
    const state = createTestGraph()
    const impact = computeImpactRadius('agent-a', state)

    // If agent-a fails, agent-b and agent-c are affected (impact radius = 2)
    expect(impact.agent.id).toBe('agent-a')
    expect(impact.totalAffected).toBe(2)
    expect(impact.indirectDependents.map(a => a.id)).toContain('agent-c')
  })

  it('should find path between agents', () => {
    const state = createTestGraph()
    const path = findPath('agent-a', 'agent-c', state)

    expect(path).toEqual(['agent-a', 'agent-b', 'agent-c'])
  })

  it('should return null for no path', () => {
    const state = createTestGraph()
    const path = findPath('agent-c', 'agent-a', state) // reverse direction

    expect(path).toBeNull()
  })
})
