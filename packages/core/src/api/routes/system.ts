import type { FastifyInstance } from 'fastify'
import { readFileSync, existsSync } from 'node:fs'
import { execSync, execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../../config.js'
import { VibeVoiceClient } from '../../voice/vibevoice.js'
import { restartServer } from './system-restart.js'
import { scanHardware, recommendModels } from '../../models/hardware-scan.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Voices available in the VibeVoice TTS service
const VIBE_VOICES = [
  { id: 'en_us_female_1', label: 'US English — Female 1' },
  { id: 'en_us_female_2', label: 'US English — Female 2' },
  { id: 'en_us_male_1',   label: 'US English — Male 1' },
  { id: 'en_us_male_2',   label: 'US English — Male 2' },
  { id: 'en_gb_female_1', label: 'British English — Female' },
  { id: 'en_gb_male_1',   label: 'British English — Male' },
  { id: 'en_au_female_1', label: 'Australian English — Female' },
  { id: 'en_au_male_1',   label: 'Australian English — Male' },
]

function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1, bitDepth = 16): Buffer {
  const byteRate = (sampleRate * channels * bitDepth) / 8
  const blockAlign = (channels * bitDepth) / 8
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + pcm.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(channels, 22)
  h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(byteRate, 28)
  h.writeUInt16LE(blockAlign, 32)
  h.writeUInt16LE(bitDepth, 34)
  h.write('data', 36)
  h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8'))
    return pkg.version ?? '0.0.0'
  } catch { return '0.0.0' }
}

function gitCommit(): string {
  try { return execSync('git rev-parse --short HEAD', { timeout: 2000 }).toString().trim() } catch { return 'unknown' }
}

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
      const out = execFileSync('df', ['-B1', p], { timeout: 2000 }).toString().trim()
      const lastLine = out.split('\n').filter(Boolean).at(-1) ?? ''
      const [, total, used, free] = lastLine.split(/\s+/).map(Number)
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

  // GET /api/version — current app version (public, used by frontend update poller)
  fastify.get('/api/version', async (_req, reply) => {
    return reply.send({ version: appVersion(), commit: gitCommit() })
  })

  // GET /api/voices — list VibeVoice voices (public, used by AgentEditor)
  fastify.get('/api/voices', async (_req, reply) => {
    const vibe = new VibeVoiceClient()
    const available = await vibe.isAvailable()
    return reply.send({ vibeAvailable: available, voices: available ? VIBE_VOICES : [] })
  })

  // POST /api/admin/tts — synthesise speech via VibeVoice, return WAV
  fastify.post<{ Body: { text: string; voice: string } }>('/api/admin/tts', async (req, reply) => {
    const { text, voice } = req.body ?? {}
    if (!text || !voice) return reply.status(400).send({ error: 'text and voice required' })
    const vibe = new VibeVoiceClient()
    const chunks: Buffer[] = []
    let sampleRate = 24_000
    for await (const { pcm, sampleRate: sr } of vibe.speak(text, voice)) {
      chunks.push(pcm)
      sampleRate = sr
    }
    const wav = pcmToWav(Buffer.concat(chunks), sampleRate)
    reply.header('Content-Type', 'audio/wav')
    return reply.send(wav)
  })

  // GET /api/admin/update-check — compare local HEAD to remote HEAD (no user input)
  fastify.get('/api/admin/update-check', async (_req, reply) => {
    try {
      const localFull  = gitCommit() // already uses execSync safely
      const remoteLine = execSync('git ls-remote origin HEAD', {
        timeout: 10_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      }).toString().trim()
      const remoteFull = remoteLine.split(/\s+/)[0] ?? ''
      if (!remoteFull) return reply.send({ updateAvailable: false, localCommit: localFull, remoteCommit: null })
      const localLong = execSync('git rev-parse HEAD', { timeout: 2000 }).toString().trim()
      return reply.send({
        updateAvailable: !remoteFull.startsWith(localLong.slice(0, remoteFull.length)),
        localCommit: localFull,
        remoteCommit: remoteFull.slice(0, 7),
      })
    } catch {
      return reply.send({ updateAvailable: false, localCommit: gitCommit(), remoteCommit: null })
    }
  })

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
        // Platform-aware restart: Windows uses detached cmd.exe, Linux uses systemd
        restartServer(installDir)
      } catch (e) {
        console.error('[update] failed:', e)
      }
    }, 500)
  })

  // GET /api/admin/hardware-scan — scan hardware and recommend Ollama models
  fastify.get('/api/admin/hardware-scan', async (_req, reply) => {
    const hardware = scanHardware(config.dataDir)
    const recommendations = recommendModels(hardware)
    return reply.send({ hardware, recommendations })
  })
}
