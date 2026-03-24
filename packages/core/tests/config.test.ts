import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config'

describe('loadConfig', () => {
  it('returns default port 4747', () => {
    const config = loadConfig()
    expect(config.port).toBe(4747)
  })

  it('returns default host 127.0.0.1', () => {
    const config = loadConfig()
    expect(config.host).toBe('127.0.0.1')
  })

  it('overrides port from environment', () => {
    process.env.CC_PORT = '9000'
    const config = loadConfig()
    expect(config.port).toBe(9000)
    delete process.env.CC_PORT
  })
})
