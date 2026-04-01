// packages/core/src/tools/backends/docker.ts  (PLACEHOLDER — will be replaced in Task 6)
import { NativeBackend } from './native.js'

export class DockerBackend extends NativeBackend {
  override readonly name = 'docker'

  override async isAvailable(): Promise<boolean> {
    // Placeholder — real implementation in Task 6
    return false
  }
}
