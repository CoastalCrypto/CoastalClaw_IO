// packages/daemon/src/__tests__/voice/wake-word.test.ts
import { describe, it, expect } from 'vitest'
import { WakeWordDetector } from '../../voice/wake-word.js'

describe('WakeWordDetector', () => {
  it('can be constructed without error', () => {
    const detector = new WakeWordDetector({ keyword: 'hey coastal' })
    expect(detector).toBeDefined()
    detector.stop() // ensure cleanup
  })

  it('emits detected event from mock script', async () => {
    const detector = new WakeWordDetector({ keyword: 'hey coastal', mockMode: true })
    const detected = await new Promise<boolean>((resolve) => {
      detector.on('detected', () => resolve(true))
      detector.start()
      setTimeout(() => resolve(false), 500)
    })
    detector.stop()
    expect(detected).toBe(true)
  })
})
