const UNITS: [number, string][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [30, 'day'],
  [12, 'month'],
  [Infinity, 'year'],
]

export function relativeTime(timestampMs: number): string {
  let delta = Math.round((Date.now() - timestampMs) / 1000)
  if (delta < 5) return 'just now'

  for (const [divisor, unit] of UNITS) {
    if (delta < divisor) {
      return `${delta} ${unit}${delta !== 1 ? 's' : ''} ago`
    }
    delta = Math.floor(delta / divisor)
  }
  return 'a long time ago'
}
