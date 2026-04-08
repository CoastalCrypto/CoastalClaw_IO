import { Cron } from 'croner'
import type { CronStore } from './store.js'

export class CronScheduler {
  private jobs = new Map<string, Cron>()

  constructor(
    private store: CronStore,
    private runJob: (agentId: string, task: string) => Promise<string>,
  ) {}

  /** Load all enabled jobs from DB and schedule them. */
  start() {
    const jobs = this.store.list()
    for (const job of jobs) {
      if (job.enabled) this.schedule(job.id, job.schedule, job.agentId, job.task)
    }
  }

  /** Stop all running cron jobs. */
  stop() {
    for (const cron of this.jobs.values()) cron.stop()
    this.jobs.clear()
  }

  /** Add or replace a scheduled job. */
  schedule(id: string, schedule: string, agentId: string, task: string) {
    this.unschedule(id)
    const cron = new Cron(schedule, { protect: true }, async () => {
      let output = ''
      let status: 'ok' | 'error' = 'ok'
      try {
        output = await this.runJob(agentId, task)
      } catch (err: any) {
        status = 'error'
        output = String(err?.message ?? err)
      }
      this.store.recordRun(id, status, output)
    })
    this.jobs.set(id, cron)
  }

  /** Remove a scheduled job (doesn't delete from DB). */
  unschedule(id: string) {
    this.jobs.get(id)?.stop()
    this.jobs.delete(id)
  }

  /** Trigger a job immediately (outside its normal schedule). */
  async triggerNow(id: string): Promise<{ status: 'ok' | 'error'; output: string }> {
    const job = this.store.get(id)
    if (!job) throw new Error('Job not found')
    let output = ''
    let status: 'ok' | 'error' = 'ok'
    try {
      output = await this.runJob(job.agentId, job.task)
    } catch (err: any) {
      status = 'error'
      output = String(err?.message ?? err)
    }
    this.store.recordRun(id, status, output)
    return { status, output }
  }
}
