// packages/daemon/src/voice/audio.ts
import { EventEmitter } from 'node:events'

export interface AudioChunk {
  data: Buffer
  sampleRate: number
  channels: number
}

export interface AudioRecorder extends EventEmitter {
  start(): void
  stop(): void
}

export interface AudioPlayer {
  play(pcmData: Buffer, sampleRate: number): Promise<void>
  stop(): void
}

/** Create a microphone recorder. Returns mock recorder in test environment. */
export function createRecorder(sampleRate = 16_000): AudioRecorder {
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_AUDIO === '1') {
    return createMockRecorder()
  }
  return createPortAudioRecorder(sampleRate)
}

/** Create an audio player. Returns mock player in test environment. */
export function createPlayer(): AudioPlayer {
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_AUDIO === '1') {
    return createMockPlayer()
  }
  return createPortAudioPlayer()
}

function createMockRecorder(): AudioRecorder {
  const emitter = new EventEmitter() as AudioRecorder
  emitter.start = () => {
    // Emit silence chunks for testing
    const interval = setInterval(() => {
      emitter.emit('data', { data: Buffer.alloc(3200), sampleRate: 16_000, channels: 1 } as AudioChunk)
    }, 100)
    emitter.once('stop', () => clearInterval(interval))
  }
  emitter.stop = () => emitter.emit('stop')
  return emitter
}

function createMockPlayer(): AudioPlayer {
  return {
    async play(_pcmData: Buffer, _sampleRate: number): Promise<void> {
      // Mock: no-op playback
    },
    stop(): void {},
  }
}

function createPortAudioRecorder(sampleRate: number): AudioRecorder {
  const emitter = new EventEmitter() as AudioRecorder
  let stream: any = null
  emitter.start = () => {
    try {
      // Dynamic import to avoid build errors on systems without PortAudio
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const portAudio = require('node-portaudio')
      stream = new portAudio.AudioIO({
        inOptions: {
          channelCount: 1,
          sampleFormat: portAudio.SampleFormat16Bit,
          sampleRate,
          deviceId: -1, // default input device
          closeOnError: true,
        },
      })
      stream.on('data', (data: Buffer) => {
        emitter.emit('data', { data, sampleRate, channels: 1 } as AudioChunk)
      })
      stream.start()
    } catch (e: any) {
      console.warn('[audio] PortAudio unavailable:', e.message)
    }
  }
  emitter.stop = () => { stream?.quit(); stream = null }
  return emitter
}

function createPortAudioPlayer(): AudioPlayer {
  let stream: any = null
  return {
    async play(pcmData: Buffer, sampleRate: number): Promise<void> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const portAudio = require('node-portaudio')
        stream = new portAudio.AudioIO({
          outOptions: {
            channelCount: 1,
            sampleFormat: portAudio.SampleFormat16Bit,
            sampleRate,
            deviceId: -1,
            closeOnError: true,
          },
        })
        await new Promise<void>((resolve, reject) => {
          stream.on('finish', resolve)
          stream.on('error', reject)
          stream.start()
          stream.write(pcmData)
          stream.end()
        })
      } catch (e: any) {
        console.warn('[audio] Playback failed:', e.message)
      }
    },
    stop(): void { stream?.quit(); stream = null },
  }
}
