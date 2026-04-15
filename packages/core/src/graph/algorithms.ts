import type { AgentGraphState, GraphNode } from '../types/agent-graph.js'
import { Graph } from '@dagrejs/graphlib'

export interface DependencyAnalysis {
  agent: GraphNode
  directDependencies: GraphNode[]
  transitiveDependencies: GraphNode[]
  dependents: GraphNode[]
  cycles: GraphNode[][]
  impactRadius: number
  depthToLeaf: number
}

export interface ImpactReport {
  agent: GraphNode
  directDependents: GraphNode[]
  indirectDependents: GraphNode[]
  totalAffected: number
  criticalPath: GraphNode[]
}

export interface CycleReport {
  cycles: GraphNode[][]
  agentsCaught: GraphNode[]
  severity: 'none' | 'warning' | 'critical'
}

/**
 * Convert AgentGraphState to a directed acyclic graph
 * Only includes agent-to-agent edges, filters out tool/model/channel edges
 */
export function buildDAG(graphState: AgentGraphState): Graph {
  const dag = new Graph()

  // Add agent nodes only
  graphState.nodes
    .filter(n => n.nodeType === 'agent' || !n.nodeType)
    .forEach(node => {
      dag.setNode(node.id, node)
    })

  // Add edges between agents only
  graphState.edges
    .filter(edge => {
      const source = graphState.nodes.find(n => n.id === edge.source)
      const target = graphState.nodes.find(n => n.id === edge.target)
      return (source?.nodeType === 'agent' || !source?.nodeType) &&
             (target?.nodeType === 'agent' || !target?.nodeType)
    })
    .forEach(edge => {
      dag.setEdge(edge.source, edge.target, edge)
    })

  return dag
}

/**
 * Find all agents this one depends on (direct + transitive)
 */
export function analyzeDependencies(
  agentId: string,
  graphState: AgentGraphState
): DependencyAnalysis {
  const dag = buildDAG(graphState)
  const agent = graphState.nodes.find(n => n.id === agentId)

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`)
  }

  // Direct dependencies: immediate successors
  const directDeps = dag.successors(agentId) || []
  const directDependencies = directDeps
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)

  // Transitive dependencies: all reachable nodes
  const visited = new Set<string>()
  const queue = [...directDeps]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const successors = dag.successors(current) || []
    queue.push(...successors)
  }

  const transitiveDependencies = Array.from(visited)
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)

  // Dependents: agents that depend on this one
  const predecessors = dag.predecessors(agentId) || []
  const dependents = predecessors
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)

  // Cycle detection for this agent
  const cycles = detectCyclesForAgent(agentId, dag)

  // Impact radius: how many other agents would be affected
  const impactRadius = transitiveDependencies.length

  // Depth to leaf: longest path from this agent to a leaf
  const depthToLeaf = computeDepthToLeaf(agentId, dag)

  return {
    agent,
    directDependencies,
    transitiveDependencies,
    dependents,
    cycles,
    impactRadius,
    depthToLeaf
  }
}

/**
 * Find all circular dependencies in the graph
 */
export function detectCycles(graphState: AgentGraphState): CycleReport {
  const dag = buildDAG(graphState)
  const cycles: string[][] = []

  // Use DFS to find all cycles
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function hasCycle(node: string, path: string[]): boolean {
    visited.add(node)
    recStack.add(node)
    path.push(node)

    const successors = dag.successors(node) || []
    for (const successor of successors) {
      if (!visited.has(successor)) {
        if (hasCycle(successor, path)) return true
      } else if (recStack.has(successor)) {
        // Found a cycle
        const cycleStart = path.indexOf(successor)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), successor])
        }
        return true
      }
    }

    path.pop()
    recStack.delete(node)
    return false
  }

  // Check all nodes
  dag.nodes().forEach(node => {
    if (!visited.has(node)) {
      hasCycle(node, [])
    }
  })

  const agentsCaught = Array.from(new Set(cycles.flat()))
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)

  return {
    cycles: cycles.map(c =>
      c.map(id => graphState.nodes.find(n => n.id === id)).filter((n): n is GraphNode => n !== undefined)
    ),
    agentsCaught,
    severity: cycles.length > 0 ? 'critical' : 'none'
  }
}

/**
 * Compute which agents would be affected if this one fails
 */
export function computeImpactRadius(
  agentId: string,
  graphState: AgentGraphState
): ImpactReport {
  const dag = buildDAG(graphState)
  const agent = graphState.nodes.find(n => n.id === agentId)

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`)
  }

  // Direct dependents: agents that immediately depend on this one (predecessors — they call this agent)
  const directPredecessors = dag.predecessors(agentId) || []
  const directDependents = directPredecessors
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)

  // Indirect dependents: all agents that transitively depend on this one (excluding direct)
  const visited = new Set<string>()
  const queue = [...directPredecessors]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const predecessors = dag.predecessors(current) || []
    queue.push(...predecessors)
  }

  const indirectDependents = Array.from(visited)
    .filter(id => !directPredecessors.includes(id))  // Exclude direct dependents
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)

  const totalAffected = directDependents.length + indirectDependents.length

  // Critical path: longest dependency chain involving this agent
  const criticalPath = findLongestPath(agentId, dag, graphState)

  return {
    agent,
    directDependents,
    indirectDependents,
    totalAffected,
    criticalPath
  }
}

