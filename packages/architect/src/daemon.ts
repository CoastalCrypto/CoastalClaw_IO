// packages/architect/src/daemon.ts
import type { WorkItemStore } from '@coastal-ai/core/architect/store'
import type { CycleStore } from '@coastal-ai/core/architect/cycle-store'
import { runWorkItemCycle, type PlanResult, type BuildResult } from './stage-runner.js'

export interface DaemonDeps {
  workStore: WorkItemStore
  cycleStore: CycleStore
  runPlan: (input: any) => Promise<PlanResult>
  runBuild: (input: any) => Promise<BuildResult>
  isApprovalRequired: (gate: 'plan' | 'pr') => boolean
  log?: (msg: string) => void
}

export class ArchitectDaemon {
  private locked = false
  private interval: NodeJS.Timeout | null = null

  constructor(private deps: DaemonDeps) {}

  async tick(): Promise<'ran' | 'idle' | 'locked'> {
    if (this.locked) return 'locked'
    const next = this.deps.workStore.listPending(1)[0]
    if (!next) return 'idle'

    this.locked = true
    try {
      await runWorkItemCycle({
        workItem: next,
        workStore: this.deps.workStore,
        cycleStore: this.deps.cycleStore,
        runPlan: this.deps.runPlan as any,
        runBuild: this.deps.runBuild as any,
        isApprovalRequired: this.deps.isApprovalRequired,
      })
      return 'ran'
    } finally {
      this.locked = false
    }
  }

  start(intervalMs = 60_000): void {
    if (this.interval) return
    this.interval = setInterval(() => {
      this.tick().catch(err => this.deps.log?.(`tick error: ${err instanceof Error ? err.message : String(err)}`))
    }, intervalMs)
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
  }
}
