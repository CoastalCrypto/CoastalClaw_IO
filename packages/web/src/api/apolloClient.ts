import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client'

/**
 * Apollo Client for GraphQL queries
 * Connects to the backend /graphql endpoint with authentication headers
 */

// Auth link to add session token to outgoing requests
const authLink = new ApolloLink((operation, forward) => {
  const token = sessionStorage.getItem('cc_admin_session') ?? ''
  operation.setContext({
    headers: {
      'x-admin-session': token,
    },
  })
  return forward(operation)
})

// Development: use explicit core API URL. Production: relative URLs work via proxy
const coreBaseUrl = import.meta.env.VITE_CORE_API_URL || 'http://127.0.0.1:4747'
const httpLink = new HttpLink({
  uri: `${coreBaseUrl}/graphql`,
  credentials: 'same-origin',
})

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'cache-first',
    },
  },
})
