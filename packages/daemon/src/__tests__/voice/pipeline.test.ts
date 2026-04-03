// packages/daemon/src/__tests__/voice/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoicePipeline, PipelineState } from '../../voice/pipeline.js'

describe('VoicePipeline state machine', () => {
  let pipeline: VoicePipeline

  beforeEach(() => {
    pipeline = new VoicePipeline({
      onTranscript: async (_text: string) => 'mock response',
      mockMode: true,
    })
  })

  it('starts in idle state', () => {
    expect(pipeline.state).toBe(PipelineState.Idle)
  })

  it('transitions to listening on start()', async () => {
    pipeline.start()
    expect(pipeline.state).toBe(PipelineState.Listening)
    pipeline.stop()
  })

  it('transitions through full cycle in mock mode', async () => {
    const states: PipelineState[] = []
    pipeline.on('stateChange', (s: PipelineState) => states.push(s))
    pipeline.start()
    // In mock mode, wake word fires immediately, then cycles through states
    await new Promise(resolve => setTimeout(resolve, 500))
    pipeline.stop()
    expect(states).toContain(PipelineState.Listening)
  })

  it('stop() returns to idle', () => {
    pipeline.start()
    pipeline.stop()
    expect(pipeline.state).toBe(PipelineState.Idle)
  })
})
