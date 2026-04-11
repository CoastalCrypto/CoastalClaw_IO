import Database from 'better-sqlite3'
import type { CoreTool } from './file.js'

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    const dataDir = process.env.CC_DATA_DIR ?? './data'
    _db = new Database(`${dataDir}/coastal-ai.db`, { readonly: false })
  }
  return _db
}

export const sqliteTools: CoreTool[] = [
  {
    definition: {
      name: 'query_db',
      description: 'Run a SQL query against the Coastal.AI database. Use mode="read" for SELECT, mode="write" for INSERT/UPDATE/DELETE.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'SQL query to execute' },
          mode: { type: 'string', description: '"read" or "write"' },
        },
        required: ['sql', 'mode'],
      },
      reversible: false,  // PermissionGate handles read vs write distinction
    },
    execute: async (args) => {
      try {
        const db = getDb()
        const sql = String(args.sql).trim()
        if (args.mode === 'read') {
          const rows = db.prepare(sql).all()
          return JSON.stringify(rows, null, 2)
        } else {
          const info = db.prepare(sql).run()
          return `Changes: ${info.changes}, last insert rowid: ${info.lastInsertRowid}`
        }
      } catch (e: any) {
        return `DB error: ${e.message}`
      }
    },
  },
]
