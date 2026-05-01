import { createHash } from 'node:crypto'

export function computeDedupSignature(title: string, targetHints: string[] | null | undefined): string {
  const normalizedTitle = (title ?? '').trim().toLowerCase()
  const sortedHints = (targetHints ?? []).slice().sort()
  const payload = `${normalizedTitle}|${sortedHints.join(',')}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}
