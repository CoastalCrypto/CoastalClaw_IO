import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { CoreTool } from './file.js'

export const shellTools: CoreTool[] = [
  {
    definition: {
      name: 'run_command',
      description: 'Execute a shell command in the agent workspace directory. Returns stdout + stderr.',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string', description: 'Shell command to run' },
          workdir: { type: 'string', description: 'Working directory (must be within CC_AGENT_WORKDIR)' },
        },
        required: ['cmd'],
      },
      reversible: false,
    },
    execute: async (args) => {
      const agentWorkdir = process.env.CC_AGENT_WORKDIR
        ? resolve(process.env.CC_AGENT_WORKDIR)
        : null
      const requestedCwd = resolve(String(args.workdir ?? agentWorkdir ?? './data/workspace'))

      // Block escape attempts via workdir (only when CC_AGENT_WORKDIR is explicitly set)
      if (agentWorkdir && !requestedCwd.startsWith(agentWorkdir)) {
        return `Error: cwd escape attempt blocked. Requested: ${requestedCwd}, allowed: ${agentWorkdir}`
      }

      // Block cd to outside workdir within the command
      const cmd = String(args.cmd)
      const effectiveWorkdir = agentWorkdir ?? requestedCwd
      if (/cd\s+\//.test(cmd) && !cmd.includes(effectiveWorkdir)) {
        return `Error: cwd escape attempt blocked in command: ${cmd}`
      }

      try {
        const output = execSync(cmd, {
          cwd: requestedCwd,
          timeout: 30_000,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return output || '(no output)'
      } catch (e: any) {
        return `Error (exit ${e.status ?? '?'}): ${e.stderr || e.message}`
      }
    },
  },
]
