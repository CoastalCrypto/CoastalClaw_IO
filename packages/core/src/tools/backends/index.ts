// packages/core/src/tools/backends/index.ts
export type { ShellBackend, ShellResult } from './types.js'
export { NativeBackend } from './native.js'
export { RestrictedLocalBackend } from './restricted-local.js'
export { DockerBackend } from './docker.js'

import type { ShellBackend } from './types.js'
import type { TrustLevel } from '../../config.js'
import { NativeBackend } from './native.js'
import { RestrictedLocalBackend } from './restricted-local.js'
import { DockerBackend } from './docker.js'

export function createBackend(trustLevel: TrustLevel, allowedPaths: string[]): ShellBackend {
  switch (trustLevel) {
    case 'sandboxed':  return new DockerBackend()
    case 'trusted':    return new RestrictedLocalBackend(allowedPaths)
    case 'autonomous': return new NativeBackend()
  }
}
