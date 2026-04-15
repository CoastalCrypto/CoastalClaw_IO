import { readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { ToolDefinition } from '../../agents/types.js'
import type { TrustLevel } from '../../config.js'

export interface CoreTool {
  definition: ToolDefinition
  execute: (args: Record<string, unknown>) => Promise<string>
}

/**
 * Returns true if `targetPath` resolves to a location within (or equal to) `workdir`.
 * Uses path.resolve() to normalize away any `..` traversal segments.
 */
function isWithinWorkdir(targetPath: string, workdir: string): boolean {
  const resolved = resolve(targetPath)
  const resolvedWorkdir = resolve(workdir)
  return resolved.startsWith(resolvedWorkdir + sep) || resolved === resolvedWorkdir
}

/**
 * Returns a human-readable error when a path escapes the workspace boundary.
 */
function pathBlockedMessage(targetPath: string, workdir: string): string {
  return `Error: file access restricted to workspace folder. Path "${resolve(targetPath)}" is outside allowed directory "${resolve(workdir)}".`
}

/**
 * Returns a human-readable error when a tool is entirely blocked by the trust level.
 */
function operationBlockedMessage(toolName: string, trustLevel: TrustLevel): string {
  return `Error: ${toolName} is blocked at trust level "${trustLevel}". Only read_file and list_dir are permitted in sandboxed mode.`
}

/**
 * Factory that creates file tools scoped by trust level and workspace directory.
 *
 * - autonomous: no restrictions (current behavior)
 * - trusted: all four tools work, but only within `workdir`
 * - sandboxed: read_file and list_dir within `workdir` only; write_file and delete_file are blocked entirely
 */
export function createFileTools(workdir: string, trustLevel: TrustLevel): CoreTool[] {
  const readFileTool: CoreTool = {
    definition: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute or relative file path' } },
        required: ['path'],
      },
      reversible: true,
    },
    execute: async (args) => {
      const targetPath = String(args.path)
      if (trustLevel !== 'autonomous' && !isWithinWorkdir(targetPath, workdir)) {
        return pathBlockedMessage(targetPath, workdir)
      }
      try {
        return readFileSync(targetPath, 'utf8')
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error reading file: ${message}`
      }
    },
  }

  const writeFileTool: CoreTool = {
    definition: {
      name: 'write_file',
      description: 'Write content to a file, creating it if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      reversible: false,
    },
    execute: async (args) => {
      if (trustLevel === 'sandboxed') {
        return operationBlockedMessage('write_file', trustLevel)
      }
      const targetPath = String(args.path)
      if (trustLevel === 'trusted' && !isWithinWorkdir(targetPath, workdir)) {
        return pathBlockedMessage(targetPath, workdir)
      }
      try {
        const content = String(args.content)
        writeFileSync(targetPath, content, 'utf8')
        return `Written ${content.length} chars to ${args.path}`
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error writing file: ${message}`
      }
    },
  }

  const listDirTool: CoreTool = {
    definition: {
      name: 'list_dir',
      description: 'List files and directories at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path' } },
        required: ['path'],
      },
      reversible: true,
    },
    execute: async (args) => {
      const targetPath = String(args.path)
      if (trustLevel !== 'autonomous' && !isWithinWorkdir(targetPath, workdir)) {
        return pathBlockedMessage(targetPath, workdir)
      }
      try {
        const entries = readdirSync(targetPath, { withFileTypes: true })
        return entries.map(e => `${e.isDirectory() ? '[dir] ' : ''}${e.name}`).join('\n')
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error listing directory: ${message}`
      }
    },
  }

  const deleteFileTool: CoreTool = {
    definition: {
      name: 'delete_file',
      description: 'Delete a file at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path to delete' } },
        required: ['path'],
      },
      reversible: false,
    },
    execute: async (args) => {
      if (trustLevel === 'sandboxed') {
        return operationBlockedMessage('delete_file', trustLevel)
      }
      const targetPath = String(args.path)
      if (trustLevel === 'trusted' && !isWithinWorkdir(targetPath, workdir)) {
        return pathBlockedMessage(targetPath, workdir)
      }
      try {
        const stat = statSync(targetPath)
        if (stat.isDirectory()) return 'Error: path is a directory, not a file'
        unlinkSync(targetPath)
        return `Deleted ${args.path}`
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error deleting file: ${message}`
      }
    },
  }

  return [readFileTool, writeFileTool, listDirTool, deleteFileTool]
}

/**
 * Unrestricted file tools — preserved for backward compatibility.
 * WARNING: These have NO path validation. Prefer `createFileTools()` for any
 * context where trust level matters.
 */
export const fileTools: CoreTool[] = [
  {
    definition: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute or relative file path' } },
        required: ['path'],
      },
      reversible: true,
    },
    execute: async (args) => {
      try {
        return readFileSync(String(args.path), 'utf8')
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error reading file: ${message}`
      }
    },
  },
  {
    definition: {
      name: 'write_file',
      description: 'Write content to a file, creating it if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      reversible: false,
    },
    execute: async (args) => {
      try {
        writeFileSync(String(args.path), String(args.content), 'utf8')
        return `Written ${String(args.content).length} chars to ${args.path}`
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error writing file: ${message}`
      }
    },
  },
  {
    definition: {
      name: 'list_dir',
      description: 'List files and directories at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path' } },
        required: ['path'],
      },
      reversible: true,
    },
    execute: async (args) => {
      try {
        const entries = readdirSync(String(args.path), { withFileTypes: true })
        return entries.map(e => `${e.isDirectory() ? '[dir] ' : ''}${e.name}`).join('\n')
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error listing directory: ${message}`
      }
    },
  },
  {
    definition: {
      name: 'delete_file',
      description: 'Delete a file at the given path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path to delete' } },
        required: ['path'],
      },
      reversible: false,
    },
    execute: async (args) => {
      try {
        const stat = statSync(String(args.path))
        if (stat.isDirectory()) return 'Error: path is a directory, not a file'
        unlinkSync(String(args.path))
        return `Deleted ${args.path}`
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        return `Error deleting file: ${message}`
      }
    },
  },
]
