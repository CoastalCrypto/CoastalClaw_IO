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
  static getStats(): HardwareStats {
    const ramTotalGb = os.totalmem() / (1024 ** 3);
    const ramUsedGb = (os.totalmem() - os.freemem()) / (1024 ** 3);
    
    let vramTotalGb = 0;
    let vramUsedGb = 0;

    try {
      if (process.platform === 'win32' || process.platform === 'linux') {
        // Try nvidia-smi
        const output = execSync('nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits', { encoding: 'utf8' });
        const [total, used] = output.split(',').map(s => parseInt(s.trim(), 10));
        vramTotalGb = total / 1024;
        vramUsedGb = used / 1024;
      } else if (process.platform === 'darwin') {
        // Mac Unified Memory - we treat a portion of RAM as VRAM budget for Ollama
        vramTotalGb = ramTotalGb * 0.75; // Apple allows ~75% of RAM for GPU
        // We can't easily get "used VRAM" on Mac unified memory in a simple way, 
        // but we can estimate based on system pressure or just use 0 for now.
      }
    } catch (e) {
      // No GPU or nvidia-smi failed, fall back to CPU only (0 VRAM)
    }

    // Determine Tier
    let tier: HardwareStats['tier'] = 'lite';
    if (vramTotalGb >= 20 || ramTotalGb >= 64) {
      tier = 'apex';
    } else if (vramTotalGb >= 8 || ramTotalGb >= 16) {
      tier = 'standard';
    }

    return {
      vramTotalGb,
      vramUsedGb,
      ramTotalGb,
      ramUsedGb,
      cpuUsagePct: HardwareProbe.getCpuUsage(),
      tier
    };
  }

  private static getCpuUsage(): number {
    const cpus = os.cpus();
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    const total = user + nice + sys + idle + irq;
    return 100 - (100 * idle / total);
  }
}
