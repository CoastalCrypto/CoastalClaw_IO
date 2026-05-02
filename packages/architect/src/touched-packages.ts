export interface WorkspacePkg {
  name: string
  path: string
}

export interface WorkspaceMap {
  packages: WorkspacePkg[]
}

export function findTouchedPackages(diff: string, ws: WorkspaceMap): string[] {
  const touched = new Set<string>()
  for (const m of diff.matchAll(/^[-+]{3}\s+([ab]\/)?(\S+)/gm)) {
    const path = m[2]
    if (path === '/dev/null') continue
    for (const pkg of ws.packages) {
      if (path.startsWith(pkg.path + '/') || path === pkg.path) {
        touched.add(pkg.name)
        break
      }
    }
  }
  return [...touched]
}
