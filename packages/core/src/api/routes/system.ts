import type { FastifyInstance } from 'fastify'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { loadConfig } from '../../config.js'

interface DiskStat { path: string; total: number; used: number; free: number }

function cpuPercent(): number {
  try {
    const a = readFileSync('/proc/stat', 'utf8').split('\n')[0].split(/\s+/).slice(1).map(Number)
    const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0] = a
    const total = user + nice + system + idle + iowait + irq + softirq
    const busy  = total - idle - iowait
    return Math.round((busy / total) * 100)
  } catch { return 0 }
}

function memInfo(): { total: number; used: number; free: number; cached: number } {
  try {
    const raw = readFileSync('/proc/meminfo', 'utf8')
    const parse = (key: string) => {
      const m = raw.match(new RegExp(`${key}:\\s+(\\d+)`))
      return m ? Number(m[1]) * 1024 : 0
    }
    const total    = parse('MemTotal')
    const free     = parse('MemFree')
    const buffers  = parse('Buffers')
    const cached   = parse('Cached')
    const sreclaimable = parse('SReclaimable')
    const used = total - free - buffers - cached - sreclaimable
    return { total, used, free: free + buffers + cached + sreclaimable, cached }
  } catch { return { total: 0, used: 0, free: 0, cached: 0 } }
}

function diskStats(paths: string[]): DiskStat[] {
  return paths.map((p) => {
    try {
      const out = execSync(`df -B1 "${p}" 2>/dev/null | tail -1`, { timeout: 2000 }).toString().trim()
      const [, total, used, free] = out.split(/\s+/).map(Number)
      return { path: p, total, used, free }
    } catch { return { path: p, total: 0, used: 0, free: 0 } }
  })
}

function gpuStats(): { name: string; vramUsed: number; vramTotal: number; utilPercent: number } | null {
  try {
    const out = execSync(
      'nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits',
      { timeout: 2000 }
    ).toString().trim()
    const [name, vramUsed, vramTotal, util] = out.split(',').map(s => s.trim())
    return {
      name,
      vramUsed: Number(vramUsed) * 1024 * 1024,
      vramTotal: Number(vramTotal) * 1024 * 1024,
      utilPercent: Number(util),
    }
  } catch { return null }
}

function loadedModels(): string[] {
  try {
    const out = execSync('ollama ps 2>/dev/null', { timeout: 2000 }).toString()
    return out.split('\n').slice(1).filter(Boolean).map(l => l.split(/\s+/)[0])
  } catch { return [] }
}

export async function systemRoutes(fastify: FastifyInstance) {
  const config = loadConfig()

  // GET /api/system/stats — live hardware metrics
  fastify.get('/api/system/stats', async (_req, reply) => {
    const [mem, disk, gpu] = await Promise.all([
      Promise.resolve(memInfo()),
      Promise.resolve(diskStats([config.dataDir, '/'])),
      Promise.resolve(gpuStats()),
    ])
    return reply.send({
      cpu: { percent: cpuPercent() },
      mem,
      disk,
      gpu,
      models: loadedModels(),
      uptime: Math.floor(process.uptime()),
    })
  })

  // GET /api/admin/logs?service=server&lines=100
  fastify.get<{ Querystring: { service?: string; lines?: string } }>(
    '/api/admin/logs',
    async (req, reply) => {
      const service = req.query.service ?? 'coastalclaw-server'
      const lines   = Math.min(Number(req.query.lines ?? 200), 1000)

      // Prefer journald if available, fall back to log file
      try {
        const out = execSync(
          `journalctl -u "${service.replace(/[^a-z0-9._-]/gi, '')}" -n ${lines} --no-pager --output=short-iso 2>/dev/null`,
          { timeout: 5000 }
        ).toString()
        return reply.send({ service, lines: out.split('\n').filter(Boolean) })
      } catch {
        // Fallback: plain log file
        const logFile = join(config.dataDir, `${service}.log`)
        if (existsSync(logFile)) {
          const raw = readFileSync(logFile, 'utf8').split('\n')
          return reply.send({ service, lines: raw.slice(-lines).filter(Boolean) })
        }
        return reply.send({ service, lines: [] })
      }
    }
  )

  // POST /api/admin/update — pull latest + rebuild + restart
  fastify.post('/api/admin/update', async (_req, reply) => {
    const installDir = process.cwd()
    // Kick off async — reply immediately
    reply.send({ ok: true, message: 'Update started. Server will restart in ~30s.' })

    setTimeout(async () => {
      try {
        execSync('git pull --ff-only', { cwd: installDir, timeout: 60_000 })
        execSync('pnpm install --frozen-lockfile', { cwd: installDir, timeout: 120_000 })
        execSync('pnpm build', { cwd: installDir, timeout: 120_000 })
        // Restart via systemd if running under it, otherwise send SIGHUP
        try {
          execSync('systemctl restart coastalclaw-server 2>/dev/null || true', { timeout: 10_000 })
        } catch {
          process.exit(0) // supervisor (systemd Restart=always) will restart us
        }
      } catch (e) {
        console.error('[update] failed:', e)
      }
    }, 500)
  })
}
