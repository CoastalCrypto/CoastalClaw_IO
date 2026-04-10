// packages/daemon/src/voice/pipeline.ts
import { EventEmitter } from 'node:events'
import { WakeWordDetector } from './wake-word.js'
import { transcribe } from './stt.js'
import { synthesize } from './tts.js'
import { createRecorder, createPlayer } from './audio.js'
import { VAD } from './vad.js'
import { InterruptHandler } from './interrupt-handler.js'
import { VibeVoiceClient } from './vibevoice-client.js'

export enum PipelineState {
  Idle         = 'idle',
  Listening    = 'listening',
  Transcribing = 'transcribing',
  Thinking     = 'thinking',
  Speaking     = 'speaking',
}

export interface PipelineOptions {
  /** Called with transcript text, returns agent reply text. */
  onTranscript: (text: string) => Promise<string>
  voiceModel?: string
  voicesDir?: string   // passed to TTSOptions.voicesDir — directory containing .onnx Piper models
  mockMode?: boolean
  vibeVoiceUrl?: string
}

export class VoicePipeline extends EventEmitter {
  private _state: PipelineState = PipelineState.Idle
  private wakeWord: WakeWordDetector
  private interruptHandler: InterruptHandler
  private opts: PipelineOptions
  private audioBuffer: Buffer[] = []
  private recorder = createRecorder()
  private player = createPlayer()
  private vad: VAD
  private running = false
  private vibeVoice: VibeVoiceClient
  private vibeVoiceAvailable = false

  constructor(opts: PipelineOptions) {
    super()
    this.opts = opts
    this.wakeWord = new WakeWordDetector({ mockMode: opts.mockMode })
    this.interruptHandler = new InterruptHandler()
    this.vad = new VAD()
    this.vibeVoice = new VibeVoiceClient(opts.vibeVoiceUrl ?? 'http://127.0.0.1:8001')
    if (!opts.mockMode) {
      this.vibeVoice.isAvailable().then(ok => {
        this.vibeVoiceAvailable = ok
        if (ok) console.log('[voice-pipeline] VibeVoice backend connected')
      }).catch(() => {})
    }
  }

  get state(): PipelineState { return this._state }

  private setState(s: PipelineState): void {
    this._state = s
    this.emit('stateChange', s)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.setState(PipelineState.Listening)
    this.listenForWakeWord()
  }

  stop(): void {
    this.running = false
    this.wakeWord.stop()
    this.recorder.stop()
    this.player.stop()
    this.setState(PipelineState.Idle)
  }

  private listenForWakeWord(): void {
    this.wakeWord.once('detected', () => {
      if (!this.running) return
      this.captureUtterance()
    })
    this.wakeWord.start()

    // Set up VAD on recorder for interrupt detection during speaking
    this.recorder.on('data', ({ data }) => {
      if (this._state === PipelineState.Speaking) {
        this.vad.feed(data)
      } else if (this._state === PipelineState.Listening) {
        this.wakeWord.feed(data)
      }
    })
    this.recorder.start()

    this.vad.on('speech_start', () => {
      if (this._state === PipelineState.Speaking) {
        this.interruptHandler.trigger()
        this.player.stop()
        setTimeout(() => {
          if (this.running) {
            this.setState(PipelineState.Listening)
            this.listenForWakeWord()
          }
        }, 300)
      }
    })
  }

  private async captureUtterance(): Promise<void> {
    this.setState(PipelineState.Transcribing)
    this.audioBuffer = []

    // Collect 3 seconds of audio after wake word
    await new Promise<void>(resolve => setTimeout(resolve, this.opts.mockMode ? 50 : 3_000))

    const pcm = Buffer.concat(this.audioBuffer)

    let text: string
    if (this.vibeVoiceAvailable) {
      const transcript = await this.vibeVoice.transcribe(pcm)
      text = transcript.text
    } else {
      const result = await transcribe(pcm, { mockMode: this.opts.mockMode })
      text = result.text
    }

    if (!text.trim()) {
      if (this.running) {
        this.setState(PipelineState.Listening)
        this.listenForWakeWord()
      }
      return
    }

    this.setState(PipelineState.Thinking)
    const reply = await this.opts.onTranscript(text)

    this.setState(PipelineState.Speaking)
    if (this.vibeVoiceAvailable) {
      const chunks: Buffer[] = []
      let resolvedSampleRate = 24_000
      for await (const { pcm, sampleRate } of this.vibeVoice.speak(reply)) {
        chunks.push(pcm)
        resolvedSampleRate = sampleRate
      }
      await this.player.play(Buffer.concat(chunks), resolvedSampleRate)
    } else {
      const audio = await synthesize(reply, {
        voiceModel: this.opts.voiceModel,
        voicesDir: this.opts.voicesDir,
        mockMode: this.opts.mockMode,
      })
      await this.player.play(audio, 22_050)
    }

    if (this.running) {
      this.setState(PipelineState.Listening)
      this.listenForWakeWord()
    }
  }
}
