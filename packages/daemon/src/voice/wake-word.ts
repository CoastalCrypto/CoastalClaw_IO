// packages/daemon/src/voice/wake-word.ts
import { spawn, ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

export interface WakeWordOptions {
  keyword?: string
  modelPath?: string
  mockMode?: boolean
}

/**
 * WakeWordDetector wraps the openWakeWord Python library as a child process.
 * The Python script reads audio from stdin (PCM 16-bit 16kHz mono) and
 * writes a line "DETECTED" to stdout when the wake word fires.
 *
 * In mockMode (tests), it emits 'detected' after a short delay.
 */
export class WakeWordDetector extends EventEmitter {
  private proc: ChildProcess | null = null
  private opts: WakeWordOptions

  constructor(opts: WakeWordOptions = {}) {
    super()
    this.opts = opts
  }

  start(): void {
    if (this.opts.mockMode) {
      // Simulate a wake word detection after 50ms for testing
      setTimeout(() => this.emit('detected'), 50)
      return
    }

    // Launch the Python bridge script (python3 on Linux/macOS, python on Windows)
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3'
    this.proc = spawn(pythonBin, ['-c', this.getPythonScript()], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.proc.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n')
      for (const line of lines) {
        if (line.trim() === 'DETECTED') {
          this.emit('detected')
        }
      }
    })

    this.proc.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.warn('[wake-word] Python stderr:', msg)
    })

    this.proc.on('error', (err) => {
      console.warn('[wake-word] Process error:', err.message)
      console.warn('[wake-word] Ensure python3 and openwakeword are installed: pip3 install openwakeword')
    })
  }

  /** Write PCM audio buffer to the Python process stdin. */
  feed(audioBuffer: Buffer): void {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(audioBuffer)
    }
  }

  stop(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }

  private getPythonScript(): string {
    const keyword = (this.opts.keyword ?? 'hey coastal').replace(/'/g, "\\'")
    return `
import sys, struct
try:
    from openwakeword.model import Model
    model = Model(wakeword_models=['${keyword}'], inference_framework='onnx')
    chunk_size = 1280
    while True:
        data = sys.stdin.buffer.read(chunk_size * 2)
        if not data:
            break
        audio = struct.unpack('<' + 'h' * (len(data)//2), data)
        pred = model.predict(list(audio))
        for name, score in pred.items():
            if score > 0.5:
                sys.stdout.write('DETECTED\\n')
                sys.stdout.flush()
except ImportError:
    sys.stderr.write('openwakeword not installed\\n')
    sys.exit(1)
except KeyboardInterrupt:
    pass
`
  }
}
