import type { FastifyInstance } from 'fastify'
import { graphql } from 'graphql'
import { buildSchema } from '../../graph/schema.js'
import {
  analyzeDependenciesResolver,
  computeImpactRadiusResolver,
  detectCyclesResolver,
  findPathResolver
} from '../../graph/resolvers.js'
import { createGraphQLContext } from '../../graph/context.js'
import type { GraphQLContext } from '../../graph/context.js'
import type { AgentRegistry } from '../../agents/registry.js'
import type { AgentGraphState } from '../../types/agent-graph.js'

/**
 * GraphQL routes plugin
 * Integrates GraphQL endpoint for agent dependency analysis queries
 */
export async function graphQLRoutes(
  fastify: FastifyInstance,
  options: { registry: AgentRegistry }
) {
  const schema = buildSchema()

  /**
   * Build current agent graph state from registry
   * Returns nodes (agents) and edges (connections between agents)
   */
  function buildCurrentGraphState(): AgentGraphState {
    // Get all active agents from registry
    const agents = options.registry.list()

    const nodes = agents.map(agent => ({
      id: agent.id,
      label: agent.name,
      status: ('idle' as const),  // Default status since not tracked in AgentConfig
      role: agent.role,
      toolsCount: agent.tools ? agent.tools.length : 0,
      nodeType: ('agent' as const)
    }))

    // For now, edges are empty - would be populated from agent configuration
    // This can be enhanced to parse agent tools/models for explicit dependencies
    const edges: any[] = []

    return {
      nodes,
      edges,
      lastUpdated: Date.now()
    }
  }

  fastify.post<{ Body: { query: string; variables?: Record<string, unknown> } }>(
    '/graphql',
    async (request, reply) => {
      const { query, variables } = request.body

      if (!query) {
        return reply.status(400).send({
          errors: [{ message: 'Missing query parameter' }]
        })
      }

      try {
        const graphState = buildCurrentGraphState()
        const context: GraphQLContext = createGraphQLContext(graphState)

        // buildSchema() + rootValue calls resolvers as (args, context, info)
        // but our resolvers expect (parent, args, context) — bridge the gap
        const rootValue = {
          analyzeDependencies: (args: Record<string, unknown>) =>
            (analyzeDependenciesResolver as Function)(null, args, context),
          impactAnalysis: (args: Record<string, unknown>) =>
            (computeImpactRadiusResolver as Function)(null, args, context),
          findCycles: (args: Record<string, unknown>) =>
            (detectCyclesResolver as Function)(null, args, context),
          findPath: (args: Record<string, unknown>) =>
            (findPathResolver as Function)(null, args, context),
        }

        const result = await graphql({
          schema,
          source: query,
          variableValues: variables,
          rootValue,
          contextValue: context,
        })

        return reply.send(result)
      } catch (error) {
        console.error('GraphQL error:', error)
        return reply.status(500).send({
          errors: [{ message: 'Internal server error' }]
        })
      }
    }
  )
}
