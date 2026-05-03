export interface PRStatusInput {
  prUrl: string
  ghView: (prUrl: string) => Promise<{ state: string; mergedAt: string | null }>
}

export type PRStatus =
  | { status: 'merged' }
  | { status: 'closed' }
  | { status: 'open' }
  | { status: 'error'; message: string }

export async function pollPRStatus(input: PRStatusInput): Promise<PRStatus> {
  try {
    const pr = await input.ghView(input.prUrl)
    if (pr.state === 'MERGED' || pr.mergedAt) return { status: 'merged' }
    if (pr.state === 'CLOSED') return { status: 'closed' }
    return { status: 'open' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 'error', message }
  }
}

export interface AutoMergeInput {
  prUrl: string
  ghMerge: (prUrl: string) => Promise<void>
}

export type AutoMergeResult =
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export async function triggerAutoMerge(input: AutoMergeInput): Promise<AutoMergeResult> {
  try {
    await input.ghMerge(input.prUrl)
    return { kind: 'ok' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { kind: 'error', message }
  }
}
