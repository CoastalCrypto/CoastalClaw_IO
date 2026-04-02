// packages/architect/src/config.ts

export const LOCKED_PATHS = new Set([
  'packages/architect/src/index.ts',
  'packages/architect/src/config.ts',
  'packages/architect/src/patcher.ts',
  'packages/architect/src/validator.ts',
  'packages/core/src/agents/permission-gate.ts',
  'packages/core/src/agents/action-log.ts',
  'packages/core/src/api/routes/admin.ts',
])

/** Returns true if the normalized relative path is in the locked set. */
export function isLockedPath(relPath: string): boolean {
  // Normalize: strip leading ./ and replace backslashes
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '')
  return LOCKED_PATHS.has(norm)
}

/** Number of unreviewed skill gaps that triggers an architect cycle. */
export const SKILL_GAPS_THRESHOLD = 10

/** Veto window in milliseconds. */
export const VETO_TIMEOUT_MS = 60_000

/** Hours to skip a pattern after a failed architect cycle. */
export const SKIP_HOURS = 24

/** Default cron expression for nightly run (02:00 local). */
export const NIGHTLY_CRON = '0 2 * * *'
