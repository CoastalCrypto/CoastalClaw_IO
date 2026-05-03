export interface TodoSignal {
  file: string
  line: number
  text: string
}

export interface ChurnSignal {
  file: string
  changes: number
}

export function findStaleTodos(grepOutput: string): TodoSignal[] {
  if (!grepOutput.trim()) return []
  return grepOutput.trim().split('\n').map(line => {
    const match = line.match(/^(.+?):(\d+):\s*(.+)$/)
    if (!match) return null
    return { file: match[1], line: Number(match[2]), text: match[3].trim() }
  }).filter((x): x is TodoSignal => x !== null)
}

export function findChurnHotspots(gitLogOutput: string, minChanges = 3): ChurnSignal[] {
  if (!gitLogOutput.trim()) return []
  const counts = new Map<string, number>()
  for (const file of gitLogOutput.trim().split('\n')) {
    const f = file.trim()
    if (!f) continue
    counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, cnt]) => cnt >= minChanges)
    .sort((a, b) => b[1] - a[1])
    .map(([file, changes]) => ({ file, changes }))
}

export interface HarvestedSignals {
  staleTodos: TodoSignal[]
  churnHotspots: ChurnSignal[]
}
