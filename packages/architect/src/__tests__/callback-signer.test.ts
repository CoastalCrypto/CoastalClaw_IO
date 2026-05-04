import { describe, it, expect } from 'vitest'
import { CallbackSigner } from '../callback-signer.js'

describe('CallbackSigner', () => {
  it('signs and verifies a valid token', () => {
    const key = CallbackSigner.generateKey()
    const signer = new CallbackSigner(key)
    const payload = {
      cycleId: 'cycle-123',
      gate: 'plan',
      decision: 'approved',
      expiresAt: Date.now() + 60000,
    }
    const token = signer.sign(payload)
    const verified = signer.verify(token)
    expect(verified).toEqual(payload)
  })

  it('rejects tampered token', () => {
    const key = CallbackSigner.generateKey()
    const signer = new CallbackSigner(key)
    const payload = {
      cycleId: 'cycle-123',
      gate: 'plan',
      decision: 'approved',
      expiresAt: Date.now() + 60000,
    }
    const token = signer.sign(payload)
    // Tamper with the token by modifying one character
    const tampered = token.slice(0, -5) + 'xxxxx'
    const verified = signer.verify(tampered)
    expect(verified).toBeNull()
  })

  it('rejects expired token', () => {
    const key = CallbackSigner.generateKey()
    const signer = new CallbackSigner(key)
    const payload = {
      cycleId: 'cycle-123',
      gate: 'plan',
      decision: 'approved',
      expiresAt: Date.now() - 1000, // expired
    }
    const token = signer.sign(payload)
    const verified = signer.verify(token)
    expect(verified).toBeNull()
  })

  it('generateKey returns 32 bytes', () => {
    const key = CallbackSigner.generateKey()
    expect(key).toBeInstanceOf(Buffer)
    expect(key.length).toBe(32)
  })
})
