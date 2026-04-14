# GraphQL-First Agent Dependency Analysis Design

**Date:** 2026-04-14
**Status:** Approved
**Priority:** Agent dependencies analysis

---

## Overview

Integrate GraphQL into Coastal.AI's agent graph visualization to enable sophisticated dependency analysis while maintaining backwards compatibility with existing WebSocket real-time updates. This design uses a **schema-first approach** with GraphQL Codegen for type-safe analysis queries.

## Problem Statement

Current agent graph visualization (React Flow + WebSocket) provides real-time node/edge updates but lacks:
- **Dependency querying:** Can't efficiently ask "which agents depend on this one?"
- **Transitive analysis:** No way to trace call chains or impact radius
- **Cycle detection:** Can't identify circular dependencies or deadlocks
- **Type safety:** Manual type definitions that diverge from API contracts

Goal: Add powerful dependency analysis as first-class queries while keeping WebSocket real-time layer intact.

---

## Architecture

### High-Level Flow

```
Frontend (React Flow + GraphQL Client)
  ├─ Real-time visualization (WebSocket)
  └─ Dependency queries (GraphQL)
      │
      └─→ Backend GraphQL API
           ├─ Schema (agents, edges, dependency types)
           ├─ Resolvers (query implementations)
           └─ Graph Algorithms (@dagrejs/graphlib)
                ├─ Direct dependencies
                ├─ Transitive dependencies
                ├─ Cycle detection
                └─ Impact analysis
```

### Key Design Decisions

1. **WebSocket stays:** Real-time visualization continues via existing WebSocket subscription. GraphQL handles analysis queries. Both read from the same `AgentGraphState`.

2. **Schema-first:** Define GraphQL schema as the source of truth. GraphQL Codegen generates TS types → eliminates manual type maintenance.

3. **Graph library:** Use `@dagrejs/graphlib` for dependency analysis algorithms. Provides efficient cycle detection, path finding, and topological sorting.

4. **Future-proof subscriptions:** Design allows WebSocket → GraphQL subscriptions migration later without breaking schema.

---

## GraphQL Schema Design

### Core Types

```graphql
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

type Edge {
  id: ID!
  source: ID!
  target: ID!
  label: String
  active: Boolean!
  edgeType: EdgeType
}

enum EdgeType {
  AGENT_TOOL
  AGENT_MODEL
  AGENT_CHANNEL
}

# Dependency analysis results
type DependencyAnalysis {
  agent: Agent!
  directDependencies: [Agent!]!           # agents this one directly calls
  transitiveDependencies: [Agent!]!       # all agents in the dependency chain
  dependents: [Agent!]!                   # agents that depend on this one
  cycles: [[Agent!]!]!                    # circular dependency chains (if any)
  impactRadius: Int!                      # count of agents affected if this fails
  depthToLeaf: Int!                       # max depth to unreachable agents
}

type ImpactReport {
  agent: Agent!
  directDependents: [Agent!]!             # agents immediately affected
  indirectDependents: [Agent!]!           # agents transitively affected
  totalAffected: Int!
  criticalPath: [Agent!]!                 # longest dependency chain
}

type CycleReport {
  cycles: [[Agent!]!]!                    # all cycles in the graph
  agentsCaught: [Agent!]!                 # agents involved in cycles
  severity: String!                       # warning, critical
}

# Root queries
type Query {
  agent(id: ID!): Agent
  agents: [Agent!]!

  # Dependency analysis
  analyzeDependencies(agentId: ID!): DependencyAnalysis!
  impactAnalysis(agentId: ID!): ImpactReport!
  findCycles: CycleReport!
  findPath(from: ID!, to: ID!): [Agent!]  # shortest path between agents
}
```

### Type Generation

GraphQL Codegen generates TypeScript interfaces:
```typescript
// Generated automatically
interface Agent { ... }
interface DependencyAnalysis { ... }
interface ImpactReport { ... }
// etc.
```

These replace manual types in `packages/web/src/types/agent-graph.ts`.

---

## Backend Implementation

### New Directory Structure

```
packages/core/src/graph/
├── schema.ts           # GraphQL schema definition
├── resolvers.ts        # Query implementations
├── algorithms.ts       # Graph analysis functions
└── types.ts           # GraphQL type definitions
```

### `schema.ts`

Defines the GraphQL schema (shown above). Exported as `buildSchema()` function for server integration.

