import { EventEmitter } from 'node:events'
import type { AgentEvent } from './types.js'

const MAX_HISTORY = 200

class EventBus extends EventEmitter {
  private history: AgentEvent[] = []

  publish(event: AgentEvent): void {
    this.history.push(event)
    if (this.history.length > MAX_HISTORY) this.history.shift()
    this.emit('agent', event)
  }

  onAgent(listener: (data: AgentEvent) => void): this {
    return this.on('agent', listener)
  }

  offAgent(listener: (data: AgentEvent) => void): this {
    return this.off('agent', listener)
  }

  getHistory(limit = 50): AgentEvent[] {
    return this.history.slice(-limit)
  }
}

export const eventBus = new EventBus()
eventBus.setMaxListeners(100)
