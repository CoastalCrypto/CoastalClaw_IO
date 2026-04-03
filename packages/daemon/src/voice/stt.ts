// packages/daemon/src/voice/stt.ts
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export interface STTResult {
  text: string
  language: string
}

export interface STTOptions {
  modelPath?: string
  language?: string
  mockMode?: boolean
}

/**
 * Transcribe a PCM audio buffer using Whisper.cpp via nodejs-whisper.
 * Audio must be 16kHz mono 16-bit PCM (the standard Whisper input format).
 */
export async function transcribe(audioBuffer: Buffer, opts: STTOptions = {}): Promise<STTResult> {
  if (opts.mockMode === true || (opts.mockMode !== false && process.env.NODE_ENV === 'test')) {
    return { text: 'mock transcription', language: 'en' }
  }

  const modelPath = opts.modelPath ?? join(process.cwd(), 'data', 'models', 'ggml-tiny.en.bin')
  if (!existsSync(modelPath)) {
    console.warn(`[stt] Whisper model not found at ${modelPath}. Run: node -e "require('nodejs-whisper').download('tiny.en')"`)
    return { text: '', language: 'en' }
  }

  // Write PCM to temp WAV file (whisper-node expects a WAV file path)
  const tmpWav = join(tmpdir(), `stt-${randomBytes(4).toString('hex')}.wav`)
  writeWav(audioBuffer, tmpWav, 16_000)

  try {
    // Dynamic require to avoid build errors when nodejs-whisper is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nodewhisper } = require('nodejs-whisper')
    const result = await nodewhisper(tmpWav, {
      modelName: 'tiny.en',
      autoDownloadModelName: 'tiny.en',
      verbose: false,
      removeWavFileAfterTranscription: false,
      withCuda: false,
      whisperOptions: {
        language: opts.language ?? 'en',
        outputInText: true,
      },
    })
    return { text: (result as string).trim(), language: opts.language ?? 'en' }
  } finally {
    try { unlinkSync(tmpWav) } catch {}
  }
}

/** Write a minimal WAV file header + PCM data. */
function writeWav(pcm: Buffer, outPath: string, sampleRate: number): void {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcm.length
  const fileSize = 36 + dataSize

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)       // subchunk size
  header.writeUInt16LE(1, 20)        // PCM format
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  writeFileSync(outPath, Buffer.concat([header, pcm]))
}
