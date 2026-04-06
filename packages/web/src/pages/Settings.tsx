import { useState, useEffect } from 'react'
import { coreClient, type Persona } from '../api/client'

const PERSONALITY_PRESETS = [
  { id: 'direct', label: 'Direct', desc: 'Concise, data-first, no filler.' },
  { id: 'collaborative', label: 'Collaborative', desc: 'Warm, asks clarifying questions, thinks out loud.' },
  { id: 'analytical', label: 'Analytical', desc: 'Structured, cites sources, hedges uncertainty explicitly.' },
  { id: 'custom', label: 'Custom', desc: 'Write your own personality.' },
]

const PERSONALITY_TEXT: Record<string, string> = {
  direct: 'Direct and concise. Lead with the answer. No filler, no preamble.',
  collaborative: 'Warm and collaborative. Ask one clarifying question when the request is ambiguous. Think out loud when reasoning through complex problems.',
  analytical: 'Analytical and precise. Cite sources. State uncertainty explicitly. Structure responses with headers and bullet points.',
}

function detectPreset(personality: string): string {
  for (const [id, text] of Object.entries(PERSONALITY_TEXT)) {
    if (personality === text) return id
  }
  return personality ? 'custom' : ''
}

export function Settings({ onNav }: { onNav: (page: string) => void }) {
  const [persona, setPersona] = useState<Partial<Persona>>({})
  const [personalityPreset, setPersonalityPreset] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const input = 'w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500'

  useEffect(() => {
    coreClient.getPersona()
      .then(({ persona: p }) => {
        setPersona(p)
        setPersonalityPreset(detectPreset(p.personality ?? ''))
      })
      .catch(() => setError('Could not load settings. Is coastal-server running?'))
      .finally(() => setLoading(false))
  }, [])

  const handlePreset = (id: string) => {
    setPersonalityPreset(id)
    if (id !== 'custom') setPersona((p) => ({ ...p, personality: PERSONALITY_TEXT[id] ?? '' }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { persona: updated } = await coreClient.setPersona(persona)
      setPersona(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Failed to save. Is coastal-server running?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#050d1a' }}>
      <nav className="fixed top-0 left-0 right-0 z-10 bg-[#050d1a]/90 border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <span className="text-sm font-mono tracking-wider text-cyan-400">{'>'} SETTINGS</span>
        <div className="flex gap-6 font-mono text-sm">
          <button onClick={() => onNav('chat')} className="text-gray-400 hover:text-white transition-colors">/chat</button>
          <button onClick={() => onNav('models')} className="text-gray-400 hover:text-white transition-colors">/models</button>
          <button onClick={() => onNav('agents')} className="text-gray-400 hover:text-white transition-colors">/agents</button>
          <button className="text-cyan-400 font-bold">/settings</button>
        </div>
      </nav>

      <div className="pt-20 px-6 max-w-xl mx-auto py-12">
        <h1 className="text-2xl font-bold mb-1">Agent Persona</h1>
        <p className="text-gray-500 text-sm mb-8">Changes take effect on the next conversation.</p>

        {loading ? (
          <div className="text-cyan-500 font-mono text-sm animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Agent name</label>
              <input
                className={input}
                value={persona.agentName ?? ''}
                onChange={(e) => setPersona((p) => ({ ...p, agentName: e.target.value }))}
                placeholder="JARVIS, Alex, Friday, Max..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Organization name</label>
              <input
                className={input}
                value={persona.orgName ?? ''}
                onChange={(e) => setPersona((p) => ({ ...p, orgName: e.target.value }))}
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                What does your org do? <span className="text-gray-600">(optional)</span>
              </label>
              <textarea
                className={`${input} h-24 resize-none`}
                value={persona.orgContext ?? ''}
                onChange={(e) => setPersona((p) => ({ ...p, orgContext: e.target.value }))}
                placeholder="We run a 50-person SaaS company selling analytics software..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Your name <span className="text-gray-600">(optional)</span>
              </label>
              <input
                className={input}
                value={persona.ownerName ?? ''}
                onChange={(e) => setPersona((p) => ({ ...p, ownerName: e.target.value }))}
                placeholder="Tony"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-3">Personality</label>
              <div className="space-y-2">
                {PERSONALITY_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePreset(p.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      personalityPreset === p.id
                        ? 'border-cyan-500 bg-cyan-500/10 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <span className="font-semibold text-sm">{p.label}</span>
                    <span className="text-xs ml-2 opacity-60">{p.desc}</span>
                  </button>
                ))}
              </div>
              {personalityPreset === 'custom' && (
                <textarea
                  className={`${input} h-24 resize-none mt-3`}
                  value={persona.personality ?? ''}
                  onChange={(e) => setPersona((p) => ({ ...p, personality: e.target.value }))}
                  placeholder="Describe the personality in plain English..."
                  autoFocus
                />
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {saved && <p className="text-green-400 text-sm">Saved.</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
