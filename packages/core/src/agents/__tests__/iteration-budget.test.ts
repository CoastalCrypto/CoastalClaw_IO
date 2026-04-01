// packages/core/src/agents/__tests__/iteration-budget.test.ts
import { describe, it, expect } from 'vitest'
import { IterationBudget } from '../iteration-budget.js'

describe('IterationBudget', () => {
  it('allows consumption up to max', () => {
    const budget = new IterationBudget(3)
    expect(budget.consume()).toBe(true)
    expect(budget.consume()).toBe(true)
    expect(budget.consume()).toBe(true)
    expect(budget.consume()).toBe(false)  // exhausted
  })

  it('isExhausted reflects remaining count', () => {
    const budget = new IterationBudget(1)
    expect(budget.isExhausted).toBe(false)
    budget.consume()
    expect(budget.isExhausted).toBe(true)
  })

  it('abort() immediately exhausts the budget', () => {
    const budget = new IterationBudget(100)
    expect(budget.isExhausted).toBe(false)
    budget.abort()
    expect(budget.isExhausted).toBe(true)
    expect(budget.consume()).toBe(false)
  })

  it('remaining decrements with each consume', () => {
    const budget = new IterationBudget(5)
    expect(budget.remaining).toBe(5)
    budget.consume()
    expect(budget.remaining).toBe(4)
  })
})
