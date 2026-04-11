// packages/daemon/src/voice/interrupt-handler.ts
import type { IterationBudget } from '@coastal-ai/core'

export class InterruptHandler {
  private activeBudget: IterationBudget | null = null

  setActiveBudget(budget: IterationBudget): void {
    this.activeBudget = budget
  }

  clearActiveBudget(): void {
    this.activeBudget = null
  }

  /** Called by VAD when user speech detected mid-response. */
  trigger(): void {
    if (!this.activeBudget) return
    this.activeBudget.abort()
    this.activeBudget = null
  }
}
