import type { AgentGraphState } from '../types/agent-graph.js'

/**
 * GraphQL context passed to resolvers
 * Contains the current agent graph state for dependency analysis
 */
export interface GraphQLContext {
  graphState: AgentGraphState
}

/**
 * Create a GraphQL context with the current agent graph state
 * @param graphState - The current state of the agent graph
 * @returns GraphQL context object
 */
export function createGraphQLContext(graphState: AgentGraphState): GraphQLContext {
  return { graphState }
}
