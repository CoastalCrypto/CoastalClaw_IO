// packages/daemon/src/voice/tts.ts
import { spawnSync } from 'node:child_process'
import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export interface TTSOptions {
  voiceModel?: string       // e.g. "en_US-lessac-medium"
  voicesDir?: string        // directory containing .onnx Piper models
  piperBin?: string         // path to piper binary
  espeakFallback?: boolean  // use espeak if piper fails
  mockMode?: boolean
}

const DEFAULT_VOICES_DIR = '/opt/coastal/voices'
const DEFAULT_PIPER_BIN = 'piper'

/**
 * Synthesize text to PCM audio using Piper TTS.
 * Falls back to espeak-ng if Piper is unavailable.
 * Returns an empty Buffer on complete failure.
 */
export async function synthesize(text: string, opts: TTSOptions = {}): Promise<Buffer> {
  if (opts.mockMode || process.env.NODE_ENV === 'test') {
    // Return 100ms of silence (16-bit 22kHz mono)
    return Buffer.alloc(22_050 * 2 * 0.1)
  }

  const piperBin = opts.piperBin ?? DEFAULT_PIPER_BIN
  const voiceModel = opts.voiceModel ?? 'en_US-lessac-medium'
  const voicesDir = opts.voicesDir ?? DEFAULT_VOICES_DIR
  const modelPath = join(voicesDir, `${voiceModel}.onnx`)

  // Try Piper TTS
  if (existsSync(modelPath)) {
    const outFile = join(tmpdir(), `tts-${randomBytes(4).toString('hex')}.raw`)
    try {
      const result = spawnSync(piperBin, [
        '--model', modelPath,
        '--output_raw',
        '--output_file', outFile,
      ], {
        input: text,
        encoding: 'utf8',
        timeout: 30_000,
      })
      if (result.status === 0 && existsSync(outFile)) {
        const audio = readFileSync(outFile)
        unlinkSync(outFile)
        return audio
      }
    } catch {
      // Fall through to espeak
    } finally {
      try { unlinkSync(outFile) } catch {}
    }
  }

  // Fallback: espeak-ng
  if (opts.espeakFallback !== false) {
    try {
      const outFile = join(tmpdir(), `espeak-${randomBytes(4).toString('hex')}.wav`)
      const result = spawnSync('espeak-ng', [
        '-w', outFile,
        '--stdin',
      ], {
        input: text,
        timeout: 15_000,
      })
      if (result.status === 0 && existsSync(outFile)) {
        const audio = readFileSync(outFile)
        unlinkSync(outFile)
        // Strip WAV header (44 bytes) to get raw PCM
        return audio.slice(44)
      }
    } catch (e: any) {
      console.warn('[tts] espeak-ng fallback failed:', e.message)
    }
  }

  console.warn('[tts] All TTS backends failed for text:', text.slice(0, 50))
  return Buffer.alloc(0)
}
