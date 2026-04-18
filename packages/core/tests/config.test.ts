import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig, invalidateConfig } from '../src/config.js'

describe('loadConfig', () => {
  let originalPort: string | undefined

  beforeEach(() => {
    originalPort = process.env.CC_PORT
    invalidateConfig()
  })

  afterEach(() => {
    if (originalPort === undefined) delete process.env.CC_PORT
    else process.env.CC_PORT = originalPort
    invalidateConfig()
  })

  it('returns default port 4747', () => {
    delete process.env.CC_PORT
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
  })

  it('throws on invalid CC_PORT', () => {
    process.env.CC_PORT = 'abc'
    expect(() => loadConfig()).toThrow('CC_PORT must be a valid port number')
  })
})
