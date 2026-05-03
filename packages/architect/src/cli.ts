// packages/architect/src/cli.ts

const BASE_URL = process.env.CC_SERVER_URL ?? 'http://localhost:4747'
const TOKEN = process.env.CC_ADMIN_TOKEN ?? ''

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`API ${resp.status}: ${text}`)
  }
  return resp.json()
}

const commands: Record<string, (args: string[]) => Promise<void>> = {
  on: async () => {
    await api('POST', '/api/admin/architect/power', { state: 'on' })
    console.log('Architect: ON')
  },
  off: async () => {
    await api('POST', '/api/admin/architect/power', { state: 'off' })
    console.log('Architect: OFF')
  },
  status: async () => {
    const s = await api('GET', '/api/admin/architect/status')
    const q = await api('GET', '/api/admin/architect/work-items?status=pending')
    console.log(`Architect: ${s.power.toUpperCase()}  (Mode: ${s.mode})`)
    console.log(`Pending in queue: ${q.length}`)
  },
  mode: async (args) => {
    const mode = args[0]
    if (!mode) {
      console.error('Usage: architect mode <hands-on|hands-off|autopilot|custom>')
      return
    }
    await api('POST', '/api/admin/architect/mode', { mode })
    console.log(`Mode set to: ${mode}`)
  },
  ask: async (args) => {
    const title = args.join(' ')
    if (!title) {
      console.error('Usage: architect ask "description"')
      return
    }
    const item = await api('POST', '/api/admin/architect/work-items', { title, body: title })
    console.log(`Created work item: ${item.id}`)
  },
  queue: async () => {
    const items = await api('GET', '/api/admin/architect/work-items?status=all')
    if (items.length === 0) {
      console.log('Queue is empty.')
      return
    }
    for (const i of items) console.log(`  ${i.id.slice(-8)} [${i.status}] ${i.title}`)
  },
  approve: async (args) => {
    const id = args[0]
    if (!id) {
      console.error('Usage: architect approve <cycle-id>')
      return
    }
    await api('POST', `/api/admin/architect/cycles/${id}/approval`, { gate: 'plan', decision: 'approved' })
    console.log('Approved.')
  },
  reject: async (args) => {
    const id = args[0]
    if (!id) {
      console.error('Usage: architect reject <cycle-id>')
      return
    }
    await api('POST', `/api/admin/architect/cycles/${id}/approval`, { gate: 'plan', decision: 'rejected' })
    console.log('Rejected.')
  },
  revise: async (args) => {
    const id = args[0]
    const comment = args.slice(1).join(' ')
    if (!id) {
      console.error('Usage: architect revise <cycle-id> "comment"')
      return
    }
    await api('POST', `/api/admin/architect/cycles/${id}/approval`, { gate: 'plan', decision: 'revised', comment })
    console.log('Revision requested.')
  },
  last: async () => {
    const activity = await api('GET', '/api/admin/architect/activity?limit=5')
    if (activity.length === 0) {
      console.log('No recent activity.')
      return
    }
    for (const c of activity) {
      console.log(`  ${c.id.slice(-8)} [${c.stage}] ${c.outcome ?? 'in progress'} iter=${c.iteration}`)
    }
  },
  digest: async () => {
    const insights = await api('GET', '/api/admin/architect/insights?range=1')
    console.log(`Success rate (24h): ${(insights.successRate * 100).toFixed(0)}%`)
    console.log(`Open queue: ${insights.openQueueDepth}`)
    console.log(`Errors: ${insights.errorCount}`)
  },
}

export async function runCLI(args: string[]): Promise<void> {
  const [cmd, ...rest] = args
  const handler = commands[cmd ?? 'status']
  if (!handler) {
    console.log('Available commands: on, off, status, mode, ask, queue, approve, reject, revise, last, digest')
    return
  }
  await handler(rest)
}
