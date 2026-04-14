import { buildSchema as buildGraphQLSchema } from 'graphql'

export const typeDefs = `
  enum AgentStatus {
    IDLE
    THINKING
    EXECUTING
    ERROR
    OFFLINE
  }

  type Agent {
    id: ID!
    label: String!
    role: String!
    status: AgentStatus!
    toolsCount: Int!
    lastActivity: Int
  }

  enum EdgeType {
    AGENT_TOOL
    AGENT_MODEL
    AGENT_CHANNEL
  }

  type Edge {
    id: ID!
    source: ID!
    target: ID!
    label: String
    active: Boolean!
    edgeType: EdgeType
  }

  type DependencyAnalysis {
    agent: Agent!
    directDependencies: [Agent!]!
    transitiveDependencies: [Agent!]!
    dependents: [Agent!]!
    cycles: [[Agent!]!]!
    impactRadius: Int!
    depthToLeaf: Int!
  }

  type ImpactReport {
    agent: Agent!
    directDependents: [Agent!]!
    indirectDependents: [Agent!]!
    totalAffected: Int!
    criticalPath: [Agent!]!
  }

  type CycleReport {
    cycles: [[Agent!]!]!
    agentsCaught: [Agent!]!
    severity: String!
  }

  type Query {
    agent(id: ID!): Agent
    agents: [Agent!]!
    analyzeDependencies(agentId: ID!): DependencyAnalysis!
    impactAnalysis(agentId: ID!): ImpactReport!
    findCycles: CycleReport!
    findPath(from: ID!, to: ID!): [Agent!]
  }
`

export function buildSchema() {
  return buildGraphQLSchema(typeDefs)
}
