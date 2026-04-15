import { fileTools, createFileTools } from './core/file.js'
import { createShellTools, shellTools } from './core/shell.js'
import { gitTools } from './core/git.js'
import { sqliteTools } from './core/sqlite.js'
import { webTools } from './core/web.js'
import { dataTool } from './core/data.js'
import { createBrowserTools } from './browser/browser-tools.js'
import type { CoreTool } from './core/file.js'
import type { ToolDefinition } from '../agents/types.js'
import type { ShellBackend } from './backends/types.js'
import type { BrowserSessionManager } from './browser/session-manager.js'
import type { TrustLevel } from '../config.js'

const READ_ONLY_TOOLS = new Set(['read_file', 'list_dir', 'git_status', 'git_diff', 'git_log', 'http_get'])

export interface ToolRegistryOptions {
  backend?: ShellBackend
  browserManager?: BrowserSessionManager
  trustLevel?: TrustLevel
  workdir?: string
}

export class ToolRegistry {
  private tools = new Map<string, CoreTool>()

  constructor(backendOrOpts?: ShellBackend | ToolRegistryOptions, browserManager?: BrowserSessionManager) {
    let backend: ShellBackend | undefined
    let browser: CoreTool[] = []
    let resolvedFileTools: CoreTool[]

    if (backendOrOpts && typeof backendOrOpts === 'object' && 'trustLevel' in backendOrOpts) {
      // New options-object signature
      const opts = backendOrOpts as ToolRegistryOptions
      backend = opts.backend
      browser = opts.browserManager ? createBrowserTools(opts.browserManager) : []

      if (opts.trustLevel && opts.workdir) {
        resolvedFileTools = createFileTools(opts.workdir, opts.trustLevel)
      } else {
        resolvedFileTools = fileTools
      }
    } else {
      // Legacy positional-argument signature for backward compatibility
      backend = backendOrOpts as ShellBackend | undefined
      browser = browserManager ? createBrowserTools(browserManager) : []
      resolvedFileTools = fileTools
    }

    const shell = backend
      ? createShellTools(backend, process.env.CC_AGENT_WORKDIR ?? './data/workspace')
      : shellTools

    for (const t of [...resolvedFileTools, ...shell, ...gitTools, ...sqliteTools, ...webTools, ...browser, dataTool]) {
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

  registerTool(tool: CoreTool): void {
    this.tools.set(tool.definition.name, tool)
  }

  /** Returns true if this specific call is reversible (considers query_db mode) */
  isReversible(toolName: string, args: Record<string, unknown>): boolean {
    if (toolName === 'query_db') return args.mode === 'read'
    const tool = this.tools.get(toolName)
    if (tool?.definition.reversible !== undefined) {
      return tool.definition.reversible
    }
    return READ_ONLY_TOOLS.has(toolName)
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) return `Error: unknown tool "${name}"`
    return tool.execute(args)
  }
}
