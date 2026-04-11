// packages/daemon/src/__tests__/voice/interrupt.test.ts
import { describe, it, expect, vi } from 'vitest'
import { InterruptHandler } from '../../voice/interrupt-handler.js'
import { IterationBudget } from '@coastal-ai/core'

describe('InterruptHandler', () => {
  it('calls abort on active budget when triggered', () => {
    const budget = new IterationBudget(10)
    const handler = new InterruptHandler()
    handler.setActiveBudget(budget)

    const abortSpy = vi.spyOn(budget, 'abort')
    handler.trigger()
    expect(abortSpy).toHaveBeenCalledOnce()
  })

  it('does nothing when no active budget', () => {
    const handler = new InterruptHandler()
    expect(() => handler.trigger()).not.toThrow()
  })

  it('clears budget after trigger', () => {
    const budget = new IterationBudget(10)
    const handler = new InterruptHandler()
    handler.setActiveBudget(budget)
    handler.trigger()
    // Second trigger should not call abort again
    const abortSpy = vi.spyOn(budget, 'abort')
    handler.trigger()
    expect(abortSpy).not.toHaveBeenCalled()
  })
})
