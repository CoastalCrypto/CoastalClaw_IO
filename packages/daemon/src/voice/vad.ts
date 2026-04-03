// packages/daemon/src/voice/vad.ts
import { EventEmitter } from 'node:events'

export interface VADOptions {
  silenceThresholdMs?: number  // ms of silence before considering speech ended
  speechThresholdRms?: number  // RMS level above which audio is considered speech
}

/**
 * Simple energy-based Voice Activity Detector.
 * Emits 'speech_start' and 'speech_end' based on audio RMS levels.
 * For production use, consider @ricky0123/vad-node for ML-based VAD.
 */
export class VAD extends EventEmitter {
  private isSpeaking = false
  private silenceStart: number | null = null
  private opts: Required<VADOptions>

  constructor(opts: VADOptions = {}) {
    super()
    this.opts = {
      silenceThresholdMs: opts.silenceThresholdMs ?? 800,
      speechThresholdRms: opts.speechThresholdRms ?? 500,
    }
  }

  /** Feed a PCM audio chunk (16-bit samples). */
  feed(pcm: Buffer): void {
    const rms = computeRms(pcm)
    const now = Date.now()

    if (rms > this.opts.speechThresholdRms) {
      if (!this.isSpeaking) {
        this.isSpeaking = true
        this.silenceStart = null
        this.emit('speech_start')
      } else {
        this.silenceStart = null
      }
    } else {
      if (this.isSpeaking) {
        if (!this.silenceStart) {
          this.silenceStart = now
        } else if (now - this.silenceStart > this.opts.silenceThresholdMs) {
          this.isSpeaking = false
          this.silenceStart = null
          this.emit('speech_end')
        }
      }
    }
  }
}

function computeRms(pcm: Buffer): number {
  if (pcm.length < 2) return 0
  let sum = 0
  for (let i = 0; i < pcm.length - 1; i += 2) {
    const sample = pcm.readInt16LE(i)
    sum += sample * sample
  }
  return Math.sqrt(sum / (pcm.length / 2))
}
