// Daemon-local VibeVoice client — mirrors packages/core/src/voice/vibevoice.ts
// Kept here to avoid importing @coastal-claw/core's main entry (which starts the HTTP server).

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
    let notify: (() => void) | null = null

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
      notify?.()
    })

    ws.on('error', (err: unknown) => { error = err; done = true; notify?.() })
    ws.on('close', () => { done = true; notify?.() })

    // Wait for the metadata frame (or the first PCM chunk in backwards-compat mode)
    while (!metadataSeen && !done) {
      await new Promise<void>(resolve => { notify = resolve })
      notify = null
    }

    try {
      while (!done || chunks.length > 0) {
        if (chunks.length > 0) {
          yield { pcm: chunks.shift()!, sampleRate }
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
