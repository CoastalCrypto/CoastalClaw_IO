import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentRegistry } from '../agents/registry.js';
import { loadConfig } from '../config.js';

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'packages/core/assets/manifest.json'), 'utf8'));

export class RepairSystem {
  static async run(): Promise<string[]> {
    const report: string[] = [];
    const config = loadConfig();

    // 1. Validate Filesystem
    for (const dir of manifest.directories) {
      if (!existsSync(dir)) {
        report.push(`[Repair] Creating missing directory: ${dir}`);
        mkdirSync(dir, { recursive: true });
      }
    }

    // 2. Sync Agent Registry
    report.push('[Repair] Syncing Agent Registry...');
    const registry = new AgentRegistry(join(config.dataDir, 'agents.db'));
    // Triggering init will re-sync built-in agents to the db
    report.push('[Repair] Agent Registry sync complete.');

    return report;
  }
}
