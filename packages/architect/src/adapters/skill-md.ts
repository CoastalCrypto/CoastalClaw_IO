import { readdirSync, readFileSync, watch, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSkillMd } from '../skill-md.js'
import type { WorkItemStore } from '@coastal-ai/core/architect/store'
import { DedupConflictError } from '@coastal-ai/core/architect/store'

export interface SkillMdAdapterDeps {
  store: WorkItemStore
  dirPath: string
  log?: (msg: string) => void
}

export function startSkillMdAdapter(deps: SkillMdAdapterDeps): { stop: () => void } {
  const log = deps.log ?? ((m) => console.log(`[architect:skill-md] ${m}`))
  if (!existsSync(deps.dirPath)) mkdirSync(deps.dirPath, { recursive: true })

  let timer: NodeJS.Timeout | null = null

  const reconcile = () => {
    let entries: string[] = []
    try {
      entries = readdirSync(deps.dirPath).filter(f => f.endsWith('.md'))
    } catch (err) {
      log(`failed to read dir: ${(err as Error).message}`)
      return
    }

    for (const file of entries) {
      const fullPath = join(deps.dirPath, file)
      let content: string
      try {
        content = readFileSync(fullPath, 'utf8')
      } catch (err) {
        log(`failed to read ${file}: ${(err as Error).message}`)
        continue
      }
      const parsed = parseSkillMd(content)
      if (!parsed.ok) {
        log(`${file}: invalid frontmatter (${parsed.error})`)
        continue
      }
      const s = parsed.value
      try {
        deps.store.insert({
          source: 'skill_md',
          sourceRef: file,
          title: s.name,
          body: s.body || s.description,
          targetHints: s.targetHints ?? null,
          acceptance: s.acceptance ?? null,
          budgetLoc: s.budgetLoc,
          budgetIters: s.budgetIters,
          approvalPolicy: s.approvalPolicy,
        })
        log(`inserted "${s.name}" from ${file}`)
      } catch (err) {
        if (err instanceof DedupConflictError) {
          // Idempotent — already in queue.
        } else {
          log(`failed to insert ${file}: ${(err as Error).message}`)
        }
      }
    }
  }

  reconcile()

  const watcher = watch(deps.dirPath, () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(reconcile, 2000)
  })

  return {
    stop: () => {
      if (timer) clearTimeout(timer)
      watcher.close()
    },
  }
}
