// packages/daemon/src/scheduler.ts

/** Parse natural-language schedule strings into cron expressions. */
export function parseCronExpression(schedule: string): string {
  const s = schedule.toLowerCase().trim()

  // Already a cron expression (5 parts separated by spaces)
  if (/^[\d*/,\-]+ [\d*/,\-]+ [\d*/,\-]+ [\d*/,\-]+ [\d*/,\-]+$/.test(s)) return schedule

  // "daily at HH:MM"
  const dailyMatch = s.match(/^daily at (\d{1,2}):(\d{2})$/)
  if (dailyMatch) return `${parseInt(dailyMatch[2], 10)} ${parseInt(dailyMatch[1], 10)} * * *`

  // "every Nh" (every N hours)
  const everyHourMatch = s.match(/^every (\d+)h$/)
  if (everyHourMatch) return `0 */${everyHourMatch[1]} * * *`

  // "every Nm" (every N minutes)
  const everyMinMatch = s.match(/^every (\d+)m$/)
  if (everyMinMatch) return `*/${everyMinMatch[1]} * * * *`

  // "weekly on <day>"
  const weeklyMatch = s.match(/^weekly on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/)
  if (weeklyMatch) {
    const days: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 }
    return `0 8 * * ${days[weeklyMatch[1]]}`
  }

  // Default: every hour
  console.warn(`[Scheduler] Unknown schedule format: "${schedule}" — defaulting to hourly`)
  return '0 * * * *'
}

/** Check if a cron expression should fire at a given Date (minute-level precision). */
export function shouldRunNow(cronExpr: string, now: Date = new Date()): boolean {
  const parts = cronExpr.split(' ')
  if (parts.length !== 5) return false
  const [min, hour, dom, month, dow] = parts

  const matchField = (field: string, value: number): boolean => {
    if (field === '*') return true
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2))
      return value % step === 0
    }
    if (field.includes('-')) {
      const [lo, hi] = field.split('-').map(Number)
      return value >= lo && value <= hi
    }
    return parseInt(field) === value
  }

  return (
    matchField(min, now.getMinutes()) &&
    matchField(hour, now.getHours()) &&
    matchField(dom, now.getDate()) &&
    matchField(month, now.getMonth() + 1) &&
    matchField(dow, now.getDay())
  )
}

export interface HandJob {
  agentId: string
  cronExpr: string
  goal: string
}

export class ProactiveScheduler {
  private jobs: HandJob[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private onFire: (job: HandJob) => void

  constructor(onFire: (job: HandJob) => void) {
    this.onFire = onFire
  }

  register(job: HandJob): void {
    this.jobs.push(job)
  }

  start(intervalMs = 60_000): void {
    this.timer = setInterval(() => {
      const now = new Date()
      for (const job of this.jobs) {
        if (shouldRunNow(job.cronExpr, now)) {
          this.onFire(job)
        }
      }
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
