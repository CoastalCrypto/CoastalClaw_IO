import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRegistry } from '../agents/registry.js';
import { loadConfig } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, '..', '..', 'assets', 'manifest.json');

export class RepairSystem {
  static async run(): Promise<string[]> {
    const report: string[] = [];
    const config = loadConfig();

    // 1. Load manifest (safe — errors are non-fatal)
    let manifest: { directories?: string[]; requiredFiles?: string[] } = {}
    try {
      manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    } catch {
      report.push(`[Repair] Warning: manifest not found at ${MANIFEST_PATH}, skipping directory checks.`)
    }

    // 2. Validate Filesystem
    for (const dir of manifest.directories ?? []) {
      if (!existsSync(dir)) {
        report.push(`[Repair] Creating missing directory: ${dir}`);
        try {
          mkdirSync(dir, { recursive: true });
        } catch (err: any) {
          report.push(`[Repair] Failed to create ${dir}: ${err.message}`);
        }
      }
    }

    // 3. Sync Agent Registry
    report.push('[Repair] Syncing Agent Registry...');
    let registry: AgentRegistry | undefined
    try {
      registry = new AgentRegistry(join(config.dataDir, 'agents.db'));
      // Constructing AgentRegistry re-syncs built-in agents to the db
      report.push('[Repair] Agent Registry sync complete.');
    } catch (err: any) {
      report.push(`[Repair] Agent Registry sync failed: ${err.message}`);
    } finally {
      registry?.close()
    }

    return report;
  }
}
