import type {
  QueryResolvers,
  DependencyAnalysis,
  ImpactReport,
  CycleReport
} from './types.js'
import type { AgentGraphState, GraphNode } from '../types/agent-graph.js'
import type { GraphQLContext } from './context.js'
import {
  analyzeDependencies,
  computeImpactRadius,
  detectCycles,
  findPath
} from './algorithms.js'

/**
 * Resolver for Query.analyzeDependencies
 * Returns dependency analysis for a specific agent
 */
export const analyzeDependenciesResolver: QueryResolvers['analyzeDependencies'] = (
  _parent,
  { agentId },
  { graphState }: GraphQLContext
): DependencyAnalysis => {
  const analysis = analyzeDependencies(agentId, graphState)

  return {
    agent: analysis.agent,
    directDependencies: analysis.directDependencies,
    transitiveDependencies: analysis.transitiveDependencies,
    dependents: analysis.dependents,
    cycles: analysis.cycles,
    impactRadius: analysis.impactRadius,
    depthToLeaf: analysis.depthToLeaf
  }
}

/**
 * Resolver for Query.impactAnalysis
 * Returns impact analysis showing which agents would be affected if this one fails
 */
export const computeImpactRadiusResolver: QueryResolvers['impactAnalysis'] = (
  _parent,
  { agentId },
  { graphState }: GraphQLContext
): ImpactReport => {
  const impact = computeImpactRadius(agentId, graphState)

  return {
    agent: impact.agent,
    directDependents: impact.directDependents,
    indirectDependents: impact.indirectDependents,
    totalAffected: impact.totalAffected,
    criticalPath: impact.criticalPath
  }
}

/**
 * Resolver for Query.findCycles
 * Detects all circular dependencies in the agent graph
 */
export const detectCyclesResolver: QueryResolvers['findCycles'] = (
  _parent,
  {},
  { graphState }: GraphQLContext
): CycleReport => {
  const report = detectCycles(graphState)

  return {
    cycles: report.cycles,
    agentsCaught: report.agentsCaught,
    severity: report.severity as 'none' | 'warning' | 'critical'
  }
}

/**
 * Resolver for Query.findPath
 * Finds shortest path between two agents in the dependency graph
 */
export const findPathResolver: QueryResolvers['findPath'] = (
  _parent,
  { from, to },
  { graphState }: GraphQLContext
) => {
  const path = findPath(from, to, graphState)

  if (!path) {
    return null
  }

  // Map path IDs to GraphNode objects
  return path
    .map(id => graphState.nodes.find(n => n.id === id))
    .filter((n): n is GraphNode => n !== undefined)
}

/**
 * Root Query resolver configuration
 * Maps query fields to their resolver implementations
 */
export const queryResolvers: QueryResolvers = {
  analyzeDependencies: analyzeDependenciesResolver,
  impactAnalysis: computeImpactRadiusResolver,
  findCycles: detectCyclesResolver,
  findPath: findPathResolver
}
