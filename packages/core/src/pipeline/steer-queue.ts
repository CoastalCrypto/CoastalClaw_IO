export class SteerQueue {
  private queues = new Map<string, string[]>()

  push(runId: string, message: string): void {
    if (!this.queues.has(runId)) this.queues.set(runId, [])
    this.queues.get(runId)!.push(message)
  }

  drain(runId: string): string[] {
    const msgs = this.queues.get(runId) ?? []
    this.queues.set(runId, [])
    return msgs
  }

  cleanup(runId: string): void {
    this.queues.delete(runId)
  }
}
