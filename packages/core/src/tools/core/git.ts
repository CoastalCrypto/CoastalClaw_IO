import { execSync } from 'node:child_process'
import type { CoreTool } from './file.js'

function git(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, { cwd: cwd ?? process.cwd(), encoding: 'utf8', timeout: 15_000 })
  } catch (e: any) {
    return `Git error: ${e.stderr || e.message}`
  }
}

export const gitTools: CoreTool[] = [
  {
    definition: {
      name: 'git_status',
      description: 'Show the working tree status.',
      parameters: {
        type: 'object',
        properties: { repo: { type: 'string', description: 'Optional repo path (defaults to cwd)' } },
      },
      reversible: true,
    },
    execute: async (args) => git('status', args.repo as string | undefined),
  },
  {
    definition: {
      name: 'git_diff',
      description: 'Show changes in the working tree or a specific file.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Optional file path to diff' } },
      },
      reversible: true,
    },
    execute: async (args) => git(args.path ? `diff -- ${args.path}` : 'diff'),
  },
  {
    definition: {
      name: 'git_log',
      description: 'Show recent commit history.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'string', description: 'Number of commits to show (default: 10)' } },
      },
      reversible: true,
    },
    execute: async (args) => git(`log --oneline -${Number(args.limit ?? 10)}`),
  },
  {
    definition: {
      name: 'git_commit',
      description: 'Stage specified files and create a commit.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
          files: { type: 'string', description: 'Space-separated file paths to stage (or "." for all)' },
        },
        required: ['message', 'files'],
      },
      reversible: false,
    },
    execute: async (args) => {
      git(`add ${args.files}`)
      return git(`commit -m ${JSON.stringify(args.message)}`)
    },
  },
]
