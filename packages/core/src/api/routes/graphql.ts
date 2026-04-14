import type { FastifyInstance } from 'fastify'
import { graphql } from 'graphql'
import { buildSchema } from '../../graph/schema.js'
import { queryResolvers } from '../../graph/resolvers.js'
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

        const result = await graphql({
          schema,
          source: query,
          variableValues: variables,
          rootValue: {},
          contextValue: context,
          fieldResolver: (obj, field, args, ctx) => {
            // Route to appropriate resolver based on field name
            const resolvers: Record<string, any> = {
              analyzeDependencies: queryResolvers.analyzeDependencies,
              impactAnalysis: queryResolvers.impactAnalysis,
              findCycles: queryResolvers.findCycles,
              findPath: queryResolvers.findPath
            }
            return resolvers[field]?.(obj, args as any, ctx)
          }
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
