import { createHmac, randomBytes } from 'node:crypto'

export class CallbackSigner {
  private key: Buffer

  constructor(key: Buffer) {
    this.key = key
  }

  static generateKey(): Buffer {
    return randomBytes(32)
  }

  sign(payload: { cycleId: string; gate: string; decision: string; expiresAt: number }): string {
    const data = JSON.stringify(payload)
    const hmac = createHmac('sha256', this.key).update(data).digest('hex')
    return Buffer.from(JSON.stringify({ ...payload, hmac })).toString('base64url')
  }

  verify(token: string): { cycleId: string; gate: string; decision: string; expiresAt: number } | null {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
      const { hmac, ...payload } = decoded
      const expected = createHmac('sha256', this.key).update(JSON.stringify(payload)).digest('hex')
      if (hmac !== expected) return null
      if (Date.now() > payload.expiresAt) return null
      return payload
    } catch {
      return null
    }
  }
}
