import type { ModelRouter } from '../models/router.js'
import type { AgentRegistry } from './registry.js'
import type { ToolRegistry } from '../tools/registry.js'
import { TeamChannel } from './team-channel.js'

export interface SubTask {
  id: string
  description: string
  domain: string
}

export interface SubResult {
  subtaskId: string
  reply: string
}

export interface BossResult {
  reply: string
  subtaskCount: number
  subtasks: SubResult[]
}

const DECOMPOSE_PROMPT = (task: string) => `
You are a task decomposition engine. Break the following task into independent subtasks that can run in parallel.
Return a JSON array of objects with shape: [{"id": "...", "description": "...", "domain": "general|code|browser|memory"}]
Return an empty array [] if the task is simple enough to handle directly.
Task: ${task}
`.trim()

const SYNTHESIZE_PROMPT = (task: string, results: SubResult[]) => `
Original task: ${task}

Subtask results:
${results.map(r => `- ${r.subtaskId}: ${r.reply}`).join('\n')}

Synthesize a single coherent reply that answers the original task using the above results.
`.trim()

export class BossAgent {
  constructor(
    private router: ModelRouter,
    private registry: AgentRegistry,
    private channel: TeamChannel,
    private toolRegistry: ToolRegistry,
  ) {}

  async run(task: string, sessionId: string): Promise<BossResult> {
    const subtasks = await this.decompose(task)

    if (subtasks.length === 0) {
      const { reply } = await this.router.chat([{ role: 'user', content: task }])
      return { reply, subtaskCount: 0, subtasks: [] }
    }

    const results = await this.fanOut(subtasks, sessionId)
    const reply = await this.synthesize(task, results)
    return { reply, subtaskCount: subtasks.length, subtasks: results }
  }

  private async decompose(task: string): Promise<SubTask[]> {
    try {
      const { reply } = await this.router.chat([
        { role: 'user', content: DECOMPOSE_PROMPT(task) },
      ])
      return JSON.parse(reply) as SubTask[]
    } catch {
      return []
    }
  }

  private async fanOut(subtasks: SubTask[], _sessionId: string): Promise<SubResult[]> {
    return Promise.all(subtasks.map(async (sub) => {
      const { reply } = await this.router.chat([
        { role: 'user', content: sub.description },
      ])
      this.channel.post('boss', sub.id, { type: 'result', payload: reply })
      return { subtaskId: sub.id, reply }
    }))
  }

  private async synthesize(task: string, results: SubResult[]): Promise<string> {
    const { reply } = await this.router.chat([
      { role: 'user', content: SYNTHESIZE_PROMPT(task, results) },
    ])
    return reply
  }
}
