# GraphQL Agent Dependency Analysis

## Overview

This document describes the GraphQL integration for analyzing agent dependencies, impact radius, and cycle detection in Coastal.AI.

## Architecture

The system consists of three main components:

### 1. Backend (Core Package)

**Location**: `packages/core/src/graph/`

#### Schema (`schema.ts`)
Defines the GraphQL schema with the following types:

- **Agent**: Agent node with id, label, role, status, toolsCount, lastActivity
- **DependencyAnalysis**: Dependencies, transitive dependencies, dependents, cycles, impact metrics
- **ImpactReport**: Direct dependents, indirect dependents, critical path, total affected count
- **CycleReport**: Detected cycles with severity level
- **Query**: Root query type with five resolvers

#### Algorithms (`algorithms.ts`)
Implements graph algorithms using `@dagrejs/graphlib`:

- `buildDAG(state)`: Convert AgentGraphState to directed graph structure
- `analyzeDependencies(agentId, state)`: Identify direct/transitive dependencies
- `computeImpactRadius(agentId, state)`: Calculate impact if agent fails
- `detectCycles(state)`: Find circular dependencies
- `findPath(from, to, state)`: Find shortest dependency path

**Key Semantic**: Edge a→b means "b depends on a" (b is downstream)

#### Resolvers (`resolvers.ts`)
Maps GraphQL queries to algorithm implementations:

```typescript
query {
  analyzeDependencies(agentId: "agent-1") {
    agent { ... }
    directDependencies { ... }
    transitiveDependencies { ... }
    dependents { ... }
    cycles { ... }
    impactRadius
    depthToLeaf
  }

  impactAnalysis(agentId: "agent-1") {
    agent { ... }
    directDependents { ... }
    indirectDependents { ... }
    totalAffected
    criticalPath { ... }
  }

  findCycles {
    cycles { ... }
    agentsCaught { ... }
    severity
  }

  findPath(from: "agent-1", to: "agent-3") {
    # Returns array of agents along shortest path
  }
}
```

#### API Integration (`packages/core/src/api/routes/graphql.ts`)
FastAPI route handler that:
- Builds current AgentGraphState from AgentRegistry
- Accepts GraphQL queries via POST /graphql
- Returns query results with proper error handling

### 2. Frontend (Web Package)

**Location**: `packages/web/src/`

#### Apollo Client (`api/apolloClient.ts`)
- Configured with authentication headers from sessionStorage
- Uses in-memory cache for query results
- Fetch policy: cache-first for queries, cache-and-network for subscriptions

#### Hook (`hooks/useAgentDependencies.ts`)
React hook that queries GraphQL:

```typescript
const { dependencies, impact, cycles, isLoading } = useAgentDependencies(agentId)
```

Returns:
- `dependencies`: Full DependencyAnalysis result
- `impact`: Full ImpactReport result
- `cycles`: CycleReport result
- `isLoading`: Loading state across all three queries
- Individual loading states: `dependenciesLoading`, `impactLoading`, `cyclesLoading`

#### UI Component (`pages/AgentGraph.tsx`)
Updated AgentGraph visualization with expanded side panel showing:
- Basic node information (label, role, status, tools)
- Direct dependencies (cyan highlight)
- Dependents (green highlight)
- Impact radius (red highlight for risk)
- Depth to leaf metric (purple)
- Loading states during query execution

## Data Flow

```
User clicks agent in React Flow
    ↓
AgentGraph component stores selectedId
    ↓
useAgentDependencies hook triggers three GraphQL queries
    ↓
Apollo Client sends HTTP POST to /graphql endpoint
    ↓
Fastify handler builds AgentGraphState from registry
    ↓
Resolvers call graph algorithms on live state
    ↓
Results returned as JSON
    ↓
Side panel updates with dependency analysis data
```

## Query Examples

### Analyze Dependencies
```graphql
query AnalyzeDependencies($agentId: ID!) {
  analyzeDependencies(agentId: $agentId) {
    agent { id label role status toolsCount lastActivity }
    directDependencies { id label role }
    transitiveDependencies { id label role }
    dependents { id label role }
    cycles { id label role }
    impactRadius
    depthToLeaf
  }
}
```

### Impact Analysis
```graphql
query ImpactAnalysis($agentId: ID!) {
  impactAnalysis(agentId: $agentId) {
    agent { id label role }
    directDependents { id label role }
    indirectDependents { id label role }
    totalAffected
    criticalPath { id label role }
  }
}
```

### Find Cycles
```graphql
query FindCycles {
  findCycles {
    cycles {
      id label role
    }
    agentsCaught { id label role }
    severity
  }
}
```

## Testing

### Backend Tests
Located in `packages/core/src/graph/__tests__/`:

- **algorithms.test.ts**: 8 tests covering DAG building, dependency analysis, cycle detection, impact radius, pathfinding
- **resolvers.test.ts**: 6 tests verifying resolver output types and error handling

Run with: `npm test` in `packages/core`

### Frontend Tests
Located in `packages/web/src/hooks/`:

- **useAgentDependencies.test.ts**: Tests hook initialization and structure
- Full integration testing via the running application (recommended)

Run with: `npm test` in `packages/web`

## Deployment Notes

### Prerequisites
- @apollo/client and graphql installed in web package (already configured)
- @dagrejs/graphlib installed in core package (already configured)
- GraphQL schema codegen running (configured in codegen.yml)

### Environment Variables
No special environment variables required. Authentication uses existing session token mechanism via `x-admin-session` header.

### Performance Considerations
- Graph algorithms run synchronously on AgentGraphState snapshot
- Suitable for typical agent graphs (10-100 nodes)
- For large graphs (>1000 agents), consider pagination or incremental analysis
- Results are cached by Apollo Client (cache-first policy for queries)

## Future Enhancements

1. **Incremental Updates**: Stream dependency changes via WebSocket
2. **Visualization Enhancements**: Highlight paths, zoom to selected subtree
3. **Filtering**: Filter dependencies by edge type (tool, model, channel)
4. **Export**: Export dependency graph as DOT or JSON
5. **Performance**: Implement graph partitioning for large deployments

## Troubleshooting

### Queries Return Empty Results
- Verify AgentRegistry.list() returns agents with correct IDs
- Check that edges array is populated in graph state
- Ensure authentication token is valid

### GraphQL Endpoint 404
- Verify GraphQL route is registered in server.ts
- Check that Fastify is running on correct port

### Apollo Cache Issues
- Clear browser localStorage: `sessionStorage.removeItem('apollo-cache')`
- Restart dev server

## References

- [GraphQL Schema](../packages/core/src/graph/schema.ts)
- [Graph Algorithms](../packages/core/src/graph/algorithms.ts)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)
- [dagrejs Documentation](https://github.com/dagrejs/graphlib)
