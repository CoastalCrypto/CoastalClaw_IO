// packages/core/src/tools/backends/restricted-local.ts
import { resolve } from 'node:path'
import { NativeBackend } from './native.js'
import type { ShellResult } from './types.js'

export class RestrictedLocalBackend extends NativeBackend {
  override readonly name = 'restricted-local'

  constructor(private readonly allowedPaths: string[]) {
    super()
  }

  override async execute(
    cmd: string,
    workdir: string,
    sessionId: string,
    timeoutMs?: number,
  ): Promise<ShellResult> {
    const resolved = resolve(workdir)
    const allowed = this.allowedPaths.some(p => resolved.startsWith(resolve(p)))
    if (!allowed) {
      return {
        stdout: `Error: workdir "${workdir}" is outside the allowed paths for this trust tier.`,
        exitCode: 1,
        timedOut: false,
      }
    }
    return super.execute(cmd, resolved, sessionId, timeoutMs)
  }
}
