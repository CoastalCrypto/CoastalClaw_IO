import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkspaceMap } from './touched-packages.js'

export function loadWorkspaceMapSync(repoRoot: string): WorkspaceMap {
  const pkgsDir = join(repoRoot, 'packages')
  if (!existsSync(pkgsDir)) return { packages: [] }
  const out: { name: string; path: string }[] = []
  for (const entry of readdirSync(pkgsDir)) {
    const full = join(pkgsDir, entry)
    if (!statSync(full).isDirectory()) continue
    const pkgJson = join(full, 'package.json')
    if (!existsSync(pkgJson)) continue
    const data = JSON.parse(readFileSync(pkgJson, 'utf8'))
    if (data.name) out.push({ name: simplifyName(data.name), path: `packages/${entry}` })
  }
  return { packages: out }
}

function simplifyName(name: string): string {
  if (name.startsWith('@')) return name.split('/')[1] ?? name
  return name
}
