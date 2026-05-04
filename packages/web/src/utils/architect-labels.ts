// Human-readable labels for architect failure kinds and stages.
// Spec: section 4 "Plain-language failure-kind labels"

export const FAILURE_LABELS: Record<string, string> = {
  parse: 'AI didn\'t return a valid plan',
  apply: 'Couldn\'t apply the change cleanly',
  locked: 'Tried to edit a protected file',
  budget: 'Change was too big',
  lint: 'Code style issue',
  type: 'TypeScript error',
  build: 'Build failed',
  test: 'Tests failed',
  env_llm: 'Model unavailable',
  env_gh: 'GitHub CLI error',
  env_push: 'Git push failed',
  env_branch: 'Branch creation failed',
  env_perm: 'Permission denied',
  env_db: 'Database error',
}

export const STAGE_LABELS: Record<string, string> = {
  planning: 'Writing the plan',
  plan_review: 'Waiting for plan approval',
  building: 'Building + testing',
  pr_review: 'PR open, waiting for merge',
  done: 'Complete',
  cancelled: 'Cancelled',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'In queue',
  active: 'Working',
  awaiting_human: 'Needs your attention',
  merged: 'Merged',
  cancelled: 'Cancelled',
  error: 'Paused (error)',
  paused: 'Paused',
}

export function failureLabel(kind: string | null): string {
  if (!kind) return 'None'
  return FAILURE_LABELS[kind] ?? kind
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}
