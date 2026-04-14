import { execSync } from 'node:child_process';
import os from 'node:os';

export interface HardwareStats {
  vramTotalGb: number;
  vramUsedGb: number;
  ramTotalGb: number;
  ramUsedGb: number;
  cpuUsagePct: number;
  tier: 'lite' | 'standard' | 'apex';
}

export class HardwareProbe {
  // Stable stats (VRAM total, tier) — probed once at startup
  private static _stable: Pick<HardwareStats, 'vramTotalGb' | 'tier'> | null = null
  // CPU sample cache — refreshed at most every 5 seconds
  private static _cpuCache: { value: number; ts: number } = { value: 0, ts: 0 }
  private static _prevCpuTimes: { idle: number; total: number } | null = null

  static getStats(): HardwareStats {
    const ramTotalGb = os.totalmem() / (1024 ** 3);
    const ramUsedGb = (os.totalmem() - os.freemem()) / (1024 ** 3);

    if (!HardwareProbe._stable) {
      let vramTotalGb = 0;
      try {
        if (process.platform === 'win32' || process.platform === 'linux') {
          const output = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', {
            encoding: 'utf8', timeout: 3000,
          });
          vramTotalGb = parseInt(output.trim(), 10) / 1024;
        } else if (process.platform === 'darwin') {
          vramTotalGb = ramTotalGb * 0.75;
        }
      } catch { /* No GPU or nvidia-smi unavailable */ }

      let tier: HardwareStats['tier'] = 'lite';
      if (vramTotalGb >= 20 || ramTotalGb >= 64) tier = 'apex';
      else if (vramTotalGb >= 8 || ramTotalGb >= 16) tier = 'standard';

      HardwareProbe._stable = { vramTotalGb, tier };
    }

    // VRAM used — re-query at most every 5s
    let vramUsedGb = 0;
    try {
      if (process.platform === 'win32' || process.platform === 'linux') {
        const output = execSync('nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits', {
          encoding: 'utf8', timeout: 3000,
        });
        vramUsedGb = parseInt(output.trim(), 10) / 1024;
      }
    } catch { /* ignore */ }

    return {
      vramTotalGb: HardwareProbe._stable.vramTotalGb,
      vramUsedGb,
      ramTotalGb,
      ramUsedGb,
      cpuUsagePct: HardwareProbe.getCpuUsage(),
      tier: HardwareProbe._stable.tier,
    };
  }

  private static getCpuUsage(): number {
    const now = Date.now();
    if (now - HardwareProbe._cpuCache.ts < 5_000) return HardwareProbe._cpuCache.value;

    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const cpu of cpus) {
      const t = cpu.times;
      idle += t.idle;
      total += t.user + t.nice + t.sys + t.idle + t.irq;
    }

    let pct = 0;
    if (HardwareProbe._prevCpuTimes) {
      const idleDelta = idle - HardwareProbe._prevCpuTimes.idle;
      const totalDelta = total - HardwareProbe._prevCpuTimes.total;
      pct = totalDelta > 0 ? 100 * (1 - idleDelta / totalDelta) : 0;
    }
    HardwareProbe._prevCpuTimes = { idle, total };
    HardwareProbe._cpuCache = { value: pct, ts: now };
    return pct;
  }
}
