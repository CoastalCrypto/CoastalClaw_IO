import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistry } from '../registry.js'
import type { ToolDefinition } from '../../agents/types.js'
import type { CoreTool } from '../core/file.js'

export class McpAdapter {
  private client: Client
  private transport: StdioClientTransport
  private namespace: string

  constructor(command: string, args: string[], env: Record<string, string>, namespace: string) {
    this.namespace = namespace
    this.transport = new StdioClientTransport({ command, args, env })
    this.client = new Client(
      { name: 'coastal-ai', version: '1.0.0' },
      { capabilities: {} }
    )
  }

  async connect(registry: ToolRegistry) {
    await this.client.connect(this.transport)
    // List tools from the MCP server
    const response = await this.client.request({ method: 'tools/list' }, ListToolsResultSchema)
    const tools = response.tools || []
    
    for (const tool of tools) {
      const toolName = `${this.namespace}_${tool.name}`
      
      const def: ToolDefinition = {
        name: toolName,
        description: `[MCP: ${this.namespace}] ${tool.description}`,
        parameters: tool.inputSchema as any,
        reversible: false, // Default to false for external tools
      }
      
      const coreTool: CoreTool = {
        definition: def,
        execute: async (args: Record<string, unknown>) => {
          try {
             const result = await this.client.request({
               method: 'tools/call',
               params: { name: tool.name, arguments: args }
             }, CallToolResultSchema)
             return result.content?.map((c: any) => c.text).join('\n') || 'Executed successfully with no output.'
          } catch (err: any) {
             return `MCP Error: ${err.message}`
          }
        }
      }
      registry.registerTool(coreTool)
      console.log(`[mcp] Registered tool: ${toolName}`)
    }
  }

  async close() {
    await this.client.close()
  }
}
