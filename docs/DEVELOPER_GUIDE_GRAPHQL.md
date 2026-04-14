# Developer Guide: GraphQL Agent Dependency Analysis

## Quick Start

### For Frontend Developers

To display dependency analysis in a component:

```typescript
import { useAgentDependencies } from '@/hooks/useAgentDependencies'

function MyComponent({ selectedAgentId }: { selectedAgentId: string | null }) {
  const { dependencies, impact, isLoading } = useAgentDependencies(selectedAgentId)

  if (isLoading) return <div>Loading analysis…</div>

  return (
    <div>
      {dependencies && (
        <div>
          <h3>Dependencies ({dependencies.directDependencies.length})</h3>
          {dependencies.directDependencies.map(agent => (
            <div key={agent.id}>{agent.label}</div>
          ))}
        </div>
      )}

      {impact && (
        <div>
          <h3>Affected if This Fails: {impact.totalAffected}</h3>
          {impact.directDependents.map(agent => (
            <div key={agent.id}>{agent.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### For Backend Developers

To add a new graph analysis query:

1. Update schema (`packages/core/src/graph/schema.ts`):
```typescript
export type Query = {
  // ... existing queries
  myNewAnalysis: MyAnalysisResult;
};

export type QueryMyNewAnalysisArgs = {
  agentId: Scalars['ID']['input'];
};

export type MyAnalysisResult = {
  // ... fields
};
```

2. Implement algorithm (`packages/core/src/graph/algorithms.ts`):
```typescript
export function myNewAnalysis(agentId: string, state: AgentGraphState): MyAnalysisResult {
  const dag = buildDAG(state)
  const agent = state.nodes.find(n => n.id === agentId)
  if (!agent) throw new Error(`Agent ${agentId} not found`)
  // ... algorithm logic
  return { /* result */ }
}
```

3. Create resolver (`packages/core/src/graph/resolvers.ts`):
```typescript
export const myNewAnalysisResolver: QueryResolvers['myNewAnalysis'] = (
  _parent,
  { agentId },
  { graphState }
): MyAnalysisResult => {
  return myNewAnalysis(agentId, graphState)
}

export const queryResolvers: QueryResolvers = {
  // ... existing resolvers
  myNewAnalysis: myNewAnalysisResolver,
}
```

4. Regenerate types:
```bash
npm run codegen
```

## Architecture Decisions

### Why GraphQL?

- **Type Safety**: Schema-driven development with type generation
- **Single Endpoint**: Centralized query API (`/graphql`)
- **Client Control**: Clients request only needed fields
- **Future Extensibility**: Easy to add new queries without breaking existing clients

### Why Separate from WebSocket?

- **Dependency Analysis is Stateless**: No need for real-time updates
- **Performance**: Snapshot analysis vs. streaming updates
- **Caching**: Apollo Client efficiently caches results
- **Simplicity**: HTTP POST is simpler than WebSocket for one-shot queries

### Edge Direction Semantics

Edge a→b means "**b depends on a**":
- a→b: a is a dependency of b
- b would be affected if a fails
- Successors of a are things that depend on a
- Predecessors of a are things a depends on

This semantic is important for correct impact analysis.

## Common Patterns

### Caching Dependencies for Multiple Queries

The `useAgentDependencies` hook automatically caches all three queries:

```typescript
// First call - fetches all three queries
const { dependencies, impact } = useAgentDependencies('agent-1')

// Same hook instance reused - uses cached data
const { dependencies, impact } = useAgentDependencies('agent-1')

// Different agent ID - fetches fresh data
const { dependencies, impact } = useAgentDependencies('agent-2')
```

### Handling Loading States Individually

If you need to show different UI per query:

```typescript
const { dependenciesLoading, impactLoading, cyclesLoading } = useAgentDependencies(id)

