export interface TeamMessage {
  type: 'task' | 'result' | 'status' | 'error'
  payload: unknown
}

export class TeamChannel {
  private subs = new Map<string, Set<(msg: TeamMessage) => void>>()

  subscribe(agentId: string, cb: (msg: TeamMessage) => void): () => void {
    if (!this.subs.has(agentId)) this.subs.set(agentId, new Set())
    this.subs.get(agentId)!.add(cb)
    return () => this.subs.get(agentId)?.delete(cb)
  }

  post(from: string, to: string, payload: TeamMessage): void {
    this.subs.get(to)?.forEach(cb => cb(payload))
  }

  broadcast(from: string, payload: TeamMessage): void {
    this.subs.forEach(set => set.forEach(cb => cb(payload)))
  }
}
