// packages/core/src/agents/iteration-budget.ts
export class IterationBudget {
  private _remaining: number
  private _aborted = false

  constructor(max: number) {
    this._remaining = max
  }

  /** Consume one iteration. Returns true if allowed, false if exhausted or aborted. */
  consume(): boolean {
    if (this._aborted || this._remaining <= 0) return false
    this._remaining--
    return true
  }

  /** Immediately exhaust the budget (e.g., parent cancelled). */
  abort(): void {
    this._aborted = true
  }

  get isExhausted(): boolean {
    return this._aborted || this._remaining <= 0
  }

  get remaining(): number {
    return this._remaining
  }
}
