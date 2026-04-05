import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    env: {
      MOCK_NAMESPACE: '1',
    },
  },
})
