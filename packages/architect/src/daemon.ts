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
  pollPR?: (prUrl: string) => Promise<{ status: string; message?: string }>
  autoMerge?: (prUrl: string) => Promise<{ kind: string; message?: string }>
  emitEvent?: (type: string, opts: Record<string, unknown>) => void
  runPR?: (input: any) => Promise<any>
  captureSnapshot?: (opts: { cycleId: string; workItemId: string; capturedBy: string }) => void
  curriculumScanner?: { scan: () => Promise<any> }
  curriculumEnabled?: boolean
}

export class ArchitectDaemon {
  private locked = false
  private interval: NodeJS.Timeout | null = null
  private lastCurriculumScan = 0

  constructor(private deps: DaemonDeps) {}

  async tick(): Promise<'ran' | 'idle' | 'locked' | 'polled'> {
    if (this.locked) return 'locked'
    this.locked = true
    try {
      // Phase 1: Poll active PRs
      const polled = await this.pollActivePRs()

      // Phase 2: Process next pending item
      const next = this.deps.workStore.listPending(1)[0]
      if (!next) {
        // Phase 3: Curriculum scan (idle path)
        if (this.deps.curriculumScanner && this.deps.curriculumEnabled) {
          const SCAN_INTERVAL = 4 * 60 * 60 * 1000 // 4 hours
          if (Date.now() - this.lastCurriculumScan >= SCAN_INTERVAL) {
            try {
              await this.deps.curriculumScanner.scan()
              this.lastCurriculumScan = Date.now()
              return polled ? 'polled' : 'ran'
            } catch (err) {
              this.deps.log?.(`curriculum scan error: ${err instanceof Error ? err.message : String(err)}`)
            }
          }
        }
        return polled ? 'polled' : 'idle'
      }

      await runWorkItemCycle({
        workItem: next,
        workStore: this.deps.workStore,
        cycleStore: this.deps.cycleStore,
        runPlan: this.deps.runPlan as any,
        runBuild: this.deps.runBuild as any,
        isApprovalRequired: this.deps.isApprovalRequired,
        runPR: this.deps.runPR,
        captureSnapshot: this.deps.captureSnapshot,
        emitEvent: this.deps.emitEvent,
        autoMerge: this.deps.autoMerge,
      })
      return 'ran'
    } finally {
      this.locked = false
    }
  }

  private async pollActivePRs(): Promise<boolean> {
    if (!this.deps.pollPR) return false
    const reviewing = this.deps.cycleStore.listByStage('pr_review')
    let anyPolled = false
    for (const cycle of reviewing) {
      if (!cycle.prUrl) continue
      const result = await this.deps.pollPR(cycle.prUrl)
      if (result.status === 'merged') {
        this.deps.cycleStore.terminate(cycle.id, { outcome: 'merged' })
        if (cycle.workItemId) {
          this.deps.workStore.updateStatus(cycle.workItemId, 'merged')
        }
        this.deps.emitEvent?.('pr_merged', { cycleId: cycle.id, workItemId: cycle.workItemId })
        anyPolled = true
      } else if (result.status === 'closed') {
        this.deps.cycleStore.terminate(cycle.id, { outcome: 'vetoed' })
        if (cycle.workItemId) {
          this.deps.workStore.updateStatus(cycle.workItemId, 'cancelled')
        }
        this.deps.emitEvent?.('pr_closed', { cycleId: cycle.id, workItemId: cycle.workItemId })
        anyPolled = true
      }
    }
    return anyPolled
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
