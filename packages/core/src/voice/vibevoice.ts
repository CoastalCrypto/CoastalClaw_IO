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

  async *speak(text: string, voice = 'en_us_female_1'): AsyncIterable<{ pcm: Buffer; sampleRate: number }> {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/tts/stream'
    const { WebSocket } = await import('ws')
    const ws = new WebSocket(wsUrl)

    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })

    ws.send(JSON.stringify({ text, voice }))

    const chunks: Buffer[] = []
    let sampleRate = 24_000       // fallback for servers without metadata frame
    let metadataSeen = false
    let done = false
    let error: unknown = null
    const waiters: Array<() => void> = []
    const wake = () => { const batch = waiters.splice(0); batch.forEach(r => r()) }
    const wait = () => new Promise<void>(r => waiters.push(r))

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (!metadataSeen) {
          // Old server — first message is raw PCM, no metadata frame
          metadataSeen = true
        }
        chunks.push(data)
      } else {
        try {
          const msg = JSON.parse(data.toString()) as { sample_rate?: number; done?: boolean }
          if (!metadataSeen && typeof msg.sample_rate === 'number') {
            sampleRate = msg.sample_rate
            metadataSeen = true
          } else if (msg.done) {
            done = true
          }
        } catch { /* ignore non-JSON */ }
      }
      wake()
    })

    ws.on('error', (err) => { error = err; done = true; wake() })
    ws.on('close', () => { done = true; wake() })

    // Wait for the metadata frame (or the first PCM chunk in backwards-compat mode)
    while (!metadataSeen && !done) { await wait() }

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length > 0) {
          yield { pcm: chunks.shift()!, sampleRate }
        } else if (!done) {
          await wait()
        }
      }
      if (error) throw error
    } finally {
      ws.close()
    }
  }
}