/**
 * Find shortest path from source to target agent
 */
export function findPath(
  from: string,
  to: string,
  graphState: AgentGraphState
): string[] | null {
  const dag = buildDAG(graphState)

  if (!dag.hasNode(from) || !dag.hasNode(to)) {
    return null
  }

  const visited = new Set<string>()
  const parent: Record<string, string | null> = {}
  const queue = [from]
  parent[from] = null

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === to) {
      // Reconstruct path
      const path: string[] = []
      let node: string | null = to
      while (node !== null) {
        path.unshift(node)
        node = parent[node] || null
      }
      return path
    }

    if (visited.has(current)) continue
    visited.add(current)

    const successors = dag.successors(current) || []
    for (const successor of successors) {
      if (!visited.has(successor)) {
        parent[successor] = current
        queue.push(successor)
      }
    }
  }

  return null
}

// --- Helper functions ---

function detectCyclesForAgent(agentId: string, dag: Graph): GraphNode[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function dfs(node: string, path: string[]): void {
    visited.add(node)
    recStack.add(node)
    path.push(node)

    const successors = dag.successors(node) || []
    for (const successor of successors) {
      if (!visited.has(successor)) {
        dfs(successor, path)
      } else if (recStack.has(successor) && path.includes(agentId)) {
        const cycleStart = path.indexOf(successor)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), successor])
        }
      }
    }

    path.pop()
    recStack.delete(node)
  }

  if (dag.hasNode(agentId)) {
    dfs(agentId, [])
  }

  return cycles.map(cycle =>
    cycle
      .map(id => dag.node(id) as GraphNode | undefined)
      .filter((n): n is GraphNode => n !== undefined)
  )
}

function computeDepthToLeaf(agentId: string, dag: Graph): number {
  if (!dag.hasNode(agentId)) return 0

  const visited = new Set<string>()
  let maxDepth = 0

  function dfs(node: string, depth: number): void {
    visited.add(node)
    const successors = dag.successors(node) || []

    if (successors.length === 0) {
      maxDepth = Math.max(maxDepth, depth)
    }

    for (const successor of successors) {
      if (!visited.has(successor)) {
        dfs(successor, depth + 1)
      }
    }
  }

  dfs(agentId, 0)
  return maxDepth
}

function findLongestPath(agentId: string, dag: Graph, graphState: AgentGraphState): GraphNode[] {
  if (!dag.hasNode(agentId)) return []

  const visited = new Set<string>()
  let longestPath: string[] = []

  function dfs(node: string, path: string[]): void {
    visited.add(node)
    path.push(node)

    const successors = dag.successors(node) || []
    if (successors.length === 0 && path.length > longestPath.length) {
      longestPath = [...path]
    }

    for (const successor of successors) {
      if (!visited.has(successor)) {
        dfs(successor, path)
      }
    }

    path.pop()
    visited.delete(node)
  }

  dfs(agentId, [])

  return longestPath
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)
}
