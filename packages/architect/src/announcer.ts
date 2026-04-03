// packages/architect/src/announcer.ts

export interface AnnounceOpts {
  serverUrl: string
  adminToken: string
  summary: string
  diff: string
  vetoTimeoutMs: number
  pollIntervalMs?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** POST proposal to coastal-server, then poll until vetoed or timeout. */
export async function waitForVeto(opts: AnnounceOpts): Promise<'proceed' | 'vetoed'> {
  const pollMs = opts.pollIntervalMs ?? 5_000
  let proposalId: string | null = null

  // Announce — fail open if server unreachable
  try {
    const res = await fetch(`${opts.serverUrl}/api/admin/architect/propose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': opts.adminToken,
      },
      body: JSON.stringify({ summary: opts.summary, diff: opts.diff }),
    })
    if (res.ok) {
      const json = await res.json() as { proposalId?: string }
      proposalId = json.proposalId ?? null
    }
  } catch {
    // Server unreachable — proceed without veto window
    console.warn('[architect] coastal-server unreachable — proceeding without veto window')
    return 'proceed'
  }

  if (!proposalId) return 'proceed'

  // Poll for veto
  const deadline = Date.now() + opts.vetoTimeoutMs
  while (Date.now() < deadline) {
    await sleep(Math.min(pollMs, deadline - Date.now()))
    try {
      const res = await fetch(
        `${opts.serverUrl}/api/admin/architect/proposal/${proposalId}`,
        { headers: { 'x-admin-token': opts.adminToken } }
      )
      if (res.ok) {
        const json = await res.json() as { status: string }
        if (json.status === 'vetoed') return 'vetoed'
        if (json.status === 'expired') return 'proceed'
      }
    } catch {
      // Poll failure — continue waiting
    }
  }
  return 'proceed'
}
