import { fileTools } from './core/file.js'
import { shellTools } from './core/shell.js'
import { gitTools } from './core/git.js'
import { sqliteTools } from './core/sqlite.js'
import { webTools } from './core/web.js'
import type { CoreTool } from './core/file.js'
import type { ToolDefinition } from '../agents/types.js'

const READ_ONLY_TOOLS = new Set(['read_file', 'list_dir', 'git_status', 'git_diff', 'git_log', 'http_get'])

export class ToolRegistry {
  private tools = new Map<string, CoreTool>()

  constructor() {
    for (const t of [...fileTools, ...shellTools, ...gitTools, ...sqliteTools, ...webTools]) {
      this.tools.set(t.definition.name, t)
    }
  }

  get(name: string): CoreTool | undefined {
    return this.tools.get(name)
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition
  }

  getDefinitionsFor(toolNames: string[]): ToolDefinition[] {
    return toolNames.flatMap(n => {
      const def = this.getDefinition(n)
      return def ? [def] : []
    })
  }

  /** Returns true if this specific call is reversible (considers query_db mode) */
  isReversible(toolName: string, args: Record<string, unknown>): boolean {
    if (toolName === 'query_db') return args.mode === 'read'
    return READ_ONLY_TOOLS.has(toolName)
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) return `Error: unknown tool "${name}"`
    return tool.execute(args)
  }
}