### `resolvers.ts`

```typescript
export const resolvers = {
  Query: {
    agent: (_, { id }, { graphState }) => {
      return graphState.nodes.find(n => n.id === id)
    },

    analyzeDependencies: (_, { agentId }, { graphState, algorithms }) => {
      return algorithms.analyzeDependencies(agentId, graphState)
    },

    impactAnalysis: (_, { agentId }, { graphState, algorithms }) => {
      return algorithms.computeImpactRadius(agentId, graphState)
    },

    findCycles: (_, {}, { graphState, algorithms }) => {
      return algorithms.detectCycles(graphState)
    },

    findPath: (_, { from, to }, { graphState, algorithms }) => {
      return algorithms.findPath(from, to, graphState)
    }
  }
}
```

### `algorithms.ts`

Uses `@dagrejs/graphlib` to implement:

```typescript
// Convert AgentGraphState to DAG
function buildDAG(graphState: AgentGraphState): Digraph

// Find all agents this one depends on (transitive)
function analyzeDependencies(agentId: string, graphState: AgentGraphState): DependencyAnalysis

// Which agents would break if this one fails?
function computeImpactRadius(agentId: string, graphState: AgentGraphState): ImpactReport

// Find all circular dependencies
function detectCycles(graphState: AgentGraphState): CycleReport

// Shortest path from A to B
function findPath(from: string, to: string, graphState: AgentGraphState): string[] | null
```

### Server Integration

In `packages/core/src/server.ts`:
```typescript
import { buildSchema, resolvers } from './graph/schema.js'
import { ApolloServer } from '@apollo/server'

const graphQLServer = new ApolloServer({
  schema: buildSchema(),
  resolvers,
  context: async (req) => ({
    graphState: getCurrentGraphState(),
    algorithms: require('./graph/algorithms.js')
  })
})

// Mount at /graphql endpoint
app.post('/graphql', graphQLServer.handler())
```

---

## Frontend Integration

### New Hook: `useAgentDependencies`

```typescript
// packages/web/src/hooks/useAgentDependencies.ts
export function useAgentDependencies(agentId: string | null) {
  const { data, loading, error } = useQuery(ANALYZE_DEPENDENCIES_QUERY, {
    variables: { agentId },
    skip: !agentId
  })

  return { analysis: data?.analyzeDependencies, loading, error }
}
```

### Updated AgentGraph Component

When a node is selected, show dependency info:
```typescript
// In AgentGraph.tsx side panel
const { analysis } = useAgentDependencies(selectedNode?.id ?? null)

if (analysis) {
  return (
    <div>
      <h4>Direct Dependencies ({analysis.directDependencies.length})</h4>
      <ul>
        {analysis.directDependencies.map(a => (
          <li key={a.id}>{a.label}</li>
        ))}
      </ul>

      <h4>Impact Radius: {analysis.impactRadius}</h4>

      {analysis.cycles.length > 0 && (
        <div style={{ color: '#ef4444' }}>
          ⚠️ {analysis.cycles.length} cycle(s) detected
        </div>
      )}
    </div>
  )
}
```

### Apollo Client Setup

In `packages/web/src/main.tsx`:
```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'

const client = new ApolloClient({
  link: createHttpLink({
    uri: `${window.location.origin}/graphql`,
    credentials: 'include'
  }),
  cache: new InMemoryCache()
})
```

---

## Data Flow

1. **User selects agent in React Flow**
   - `setSelectedId(agentId)` triggers

2. **useAgentDependencies hook fires GraphQL query**
   ```graphql
   query AnalyzeDependencies($agentId: ID!) {
     analyzeDependencies(agentId: $agentId) {
       agent { id label role }
       directDependencies { id label }
       impactRadius
       cycles { id label }
     }
   }
   ```

3. **Backend resolves query**
   - Read `AgentGraphState` (same state WebSocket uses)
   - Run graph algorithms
   - Return typed `DependencyAnalysis`

4. **Frontend displays results**
   - Side panel shows dependencies, impact radius, cycles
   - Optional: highlight dependency chains in React Flow

5. **Real-time updates continue via WebSocket**
   - Agent status changes flow through WebSocket
   - Graph state updates
   - Next query reflection picks up changes

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Invalid agent ID | GraphQL error: `Agent not found` |
| Large graphs (>10k nodes) | Return cached results, invalidate on state change |
| Circular dependency detected | Included in `DependencyAnalysis.cycles` |
| Query timeout (analysis too complex) | GraphQL error + suggest filtering |

