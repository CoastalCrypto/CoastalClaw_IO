import { readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import type { ToolDefinition } from '../../agents/types.js'

export interface CoreTool {
  definition: ToolDefinition
  execute: (args: Record<string, unknown>) => Promise<string>
}

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
      } catch (e: any) {
        return `Error reading file: ${e.message}`
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
      } catch (e: any) {
        return `Error writing file: ${e.message}`
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
      } catch (e: any) {
        return `Error listing directory: ${e.message}`
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
      } catch (e: any) {
        return `Error deleting file: ${e.message}`
      }
    },
  },
]
