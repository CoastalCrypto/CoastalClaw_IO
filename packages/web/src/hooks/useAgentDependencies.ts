import { useQuery } from '@apollo/client'
import {
  ANALYZE_DEPENDENCIES_QUERY,
  IMPACT_ANALYSIS_QUERY,
  FIND_CYCLES_QUERY,
} from '../graphql/queries'

/**
 * Hook for querying agent dependency analysis
 * Returns dependency relationships, impact analysis, and cycle detection
 */
export function useAgentDependencies(agentId: string | null) {
  // Query dependencies
  const {
    data: depsData,
    loading: depsLoading,
    error: depsError,
  } = useQuery(ANALYZE_DEPENDENCIES_QUERY, {
    variables: { agentId: agentId || '' },
    skip: !agentId,
  })

  // Query impact analysis (agents affected if this one fails)
  const {
    data: impactData,
    loading: impactLoading,
    error: impactError,
  } = useQuery(IMPACT_ANALYSIS_QUERY, {
    variables: { agentId: agentId || '' },
    skip: !agentId,
  })

  // Query cycle detection
  const {
    data: cyclesData,
    loading: cyclesLoading,
    error: cyclesError,
  } = useQuery(FIND_CYCLES_QUERY, {
    skip: !agentId,
  })

  return {
    dependencies: depsData?.analyzeDependencies ?? null,
    dependenciesLoading: depsLoading,
    dependenciesError: depsError,

    impact: impactData?.impactAnalysis ?? null,
    impactLoading: impactLoading,
    impactError: impactError,

    cycles: cyclesData?.findCycles ?? null,
    cyclesLoading: cyclesLoading,
    cyclesError: cyclesError,

    isLoading: depsLoading || impactLoading || cyclesLoading,
  }
}