return (
  <>
    {dependenciesLoading ? <Spinner /> : <Dependencies />}
    {impactLoading ? <Spinner /> : <Impact />}
    {cyclesLoading ? <Spinner /> : <Cycles />}
  </>
)
```

### Highlighting Graph Paths

With the path query result, highlight edges in React Flow:

```typescript
const edges = [...].map(edge => ({
  ...edge,
  animated: pathAgentIds.includes(edge.source) && pathAgentIds.includes(edge.target),
  style: { stroke: isOnPath ? '#00e5ff' : '#666' },
}))
```

## Testing Strategies

### Backend: Algorithm Unit Tests

Test each algorithm with specific graph topologies:

```typescript
const graphState: AgentGraphState = {
  nodes: [
    { id: 'a', label: 'A', status: 'idle', role: 'Worker', toolsCount: 0 },
    { id: 'b', label: 'B', status: 'idle', role: 'Worker', toolsCount: 0 },
  ],
  edges: [
    { id: 'a->b', source: 'a', target: 'b', active: false, edgeType: 'agent-model' },
  ],
  lastUpdated: Date.now(),
}

const result = analyzeDependencies('b', graphState)
expect(result.directDependencies[0].id).toBe('a')
```

### Frontend: Component Integration Tests

Test with real Apollo Client via MockedProvider:

```typescript
const Wrapper = ({ children }) =>
  React.createElement(MockedProvider, { mocks }, children)

const { result } = renderHook(() => useAgentDependencies('agent-1'), { wrapper: Wrapper })
await waitFor(() => expect(result.current.isLoading).toBe(false))
```

### End-to-End: Manual Testing

1. Start dev server: `npm run dev`
2. Navigate to Agent Graph page
3. Click an agent node
4. Verify side panel shows analysis
5. Check Network tab for /graphql requests

## Debugging

### Check Graph State at Runtime

In browser console:

```javascript
// Query current graph state
fetch('/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-session': sessionStorage.getItem('cc_admin_session') },
  body: JSON.stringify({ query: 'query { agents { id label role } }' })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)))
```

### Verify Dependency Calculation

Trace algorithm execution:

```typescript
import { buildDAG, analyzeDependencies } from './algorithms'

const dag = buildDAG(state)
console.log('DAG nodes:', dag.nodes())
console.log('DAG edges:', dag.edges())

const analysis = analyzeDependencies('agent-1', state)
console.log('Analysis:', analysis)
```

### Network Monitoring

Open DevTools Network tab, select /graphql POST requests:
- Request body shows the GraphQL query
- Response shows data structure
- Timing shows server performance

## Performance Considerations

### For Small Graphs (<50 agents)
- Current implementation is optimal
- No optimization needed

### For Medium Graphs (50-500 agents)
- Consider query caching more aggressively
- Implement pagination for cycle detection results
- Profile algorithm complexity with real data

### For Large Graphs (>500 agents)
- Implement graph partitioning
- Query only relevant subgraph
- Use incremental updates via WebSocket
- Consider background computation

## Common Issues

### Issue: Queries Return Null

**Cause**: GraphQLContext not passed to resolvers

**Solution**: Verify graphQLContext is created and passed in graphql() call:

```typescript
const context = createGraphQLContext(graphState)
const result = await graphql({
  // ...
  contextValue: context,
})
```

### Issue: Cycles Detected Incorrectly

**Cause**: DFS recursion stack not properly cleaned

**Solution**: Verify `detectCycles` maintains separate tracking for:
- Visited nodes (global)
- Recursion stack (current path)

### Issue: Apollo Cache Stale Data

**Cause**: Manual graph updates not reflected in Apollo cache

**Solution**: Either:
- Refetch with `refetchQueries` in useQuery
- Clear cache: `apolloClient.cache.reset()`
- Use WebSocket updates to trigger cache invalidation

## Contributing

When adding features to graph analysis:

1. Start with algorithm (backend)
2. Add query to schema
3. Create resolver
4. Regenerate types with codegen
5. Add frontend hook or component
6. Write tests for both backend and frontend
7. Document new features in this guide

Ensure backward compatibility - don't remove or rename existing queries.
