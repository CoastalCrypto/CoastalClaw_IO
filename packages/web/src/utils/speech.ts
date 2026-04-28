/**
 * Shared Web Speech API helper.
 * - Accepts optional voiceName to select a specific voice
 * - Strips markdown formatting before speaking
 * - Handles the Chrome 15s speechSynthesis bug (pause+resume between utterances)
 * - Falls back gracefully if speechSynthesis is unavailable
 */
export function speakText(text: string, voiceName?: string | null): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()

  setTimeout(() => {
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voiceName
      ? (voices.find(v => v.name === voiceName) ?? null)
      : (voices.find(v => v.name.includes('Google UK English Male'))
          || voices.find(v => v.lang.startsWith('en-') && !v.name.toLowerCase().includes('zira') && !v.name.toLowerCase().includes('david'))
          || voices.find(v => v.lang.startsWith('en'))
          || null)

    // Split on sentence and clause boundaries; cap chunks at 100 chars
    const parts = text.split(/(?<=[.!?;,])\s+/)
    const chunks: string[] = []
    let current = ''
    for (const part of parts) {
      if (current.length + part.length > 100 && current) {
        chunks.push(current.trim())
        current = part
      } else {
        current += (current ? ' ' : '') + part
      }
    }
    if (current.trim()) chunks.push(current.trim())

    const utterances = chunks.filter(Boolean).map(chunk => {
      const u = new SpeechSynthesisUtterance(chunk)
      u.voice = preferredVoice
      u.rate = 1.0
      u.pitch = 1.0
      return u
    })

    // Between utterances: pause()+resume() resets Chrome's 15s internal timer
    // silently — no audio is playing at that moment.
    for (let i = 0; i < utterances.length - 1; i++) {
      utterances[i].onend = () => {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }

    utterances.forEach(u => window.speechSynthesis.speak(u))
  }, 50)
}
