import { gql } from 'graphql-tag'

export const AGENT_FRAGMENT = gql`
  fragment AgentFields on Agent {
    id
    label
    role
    status
    toolsCount
    lastActivity
  }
`

export const ANALYZE_DEPENDENCIES_QUERY = gql`
  query AnalyzeDependencies($agentId: ID!) {
    analyzeDependencies(agentId: $agentId) {
      agent {
        ...AgentFields
      }
      directDependencies {
        ...AgentFields
      }
      transitiveDependencies {
        ...AgentFields
      }
      dependents {
        ...AgentFields
      }
      cycles {
        ...AgentFields
      }
      impactRadius
      depthToLeaf
    }
  }
  ${AGENT_FRAGMENT}
`

export const IMPACT_ANALYSIS_QUERY = gql`
  query ImpactAnalysis($agentId: ID!) {
    impactAnalysis(agentId: $agentId) {
      agent {
        ...AgentFields
      }
      directDependents {
        ...AgentFields
      }
      indirectDependents {
        ...AgentFields
      }
      totalAffected
      criticalPath {
        ...AgentFields
      }
    }
  }
  ${AGENT_FRAGMENT}
`

export const FIND_CYCLES_QUERY = gql`
  query FindCycles {
    findCycles {
      agentsCaught {
        ...AgentFields
      }
      severity
      cycles {
        ...AgentFields
      }
    }
  }
  ${AGENT_FRAGMENT}
`

export const FIND_PATH_QUERY = gql`
  query FindPath($from: ID!, $to: ID!) {
    findPath(from: $from, to: $to) {
      ...AgentFields
    }
  }
  ${AGENT_FRAGMENT}
`