---

## Type Safety

### Current (Manual Types)
```typescript
// packages/web/src/types/agent-graph.ts
export interface GraphNode { ... }
export interface GraphEdge { ... }
// Must manually keep in sync with backend
```

### After (Generated)
```typescript
// Generated from schema.graphql
export type Agent = { ... }
export type DependencyAnalysis = { ... }
// Always in sync — generated from schema
```

**Benefit:** Single source of truth (schema). Types auto-update when schema changes.

---

## Testing Strategy

### Unit Tests
- **algorithms.ts:** Test cycle detection, transitive dependencies, impact radius
  - Mock `AgentGraphState` with known dependency chains
  - Verify results against expected outputs

- **resolvers.ts:** Test query implementations
  - Mock context with test graph state
  - Verify resolver returns correct types

### Integration Tests
- **GraphQL server:** Test full queries against real-ish graph state
- **Frontend hook:** Test `useAgentDependencies` with Apollo MockedProvider

### Visual Testing
- Manually test side panel shows correct dependencies
- Verify dependency highlighting in React Flow (optional visual feature)

---

## Backwards Compatibility

✅ **WebSocket layer unchanged:** Existing real-time visualization continues to work.
✅ **Existing endpoints preserved:** No breaking changes to REST API or WebSocket routes.
✅ **Type migration path:** Gradual adoption of generated types (can coexist with manual types initially).
✅ **Future subscriptions:** Schema designed to support `Subscription { dependenciesChanged }` without redesign.

---

## Performance Considerations

- **Graph algorithms:** O(V+E) for DFS/BFS. Acceptable for typical agent graphs (<1k agents).
- **Caching:** LRU cache dependency analysis results. Invalidate on WebSocket graph_edge events.
- **Query batching:** Use Apollo's `BatchHttpLink` for multiple dependency queries.
- **Large graphs:** Consider lazy evaluation (compute only requested dependencies, not full transitive set).

---

## Future Extensions

1. **GraphQL Subscriptions:** Replace WebSocket events with `Subscription` type
   ```graphql
   type Subscription {
     dependenciesChanged(agentId: ID!): DependencyAnalysis!
   }
   ```

2. **Visualization enhancements:** Highlight dependency chains in React Flow
   - Show path from selected agent to all dependents
   - Color-code by impact radius

3. **Advanced queries:**
   - `commonDependencies(agents: [ID!]!)` — agents all of these depend on
   - `bottlenecks` — agents with highest impact radius
   - `orphans` — agents with no dependencies

---

## Implementation Order

1. Define GraphQL schema (`schema.ts`)
2. Set up GraphQL Codegen + generate TS types
3. Implement graph algorithms (`algorithms.ts`)
4. Write algorithm unit tests
5. Implement resolvers (`resolvers.ts`)
6. Integrate Apollo Server into backend
7. Update frontend: Apollo Client + `useAgentDependencies` hook
8. Update `AgentGraph.tsx` side panel
9. Integration tests
10. Visual testing and polish

---

## Files to Create/Modify

**Create:**
- `packages/core/src/graph/schema.ts`
- `packages/core/src/graph/resolvers.ts`
- `packages/core/src/graph/algorithms.ts`
- `packages/core/src/graph/types.ts`
- `packages/web/src/hooks/useAgentDependencies.ts`
- `packages/web/src/graphql/queries.ts` (GraphQL query definitions)
- `codegen.yml` (GraphQL Codegen config)

**Modify:**
- `packages/core/src/server.ts` (add Apollo Server)
- `packages/web/src/pages/AgentGraph.tsx` (integrate dependency panel)
- `packages/web/src/types/agent-graph.ts` (migrate to generated types)
- Root `package.json` (add @dagrejs/graphlib, @apollo/server, @apollo/client)

---

## Success Criteria

- ✅ Can query agent dependencies via GraphQL
- ✅ Cycle detection works reliably
- ✅ Impact analysis shows correct affected agents
- ✅ All types generated from schema (no manual type maintenance)
- ✅ WebSocket real-time updates unchanged
- ✅ Side panel displays dependency info
- ✅ Tests pass (unit + integration)
- ✅ No breaking changes to existing APIs
