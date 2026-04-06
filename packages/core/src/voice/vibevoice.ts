export interface TranscriptSpeaker {
  id: string
  start: number
  end: number
  text: string
}

export interface Transcript {
  text: string
  speakers: TranscriptSpeaker[]
}

/**
 * Client for the coastal-vibevoice FastAPI service (coastalos/vibevoice/server.py).
 *
 * VibeVoice-ASR-7B: replaces whisper-cpp — diarization, timestamps, 50+ languages.
 * VibeVoice-Realtime-0.5B: replaces piper-tts — streaming TTS, 200ms first chunk.
 *
 * GPU-conditional: if isAvailable() returns false, VoicePipeline falls back to
 * whisper-cpp (transcribe) and piper-tts (speak) unchanged.
 */
export class VibeVoiceClient {
  constructor(private readonly baseUrl = 'http://127.0.0.1:8001') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async transcribe(audioBuffer: Buffer, sampleRate = 16_000): Promise<Transcript> {
    const form = new FormData()
    form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav')
    form.append('sample_rate', String(sampleRate))

    const res = await fetch(`${this.baseUrl}/asr`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) throw new Error(`VibeVoice ASR error ${res.status}: ${await res.text()}`)
    return res.json() as Promise<Transcript>
  }

  async *speak(text: string, voice = 'en_us_female_1'): AsyncIterable<Buffer> {
    // WebSocket streaming — yields 24kHz PCM chunks as they arrive
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/tts/stream'
    const { WebSocket } = await import('ws')
    const ws = new WebSocket(wsUrl)

    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })

    ws.send(JSON.stringify({ text, voice }))

    const chunks: Buffer[] = []
    let done = false
    let error: unknown = null
    let notify: (() => void) | null = null

    ws.on('message', (data: Buffer | string) => {
      if (Buffer.isBuffer(data)) {
        chunks.push(data)
      } else {
        try {
          const msg = JSON.parse(data.toString()) as { done?: boolean }
          if (msg.done) done = true
        } catch { /* ignore non-JSON */ }
      }
      notify?.()
    })

    ws.on('error', (err) => { error = err; done = true; notify?.() })
    ws.on('close', () => { done = true; notify?.() })

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length > 0) {
          yield chunks.shift()!
        } else if (!done) {
          await new Promise<void>(resolve => { notify = resolve })
          notify = null
        }
      }
      if (error) throw error
    } finally {
      ws.close()
    }
  }
}
