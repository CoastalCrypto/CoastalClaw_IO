// packages/architect/src/config.ts
import { posix } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_LOCKED_PATTERNS: RegExp[] = [
  /^data\//,
  /^\.git\//,
  /^node_modules\//,
  /(^|\/)\.env(\..*)?$/,
  /(^|\/)secrets\//,
  /^packaging\//,
  /^coastalos\/build\//,
  /^packages\/architect\//,
  /^packages\/core\/src\/agents\/permission-gate\.ts$/,
  /^packages\/core\/src\/agents\/action-log\.ts$/,
  /^packages\/core\/src\/api\/routes\/admin\.ts$/,
]

function normalizeForCheck(relPath: string): string {
  return posix.normalize(
    relPath
      .replace(/\\/g, '/')
      .replace(/^(\.\/)+/, '')
      .toLowerCase()
  )
}

export function isLockedPath(relPath: string, overrides?: RegExp[]): string | null {
  const norm = normalizeForCheck(relPath)
  const patterns = overrides && overrides.length > 0 ? overrides : DEFAULT_LOCKED_PATTERNS
  for (const re of patterns) {
    if (re.test(norm)) return `path '${relPath}' matches locked pattern ${re}`
  }
  return null
}

export function loadLockedPathOverrides(dataDir: string): RegExp[] | null {
  const file = join(dataDir, '.architect-locked-paths')
  if (!existsSync(file)) return null
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))
  return lines.map(l => new RegExp(l))
}

/** Number of unreviewed skill gaps that triggers an architect cycle. */
export const SKILL_GAPS_THRESHOLD = 10

/** Veto window in milliseconds. */
export const VETO_TIMEOUT_MS = 60_000

/** Hours to skip a pattern after a failed architect cycle. */
export const SKIP_HOURS = 24

/** Default cron expression for nightly run (02:00 local). */
export const NIGHTLY_CRON = '0 2 * * *'

export const CURRICULUM_SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
export const CURRICULUM_DAILY_BUDGET_CONSERVATIVE = 1
export const CURRICULUM_DAILY_BUDGET_AGGRESSIVE = 5
