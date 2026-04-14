// packages/architect/src/index.ts
import 'dotenv/config'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { plan } from './planner.js'
import { Patcher } from './patcher.js'
import { runTests } from './validator.js'
import { waitForVeto } from './announcer.js'
import { SKILL_GAPS_THRESHOLD, VETO_TIMEOUT_MS, isLockedPath } from './config.js'
import Database from 'better-sqlite3'

const REPO_ROOT    = process.env.CC_REPO_ROOT          ?? process.cwd()
const DATA_DIR     = process.env.CC_DATA_DIR            ?? join(REPO_ROOT, 'data')
const OLLAMA_URL   = process.env.CC_OLLAMA_URL          ?? 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.CC_ARCHITECT_MODEL     ?? 'llama3.2'
const SERVER_URL   = process.env.CC_SERVER_URL          ?? 'http://localhost:4747'
const CHECK_INTERVAL_MS = Number(process.env.CC_ARCHITECT_INTERVAL_MS ?? '60000')
const AUTONOMOUS   = existsSync(join(DATA_DIR, '.architect-autonomous'))

function getAdminToken(): string {
  const envToken = process.env.CC_ADMIN_TOKEN
  if (envToken) return envToken
  const tokenFile = join(DATA_DIR, '.admin-token')
  if (existsSync(tokenFile)) return readFileSync(tokenFile, 'utf8').trim()
  return ''
}

function countUnreviewedGaps(): number {
  const dbPath = join(DATA_DIR, 'skill-gaps.db')
  if (!existsSync(dbPath)) return 0
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM skill_gaps WHERE reviewed = 0').get() as { cnt: number }
    return row.cnt
  } finally {
    db.close()
  }
}

async function runCycle(): Promise<void> {
  console.log('[coastal-architect] Starting improvement cycle...')

  const result = await plan({ dataDir: DATA_DIR, repoRoot: REPO_ROOT, ollamaUrl: OLLAMA_URL, model: OLLAMA_MODEL })
  if (!result) {
    console.log('[coastal-architect] Nothing to improve.')
    return
  }

  // Locked path guard
  if (isLockedPath(result.targetFile)) {
    console.warn(`[coastal-architect] Proposed change targets locked path: ${result.targetFile} — skipping.`)
    return
  }

  console.log(`[coastal-architect] Proposal: ${result.summary}`)

  // Veto window (skip if autonomous mode)
  if (!AUTONOMOUS) {
    const decision = await waitForVeto({
      serverUrl: SERVER_URL,
      adminToken: getAdminToken(),
      summary: result.summary,
      diff: result.diff,
      vetoTimeoutMs: VETO_TIMEOUT_MS,
    })
    if (decision === 'vetoed') {
      console.log('[coastal-architect] Vetoed by user — aborting cycle.')
      return
    }
  }

  // Apply and test
  const branchName = `feature/self-improve-${new Date().toISOString().slice(0, 10)}`
  const patcher = new Patcher(REPO_ROOT)
  try {
    await patcher.createBranch(branchName)
    await patcher.applyDiff(result.diff)
    await patcher.commitChange(`chore(architect): ${result.summary}`)

    const testResult = runTests(REPO_ROOT)
    if (testResult.passed) {
      await patcher.checkoutMain()
      await patcher.mergeBranch(branchName)
      console.log(`[coastal-architect] Applied: ${result.summary} — ${testResult.summary}`)
      // Broadcast architect_applied event to UI via coastal-server
      try {
        await fetch(`${SERVER_URL}/api/admin/architect/applied`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
          body: JSON.stringify({ summary: result.summary, testsDelta: testResult.summary }),
        })
      } catch { /* Non-fatal — server may be restarting */ }
      // Signal coastal-server to restart gracefully
      if (process.env.CC_SERVER_PID) {
        if (process.platform === 'win32') {
          console.log('[coastal-architect] Restart signal not supported on Windows — restart the server manually.')
        } else {
          process.kill(Number(process.env.CC_SERVER_PID), 'SIGUSR2')
        }
      }
    } else {
      await patcher.checkoutMain()
      await patcher.deleteBranch(branchName)
      console.warn(`[coastal-architect] Tests failed — branch deleted. ${testResult.summary}`)
    }
  } catch (err) {
    // Ensure we return to main branch on error
    try { await patcher.checkoutMain() } catch {}
    try { await patcher.deleteBranch(branchName) } catch {}
    console.error('[coastal-architect] Cycle error:', err)
  }
}

async function main(): Promise<void> {
  console.log('[coastal-architect] Started.')

  // Write PID file so admin /run route can signal this process
  const pidFile = join(DATA_DIR, '.architect-pid')
  writeFileSync(pidFile, String(process.pid))

  let lastCount = countUnreviewedGaps()

  const interval = setInterval(async () => {
    const count = countUnreviewedGaps()
    if (count >= SKILL_GAPS_THRESHOLD && count > lastCount) {
      console.log(`[coastal-architect] Threshold reached (${count} gaps) — triggering cycle.`)
      lastCount = count
      await runCycle()
    }
    lastCount = count
  }, CHECK_INTERVAL_MS)

  process.on('SIGUSR1', async () => {
    console.log('[coastal-architect] Manual trigger received.')
    await runCycle()
  })

  const cleanup = () => {
    clearInterval(interval)
    try { unlinkSync(join(DATA_DIR, '.architect-pid')) } catch {}
    process.exit(0)
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)

  console.log(`[coastal-architect] Watching skill-gaps.db (threshold: ${SKILL_GAPS_THRESHOLD}, interval: ${CHECK_INTERVAL_MS}ms)`)
}

main().catch(e => { console.error('[coastal-architect] Fatal:', e); process.exit(1) })
