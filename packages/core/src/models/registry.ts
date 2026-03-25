import Database from 'better-sqlite3'
import { join } from 'path'

export interface ModelRecord {
  id: string
  hfSource: string
  baseName: string
  quantLevel: string
  sizeGb: number
}

export interface ModelGroup {
  baseName: string
  hfSource: string
  variants: Array<{ id: string; quantLevel: string; sizeGb: number; addedAt: number }>
}

export class ModelRegistry {
  private db: Database.Database

  constructor(dataDir: string) {
    this.db = new Database(join(dataDir, 'models.db'))
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id          TEXT PRIMARY KEY,
        hf_source   TEXT NOT NULL,
        base_name   TEXT NOT NULL,
        quant_level TEXT NOT NULL,
        added_at    INTEGER NOT NULL,
        size_gb     REAL NOT NULL,
        active      INTEGER NOT NULL DEFAULT 1
      )
    `)
  }

  register(record: ModelRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO models (id, hf_source, base_name, quant_level, added_at, size_gb, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(record.id, record.hfSource, record.baseName, record.quantLevel, Date.now(), record.sizeGb)
  }

  deactivate(id: string): void {
    this.db.prepare('UPDATE models SET active = 0 WHERE id = ?').run(id)
  }

  getVariants(baseName: string): Array<{ id: string; quantLevel: string; sizeGb: number }> {
    return this.db.prepare(
      'SELECT id, quant_level as quantLevel, size_gb as sizeGb FROM models WHERE base_name = ? AND active = 1'
    ).all(baseName) as Array<{ id: string; quantLevel: string; sizeGb: number }>
  }

  listGrouped(): ModelGroup[] {
    const rows = this.db.prepare(`
      SELECT id, hf_source as hfSource, base_name as baseName, quant_level as quantLevel,
             size_gb as sizeGb, added_at as addedAt
      FROM models WHERE active = 1 ORDER BY base_name, quant_level
    `).all() as Array<{ id: string; hfSource: string; baseName: string; quantLevel: string; sizeGb: number; addedAt: number }>

    const groups = new Map<string, ModelGroup>()
    for (const row of rows) {
      if (!groups.has(row.baseName)) {
        groups.set(row.baseName, { baseName: row.baseName, hfSource: row.hfSource, variants: [] })
      }
      groups.get(row.baseName)!.variants.push({ id: row.id, quantLevel: row.quantLevel, sizeGb: row.sizeGb, addedAt: row.addedAt })
    }
    return Array.from(groups.values())
  }

  isActive(id: string): boolean {
    const row = this.db.prepare('SELECT active FROM models WHERE id = ?').get(id) as { active: number } | undefined
    return row?.active === 1
  }

  close(): void {
    this.db.close()
  }
}
