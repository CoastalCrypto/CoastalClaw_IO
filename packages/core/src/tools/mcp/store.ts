import Database from 'better-sqlite3';

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export class McpStore {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id      TEXT PRIMARY KEY,
        name    TEXT NOT NULL UNIQUE,
        command TEXT NOT NULL,
        args    TEXT NOT NULL, -- JSON array
        env     TEXT,          -- JSON object
        enabled INTEGER NOT NULL DEFAULT 1
      )
    `);
  }

  list(): McpServerConfig[] {
    const rows = this.db.prepare('SELECT * FROM mcp_servers').all() as any[];
    return rows.map(r => ({
      ...r,
      args: JSON.parse(r.args),
      env: r.env ? JSON.parse(r.env) : {},
      enabled: Boolean(r.enabled)
    }));
  }

  upsert(config: McpServerConfig): void {
    this.db.prepare(`
      INSERT INTO mcp_servers (id, name, command, args, env, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        command = excluded.command,
        args = excluded.args,
        env = excluded.env,
        enabled = excluded.enabled
    `).run(
      config.id,
      config.name,
      config.command,
      JSON.stringify(config.args),
      config.env ? JSON.stringify(config.env) : null,
      config.enabled ? 1 : 0
    );
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
  }
}
